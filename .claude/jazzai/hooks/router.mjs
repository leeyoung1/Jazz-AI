import path from "node:path";
import { pathToFileURL } from "node:url";
import { extractCommandText, extractPromptText, parseCommand } from "./lib/command-parser.mjs";
import { resolveStageArtifacts, resolveArtifacts, artifactMap } from "./lib/artifact-resolver.mjs";
import { matchArtifactPath, resolveArtifactPath } from "./lib/artifact-catalog.mjs";
import { buildCompactSummary } from "./lib/compact-summary.mjs";
import { buildStageContext } from "./lib/context-assembler.mjs";
import { defaultPlanSlicePath, ensurePlanSlice } from "./lib/plan-slice.mjs";
import { evaluatePermission, evaluateToolPolicy, evaluateUserPrompt } from "./lib/policy-engine.mjs";
import { syncProjectIndexes } from "./lib/project-scanner.mjs";
import { loadSessionState, saveSessionState, deleteSessionState } from "./lib/session-store.mjs";
import { getStageConfig, getStageForCommand } from "./lib/stage-registry.mjs";
import {
  findLikelyProjectFromPath,
  flattenStrings,
  nowIso,
  parseFrontmatter,
  relativeFromRoot,
  resolveRootDir,
  safeReadTextFile,
} from "./lib/utils.mjs";

export async function handleHookPayload(payload, options = {}) {
  const rootDir = options.rootDir ?? resolveRootDir(payload);
  const sessionId = resolveSessionId(payload);
  let sessionState = loadSessionState(rootDir, sessionId);
  const eventName = payload.hook_event_name ?? payload.event ?? "Unknown";

  let response;
  switch (eventName) {
    case "SessionStart":
      response = handleSessionStart({ rootDir, sessionState });
      break;
    case "UserPromptSubmit":
      response = handleUserPromptSubmit({ payload, rootDir, sessionState });
      break;
    case "PreToolUse":
      response = handlePreToolUse({ payload, rootDir, sessionState });
      break;
    case "PostToolUse":
      response = handlePostToolUse({ payload, rootDir, sessionState });
      break;
    case "PostToolUseFailure":
      response = handlePostToolUseFailure({ payload, sessionState });
      break;
    case "PermissionRequest":
      response = evaluatePermission(payload);
      break;
    case "SubagentStart":
      response = handleSubagentStart({ payload, rootDir, sessionState });
      break;
    case "SubagentStop":
      response = handleSubagentStop({ payload, rootDir, sessionState });
      break;
    case "PreCompact":
      response = sessionState.workflow_active
        ? {
            continue: true,
            additionalContext: buildCompactSummary(rootDir, sessionState),
          }
        : { continue: true };
      break;
    case "SessionEnd":
      deleteSessionState(rootDir, sessionId);
      response = {
        continue: true,
        additionalContext: `Session ${sessionId} closed at ${nowIso()}.`,
      };
      break;
    default:
      response = { continue: true };
      break;
  }

  return response;
}

function handleSessionStart() {
  return { continue: true };
}

