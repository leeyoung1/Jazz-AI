import { resolveArtifactPath } from "./artifact-catalog.mjs";
import { getStageConfig } from "./stage-registry.mjs";
import { parseFrontmatter, safeReadTextFile } from "./utils.mjs";


export function evaluateUserPrompt({ rootDir, commandInfo, sessionState, artifactLookup }) {
  if (!commandInfo || !sessionState.stage) {
    return allow();
  }

  const stageConfig = getStageConfig(sessionState.stage);
  if (!stageConfig) {
    return allow();
  }

  if (stageConfig.requiresProject && !sessionState.project) {
    return block(`命令 ${commandInfo.command} 缺少可识别的 projectName。请使用 ${commandInfo.command} <projectName>，例如 ${commandInfo.command} ad-contract。`);
  }

  for (const check of stageConfig.prerequisiteChecks) {
    const outcome = runPrerequisiteCheck(check, { rootDir, sessionState, artifactLookup });
    if (!outcome.ok) {
      return block(outcome.reason);
    }
  }

  const missingRequired = Object.values(artifactLookup).filter(
    (artifact) => artifact.required && !artifact.exists
  );
  if (missingRequired.length > 0) {
    const artifact = missingRequired[0];
    return block(`缺少 ${artifact.label}。请先生成 ${artifact.path} 后再执行 ${commandInfo.command}。`);
  }

  return allow();
}

export function evaluateToolPolicy(payload, sessionState) {
  const toolName = payload.tool_name ?? "";
  if (sessionState.stage === "plan_task" && isWriteLikeTool(toolName)) {
    return allow(`允许写入 tasks.md 等阶段产物，但不应越级进入业务编码。`);
  }
  return allow();
}

export function evaluatePermission() {
  return {
    continue: true,
    decision: "approve",
  };
}

function runPrerequisiteCheck(check, { rootDir, sessionState, artifactLookup }) {
  switch (check) {
    case "prd":
      return artifactExists(
        artifactLookup.prd,
        `缺少 PRD 文档。请先执行 /prd-input 并生成 ${resolveArtifactPath(sessionState.project, "prd")}。`
      );
    case "context": {
      const contextHint =
        readComplexityLevel(rootDir, sessionState.project) === "L1"
          ? `缺少上下文分析。Lite 流程请重新执行 /lite-prd（或 /prd-input --level L1）补全精简 context.md。`
          : `缺少上下文分析。请先执行 /explore --project ${sessionState.project}。`;
      return artifactExists(artifactLookup.context, contextHint);
    }
    case "scope_map": {
      const scopeMapHint =
        readComplexityLevel(rootDir, sessionState.project) === "L1"
          ? `缺少 scope_map.json。Lite 流程请重新执行 /lite-prd（或 /prd-input --level L1）补全 scope_map.json。`
          : `缺少 scope_map.json。请先执行 /explore --project ${sessionState.project}。`;
      return artifactExists(artifactLookup.scope_map, scopeMapHint);
    }
    case "tech_design_confirmed":
      return techDesignConfirmed(rootDir, sessionState.project);
    case "tasks_confirmed":
      return tasksConfirmed(rootDir, sessionState.project);
    case "tech_design_confirmed_if_present":
      // Lite Flow（L1）下 tech_design 是唯一人工确认门，必须存在且已确认，不允许缺失
      if (readComplexityLevel(rootDir, sessionState.project) === "L1") {
        return techDesignConfirmed(rootDir, sessionState.project, false);
      }
      return techDesignConfirmed(rootDir, sessionState.project, true);
    case "tdd_compile_passed":
      return tddCompilePassed(rootDir, sessionState.project);
    default:
      return { ok: true };
  }
}

function artifactExists(artifact, reason) {
  if (artifact?.exists) {
    return { ok: true };
  }
  return { ok: false, reason };
}

function techDesignConfirmed(rootDir, project, allowMissing = false) {
  const relativePath = resolveArtifactPath(project, "tech_design");
  const raw = safeReadTextFile(rootDir, relativePath);
  if (!raw) {
    if (allowMissing) {
      return { ok: true };
    }
    return {
      ok: false,
      reason: `缺少 tech_design.md。请先执行 /tech-design --project ${project}。`,
    };
  }
  const { data } = parseFrontmatter(raw);
  if (data.pending_human_confirm === false) {
    return { ok: true };
  }
  return {
    ok: false,
    reason: `技术方案尚未确认。请先确认 ${resolveArtifactPath(project, "tech_design")}。`,
  };
}

// 读取需求复杂度档位（Lite Flow 标记）；无 level.json 时返回 null，按完整流程处理
function readComplexityLevel(rootDir, project) {
  if (!project) {
    return null;
  }
  const raw = safeReadTextFile(rootDir, `.prd/${project}/shared/level.json`);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed.level ?? null;
  } catch {
    return null;
  }
}

function tasksConfirmed(rootDir, project) {
  // Lite Flow（L1）跳过 plan-task，不产出 tasks.md；改由 tech-design 人工确认门兜底，这里直接放行
  if (readComplexityLevel(rootDir, project) === "L1") {
    return { ok: true };
  }
  const raw = safeReadTextFile(rootDir, resolveArtifactPath(project, "tasks"));
  if (!raw) {
    return {
      ok: false,
      reason: `缺少 tasks.md。请先执行 /plan-task --project ${project}。`,
    };
  }
  const { data } = parseFrontmatter(raw);
  if (data.human_confirmed === true) {
    return { ok: true };
  }
  return {
    ok: false,
    reason: `tasks.md 尚未人工确认。请先确认任务拆解后再执行 /tdd --project ${project}。`,
  };
}

function tddCompilePassed(rootDir, project) {
  const reportPath = resolveArtifactPath(project, "execution_report");
  const raw = safeReadTextFile(rootDir, reportPath);
  if (!raw) {
    return {
      ok: false,
      reason: `缺少 execution_report.md。请先执行 /tdd --project ${project}，并确保最终编译通过。`,
    };
  }

  const { data } = parseFrontmatter(raw);
  const compileGatePassed =
    String(data.compile_gate ?? "").toLowerCase() === "passed" ||
    /\bcompile_gate\s*[:=]\s*passed\b/i.test(raw) ||
    /\bfinal_compile\s*[:=]\s*passed\b/i.test(raw) ||
    /最终编译\s*(?:门禁)?\s*[:：]\s*(?:passed|通过)/i.test(raw);
  const readyForDelivery =
    data.ready_for_delivery === true ||
    String(data.ready_for_delivery ?? "").toLowerCase() === "true" ||
    /\bready_for_delivery\s*[:=]\s*true\b/i.test(raw);

  if (compileGatePassed && readyForDelivery) {
    return { ok: true };
  }

  return {
    ok: false,
    reason:
      `TDD 最终编译尚未通过，不能进入 /archive。请先运行 /tdd --project ${project}，` +
      `确保 ${reportPath} 中包含 compile_gate: passed 且 ready_for_delivery: true。`,
  };
}


function isWriteLikeTool(toolName) {
  return /write|edit|replace|apply_patch/i.test(toolName);
}

function allow(reason = null) {
  return { ok: true, continue: true, reason };
}

function block(reason) {
  return { ok: false, continue: false, decision: "block", reason };
}