function handleUserPromptSubmit({ payload, rootDir, sessionState }) {
  const commandText = extractCommandText(payload);
  const promptText = extractPromptText(payload);
  const commandInfo = parseCommand(commandText);

  if (!commandInfo) {
    if (!sessionState.workflow_active) {
      return { continue: true };
    }

    if (sessionState.stage && (isContinuationPrompt(promptText) || isStageInputPrompt(promptText, sessionState.stage))) {
      sessionState = hydrateSessionStateFromWorkspace(rootDir, sessionState);
      const artifacts = resolveStageArtifacts(rootDir, sessionState.stage, sessionState.project);
      const artifactLookup = artifactMap(artifacts);
      const continuationCommandInfo = resolveContinuationCommandInfo(sessionState);

      const gate = evaluateUserPrompt({
        rootDir,
        commandInfo: continuationCommandInfo,
        sessionState,
        artifactLookup,
      });
      if (!gate.ok) {
        sessionState = saveSessionState(rootDir, sessionState);
        return {
          continue: false,
          decision: "block",
          reason: `Stage gate still failing — ${gate.reason}`,
        };
      }

      const stageContext = buildStageContext({
        commandInfo: continuationCommandInfo,
        sessionState,
        artifacts,
        rootDir,
      });

      const continuationNote = [
        "",
        "## Continuation After Compact",
        `The user is continuing a session. Active stage: ${sessionState.stage}, project: ${sessionState.project ?? "none"}.`,
        "Resume the current stage immediately. Do NOT ask what framework or workflow you are in — you are in the JazzAI codeflicker workflow.",
      ].join("\n");

      sessionState = saveSessionState(rootDir, sessionState);
      return {
        continue: true,
        systemMessage: stageContext.systemMessage,
        additionalContext: stageContext.additionalContext + continuationNote,
      };
    }

    return { continue: true };
  }

  const stage = getStageForCommand(commandInfo.command);
  sessionState.workflow_active = true;
  sessionState.current_command = commandInfo.raw;
  sessionState.stage = stage;
  sessionState.project = commandInfo.project ?? commandInfo.name ?? sessionState.project;
  sessionState.plan_id = commandInfo.plan ?? null;
  sessionState.wave = commandInfo.wave ?? null;
  sessionState = hydrateSessionStateFromWorkspace(rootDir, sessionState);

  const artifacts = resolveStageArtifacts(rootDir, stage, sessionState.project);
  const artifactLookup = artifactMap(artifacts);
  const gate = evaluateUserPrompt({ rootDir, commandInfo, sessionState, artifactLookup });
  sessionState = refreshConfirmations(rootDir, sessionState);
  sessionState = saveSessionState(rootDir, sessionState);

  if (!gate.ok) {
    return {
      continue: false,
      decision: "block",
      reason: gate.reason,
    };
  }

  return {
    continue: true,
    ...buildStageContext({
      commandInfo,
      sessionState,
      artifacts,
      rootDir,
    }),
  };
}

function resolveContinuationCommandInfo(sessionState) {
  const parsed = parseCommand(sessionState.current_command);
  if (parsed) {
    return parsed;
  }
  const stageCommand = getStageConfig(sessionState.stage)?.command ?? null;
  return {
    command: stageCommand,
    raw: sessionState.current_command ?? stageCommand ?? "continue",
    project: sessionState.project ?? null,
    plan: sessionState.plan_id ?? null,
    wave: sessionState.wave ?? null,
  };
}

function isContinuationPrompt(promptText) {
  if (typeof promptText !== "string") {
    return false;
  }
  const normalized = promptText.trim().replace(/\s+/g, " ").toLowerCase();
  return /^(继续|继续吧|继续一下|继续当前阶段|继续刚才|接着来|continue|resume)([.!?。！]| current stage)?$/.test(
    normalized
  );
}

function isStageInputPrompt(promptText, stage) {
  if (typeof promptText !== "string") {
    return false;
  }
  return false;
}

function handlePreToolUse({ payload, rootDir, sessionState }) {
  const policy = evaluateToolPolicy(payload, sessionState);
  if (!policy.ok) {
    return {
      continue: false,
      decision: "block",
      reason: policy.reason,
    };
  }
  if (!sessionState.workflow_active) {
    return { continue: true };
  }
  sessionState = refreshConfirmations(rootDir, sessionState);
  saveSessionState(rootDir, sessionState);
  if (policy.reason) {
    return {
      continue: true,
      additionalContext: policy.reason,
    };
  }
  return { continue: true };
}

function handlePostToolUse({ payload, rootDir, sessionState }) {
  if (!sessionState.workflow_active) {
    return { continue: true };
  }
  if (!isTrackedWriteTool(payload.tool_name)) {
    return { continue: true };
  }

  const artifactUpdates = collectTrackedArtifactUpdates(extractPathsFromPayload(payload, rootDir));
  if (artifactUpdates.length === 0) {
    return { continue: true };
  }

  for (const artifactUpdate of artifactUpdates) {
    sessionState.project = artifactUpdate.project ?? findLikelyProjectFromPath(artifactUpdate.path) ?? sessionState.project;
    if (Object.hasOwn(sessionState.last_outputs, artifactUpdate.key)) {
      sessionState.last_outputs[artifactUpdate.key] = artifactUpdate.path;
    }
  }
  sessionState = refreshConfirmations(rootDir, sessionState);
  sessionState = saveSessionState(rootDir, sessionState);
  syncProjectIndexes(rootDir);
  return {
    continue: true,
    additionalContext: [
      "Hook artifact tracker updated.",
      `project=${sessionState.project ?? "none"}`,
      `last_outputs=${JSON.stringify(sessionState.last_outputs)}`,
    ].join("\n"),
  };
}

function isTrackedWriteTool(toolName) {
  return /write|edit|replace|apply_patch|create/i.test(toolName ?? "");
}

function collectTrackedArtifactUpdates(changedPaths) {
  const updates = [];
  const seen = new Set();

  for (const changedPath of changedPaths) {
    const artifactUpdate = classifyArtifact(changedPath);
    if (!artifactUpdate) {
      continue;
    }
    const dedupeKey = `${artifactUpdate.key}:${changedPath}`;
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);
    updates.push({
      ...artifactUpdate,
      path: changedPath,
    });
  }

  return updates;
}

function handlePostToolUseFailure({ payload, sessionState }) {
  if (!sessionState.workflow_active) {
    return { continue: true };
  }
  const toolName = payload.tool_name ?? "unknown";
  return {
    continue: true,
    additionalContext: [
      "Tool execution failed under hooks-first workflow.",
      `tool=${toolName}`,
      `stage=${sessionState.stage ?? "none"}`,
      `project=${sessionState.project ?? "none"}`,
      "If this failure was caused by missing artifacts or confirmation state, fix the prerequisite before retrying.",
    ].join("\n"),
  };
}

function handleSubagentStart({ payload, rootDir, sessionState }) {
  const meta = extractTddPlanMeta(payload, rootDir);
  if (meta) {
    sessionState.stage = "tdd_execute";
    sessionState.project = meta.project;
    sessionState.plan_id = meta.plan;
    sessionState.current_command = `/tdd --project ${meta.project} --plan ${meta.plan}`;
    sessionState.workflow_active = true;
    const ensuredSlicePath = ensurePlanSlice(rootDir, meta.project, meta.plan, meta.slice);
    const usePlanSliceMode = Boolean(ensuredSlicePath);
    const artifacts = usePlanSliceMode
      ? resolveArtifacts(rootDir, buildTddSubagentArtifacts(ensuredSlicePath), meta.project)
      : resolveStageArtifacts(rootDir, sessionState.stage, sessionState.project);
    const stageContext = buildStageContext({
      commandInfo: { raw: sessionState.current_command },
      sessionState,
      artifacts,
      rootDir,
    });
    const extraNote = usePlanSliceMode
      ? [
          "",
          "## Plan Slice Guidance",
          `当前 subAgent 已绑定到 ${meta.plan}，默认上下文为 \`${ensuredSlicePath}\`。`,
          `如果当前上下文不够，请优先按需阅读：\`${resolveArtifactPath(meta.project, "execution_plan", { planId: meta.plan })}\` → \`${resolveArtifactPath(meta.project, "tech_design")}\` → \`${resolveArtifactPath(meta.project, "context")}\` → \`${resolveArtifactPath(meta.project, "tasks")}\`。`,
        ].join("\n")
      : [
          "",
          "## Plan Slice Warning",
          `未能为 ${meta.plan} 生成切片，已回退到当前阶段级注入。`,
          `请优先检查 \`${resolveArtifactPath(meta.project, "execution_plan", { planId: meta.plan })}\` 或 \`${resolveArtifactPath(meta.project, "tasks")}\` 是否包含稳定的 ${meta.plan} 定义。`,
        ].join("\n");
    sessionState = refreshConfirmations(rootDir, sessionState);
    sessionState = saveSessionState(rootDir, sessionState);
    return {
      continue: true,
      systemMessage: stageContext.systemMessage,
      additionalContext: stageContext.additionalContext + extraNote,
    };
  }

  if (!sessionState.workflow_active || !sessionState.stage) {
    return { continue: true };
  }
  const artifacts = resolveStageArtifacts(rootDir, sessionState.stage, sessionState.project);
  sessionState = saveSessionState(rootDir, sessionState);
  return {
    continue: true,
    ...buildStageContext({
      commandInfo: { raw: sessionState.current_command ?? "SubagentStart" },
      sessionState,
      artifacts,
      rootDir,
    }),
  };
}

function handleSubagentStop({ payload, rootDir, sessionState }) {
  if (!sessionState.workflow_active || sessionState.stage !== "tdd_execute") {
    return { continue: true };
  }
  return {
    continue: true,
    additionalContext: [
      "## subAgent 返回结果验证（必须执行）",
      "",
      "请立即检查该 subAgent 的返回结果：",
      "1. 是否包含 `unit_test_gate`？允许值：passed / deferred / not_required / failed",
      "2. 当 unit_test_gate=passed 或 deferred 时，是否包含 `test_files` 列表？列出的测试文件是否实际存在于磁盘？请用 read 工具验证至少 1 个",
      "3. 当 unit_test_gate=not_required 时，是否包含明确的 `test_not_required_reason`？只有 DTO、enum、常量、简单 mapper、无分支胶水代码等低价值测试才允许豁免",
      "4. 禁止将无测试文件且无豁免原因的 Plan 标记为 unit_test_gate=passed、deferred 或 not_required",
      "5. 如果这是 verifier issue 后的返工 subAgent，必须设置 pending_verification_by_wave=true 并写回 state.json",
      "6. 返工完成后不得直接进入下一 Wave 或 execution_report；iteration_count_by_wave < 3 时必须再次启动 tdd-verifier 或 final compile verifier",
      "7. 最终 execution_report 必须包含 compile_gate=passed 且 ready_for_delivery=true，才能提示进入 /archive",
      "8. 如果 iteration_count_by_wave >= 3，不得再启动 verifier，必须停止并向用户报告修订上限、最后 issue 和人工介入建议",
    ].join("\n"),
  };
}

function buildTddSubagentArtifacts(slicePath) {
  return [
    {
      key: "plan_slice",
      label: "当前 Plan 切片",
      required: true,
      inject: "summary",
      candidates: [slicePath],
    },
    {
      key: "repo_agents",
      label: "仓库规范",
      required: false,
      inject: "summary",
      candidates: ["AGENTS.md", ".vibe/AGENTS.md"],
    },
    {
      key: "repo_domain",
      label: "业务知识基线",
      required: false,
      inject: "summary",
      candidates: [".vibe/domain.md"],
    },
    {
      key: "repo_index",
      label: "模板索引",
      required: false,
      inject: "summary",
      candidates: [".vibe/index.md"],
    },
  ];
}

function extractTddPlanMeta(payload, rootDir) {
  if (!payload) {
    return null;
  }
  const values = flattenStrings(payload);
  const pattern = /VIBE_TDD_PLAN_META\s+project=([^\s]+)\s+plan=([^\s]+)(?:\s+slice=([^\s]+))?/u;
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }
    const match = value.match(pattern);
    if (!match) {
      continue;
    }
    const [, project, plan, rawSlice] = match;
    const resolvedSlice = rawSlice ?? defaultPlanSlicePath(project, plan);
    const normalizedSlice = resolvedSlice.startsWith(rootDir)
      ? relativeFromRoot(rootDir, resolvedSlice)
      : resolvedSlice;
    return {
      project,
      plan,
      slice: normalizedSlice.replaceAll("\\", "/") || defaultPlanSlicePath(project, plan),
    };
  }
  return null;
}

function resolveSessionId(payload) {
  const candidates = [payload.session_id, payload.sessionId, payload.session?.id];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return "default-session";
}

function extractPathsFromPayload(payload, rootDir) {
  const strings = flattenStrings(payload);
  const results = new Set();
  for (const candidate of strings) {
    if (typeof candidate !== "string") {
      continue;
    }
    if (!candidate.includes(".prd/") && !candidate.includes(".vibe/") && !candidate.includes("AGENTS.md")) {
      continue;
    }
    const normalized = candidate.replaceAll("\\", "/");
    const relative = normalized.startsWith(rootDir.replaceAll("\\", "/"))
      ? relativeFromRoot(rootDir, normalized)
      : normalized;
    results.add(relative);
  }
  const directPath = payload.tool_input?.file_path ?? payload.tool_input?.path ?? null;
  if (typeof directPath === "string") {
    const relative = directPath.startsWith(rootDir) ? relativeFromRoot(rootDir, directPath) : directPath;
    results.add(relative.replaceAll("\\", "/"));
  }
  return [...results];
}

function classifyArtifact(relativePath) {
  const matched = matchArtifactPath(relativePath);
  if (!matched) {
    return null;
  }
  return {
    key: matched.key,
    project: matched.project,
  };
}

function refreshConfirmations(rootDir, sessionState) {
  if (sessionState.project) {
    const techDesignRaw = safeReadTextFile(rootDir, resolveArtifactPath(sessionState.project, "tech_design"));
    if (techDesignRaw) {
      const { data } = parseFrontmatter(techDesignRaw);
      sessionState.confirmations.tech_design_confirmed = data.pending_human_confirm === false;
    }
    const tasksRaw = safeReadTextFile(rootDir, resolveArtifactPath(sessionState.project, "tasks"));
    if (tasksRaw) {
      const { data } = parseFrontmatter(tasksRaw);
      sessionState.confirmations.tasks_confirmed = data.human_confirmed === true;
    }
  }
  return sessionState;
}

function hydrateSessionStateFromWorkspace(rootDir, sessionState) {
  const projects = syncAndCollectProjects(rootDir);
  const targetProject = resolveTargetProject(sessionState, projects);
  if (!targetProject) {
    return sessionState;
  }

  const nextState = {
    ...sessionState,
    project: targetProject.name,
    stage: sessionState.current_command ? sessionState.stage : targetProject.furthestStage ?? sessionState.stage,
    last_outputs: {
      ...sessionState.last_outputs,
    },
  };

  for (const [key, document] of Object.entries(targetProject.documents)) {
    if (!document.exists) {
      continue;
    }
    if (Object.hasOwn(nextState.last_outputs, key)) {
      nextState.last_outputs[key] = document.path;
    }
  }

  if (targetProject.techDesignConfirmed) {
    nextState.confirmations.tech_design_confirmed = true;
  }
  if (targetProject.tasksConfirmed) {
    nextState.confirmations.tasks_confirmed = true;
  }

  if (!nextState.current_command) {
    nextState.current_command = targetProject.recommendedCommand ?? null;
  }

  return nextState;
}

function syncAndCollectProjects(rootDir) {
  syncProjectIndexes(rootDir);
  const { scanProjects } = awaitImportProjectScanner;
  return scanProjects(rootDir);
}

function resolveTargetProject(sessionState, projects) {
  if (!projects || projects.length === 0) {
    return null;
  }

  if (sessionState.project) {
    const matched = projects.find((project) => project.name === sessionState.project);
    if (matched) {
      return matched;
    }
  }

  if (projects.length === 1) {
    return projects[0];
  }

  return null;
}

const awaitImportProjectScanner = await import("./lib/project-scanner.mjs");

// 把引擎内部响应结构翻译为 Claude Code 官方 hook 输出 schema。
// 内部结构沿用历史形态（顶层 additionalContext / decision），CC 只认 hookSpecificOutput
// 嵌套字段，故必须在唯一出口处统一转换，否则上下文注入与门禁在真实 CC 下全部失效。
export function toClaudeCodeOutput(response, eventName) {
  const internal = response && typeof response === "object" ? response : {};
  const output = {};

  // 透传 CC 支持的顶层通用字段
  if (Object.hasOwn(internal, "continue")) {
    output.continue = internal.continue;
  }
  if (typeof internal.systemMessage === "string") {
    output.systemMessage = internal.systemMessage;
  }

  const hookSpecificOutput = { hookEventName: eventName };
  let hasHookSpecific = false;

  // additionalContext：CC 要求嵌套进 hookSpecificOutput，顶层会被静默丢弃
  if (typeof internal.additionalContext === "string" && internal.additionalContext.length > 0) {
    hookSpecificOutput.additionalContext = internal.additionalContext;
    hasHookSpecific = true;
  }

  if (internal.decision === "block") {
    if (eventName === "PreToolUse") {
      // PreToolUse 必须用 permissionDecision:deny，顶层 decision 对该事件无效
      hookSpecificOutput.permissionDecision = "deny";
      hookSpecificOutput.permissionDecisionReason = internal.reason ?? "Blocked by JazzAI workflow gate.";
      hasHookSpecific = true;
    } else {
      // UserPromptSubmit 等：CC 用顶层 decision:block + reason
      output.decision = "block";
      if (typeof internal.reason === "string") {
        output.reason = internal.reason;
      }
    }
  } else if (internal.decision === "approve") {
    // PermissionRequest 放行：CC 用 hookSpecificOutput.permissionDecision:allow
    hookSpecificOutput.permissionDecision = "allow";
    hasHookSpecific = true;
  }

  if (hasHookSpecific) {
    output.hookSpecificOutput = hookSpecificOutput;
  }

  return output;
}

async function main() {
  const payload = await readStdinJson();
  const eventName = payload?.hook_event_name ?? payload?.event ?? "Unknown";
  const response = await handleHookPayload(payload);
  const output = toClaudeCodeOutput(response, eventName);
  process.stdout.write(`${JSON.stringify(output)}\n`);
}

function readStdinJson() {
  return new Promise((resolve) => {
    const chunks = [];
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => chunks.push(chunk));
    process.stdin.on("end", () => {
      const raw = chunks.join("").trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
