import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseCommand } from "../lib/command-parser.mjs";
import { formatProjectsSummary, scanProjects, syncProjectIndexes } from "../lib/project-scanner.mjs";
import { loadSessionState, saveSessionState, SESSION_SCHEMA_VERSION } from "../lib/session-store.mjs";
import { handleHookPayload, toClaudeCodeOutput } from "../router.mjs";

function createFixture() {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-hooks-"));
  fs.mkdirSync(path.join(rootDir, ".vibe"), { recursive: true });
  fs.mkdirSync(path.join(rootDir, ".vibe", "interfaces"), { recursive: true });
  fs.mkdirSync(path.join(rootDir, ".vibe", "interfaces", "domains"), { recursive: true });
  fs.writeFileSync(path.join(rootDir, ".vibe", "AGENTS.md"), "# AGENTS\n\n- Keep tests first.\n");
  fs.writeFileSync(path.join(rootDir, ".vibe", "index.md"), "# Index\n\n- flow-write\n");
  fs.writeFileSync(
    path.join(rootDir, ".vibe", "interfaces", "index.md"),
    [
      "# Interface Map",
      "",
      "## Repository Interface Profile",
      "",
      "- Shape: RPC proto map",
      "- Total domains: 1",
      "",
      "## Domain Index",
      "",
      "| Domain | Domain File | Domain Purpose |",
      "| --- | --- | --- |",
      "| demo | .vibe/interfaces/domains/demo.md | demo data read/write capability |",
      "",
    ].join("\n")
  );
  fs.writeFileSync(
    path.join(rootDir, ".vibe", "interfaces", "domains", "demo.md"),
    [
      "# Demo",
      "",
      "## Domain Summary",
      "",
      "Demo data read/write RPC capability inferred from service and method names.",
      "",
    ].join("\n")
  );
  writeProjectFiles(rootDir, "demo", {
    "01-prd/prd.md": "---\nproject: demo\ncore_features: 1\n---\n# Demo PRD\n\n## 核心功能点\n- A\n",
    "02-biz/discovery.md": "---\nproject: demo\n---\n# Biz Discovery\n\n- term mapping\n",
    "03-context/context.md": "---\nproject: demo\n---\n# Context\n\n## 改动点\n- touch module\n",
    "shared/question_backlog.json": '{"project":"demo","questions":[{"id":"Q1","status":"open"}]}\n',
    "shared/scope_map.json": JSON.stringify({ project: "demo", files: ["src/a.ts"] }, null, 2),
    "04-design/tech_design.md": "---\npending_human_confirm: false\n---\n# Tech Design\n",
    "05-tasks/tasks.md": buildTasksMarkdown({ humanConfirmed: true }),
    "06-execution/plans/INDEX.md": "# Execution Plans\n\n- PLAN-01\n- PLAN-02\n",
    "06-execution/plans/PLAN-01.md":
      "---\nplan: PLAN-01\nwave: 1\ndepends_on: 无\nrequirements: REQ-1\nfiles_modified: src/a.ts, tests/a.test.ts\n---\n# Execution Plan: PLAN-01\n\n## Test Specification\n- should write data\n\n## Implementation Plan\n- implement src/a.ts\n",
    "06-execution/state.json": JSON.stringify(
      {
        project: "demo",
        current_wave: 1,
        completed_plans: [],
        target_plans: ["PLAN-01", "PLAN-02"],
      },
      null,
      2
    ),
    "06-execution/execution_report.md":
      "---\nproject: demo\ncompile_gate: passed\nready_for_delivery: true\n---\n# Execution\n\ncompile_gate: passed\nready_for_delivery: true\n",
  });
  return rootDir;
}

function buildTasksMarkdown({ humanConfirmed }) {
  return [
    "---",
    `human_confirmed: ${humanConfirmed ? "true" : "false"}`,
    "---",
    "# Tasks",
    "",
    "### PLAN-01: Demo write flow",
    "",
    "> | 字段 | 值 |",
    "> |------|------|",
    "> | wave | 1 |",
    "> | depends_on | 无 |",
    "> | files_modified | src/a.ts, tests/a.test.ts |",
    "> | requirements | REQ-1 |",
    "",
    "**描述**: deliver demo write flow",
    "",
    "<tasks>",
    '<task type="auto">',
    "  <name>Implement demo write flow</name>",
    "  <files>src/a.ts, tests/a.test.ts</files>",
    "  <action>Implement PLAN-01 logic</action>",
    "  <verify>",
    "    <automated>npm test -- demo</automated>",
    "  </verify>",
    "  <done>demo flow exists</done>",
    "</task>",
    "</tasks>",
    "",
    "### PLAN-02: Demo read flow",
    "",
    "> | 字段 | 值 |",
    "> |------|------|",
    "> | wave | 1 |",
    "> | depends_on | 无 |",
    "> | files_modified | src/b.ts |",
    "> | requirements | REQ-2 |",
    "",
    "**描述**: deliver demo read flow",
    "",
    "<tasks>",
    '<task type="auto">',
    "  <name>Implement demo read flow</name>",
    "  <files>src/b.ts</files>",
    "  <action>Implement PLAN-02 logic</action>",
    "  <verify>",
    "    <automated>npm test -- demo-read</automated>",
    "  </verify>",
    "  <done>demo read flow exists</done>",
    "</task>",
    "</tasks>",
    "",
  ].join("\n");
}

function writeProjectFiles(rootDir, projectName, files) {
  const projectDir = path.join(rootDir, ".prd", projectName);
  fs.mkdirSync(projectDir, { recursive: true });
  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = path.join(projectDir, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content);
  }
}

function writeLevel(rootDir, projectName, level) {
  const target = path.join(rootDir, ".prd", projectName, "shared", "level.json");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify({ level, user_confirmed: true }, null, 2));
}

function assertSilentHookResponse(response) {
  assert.deepEqual(response, { continue: true });
  assert.equal(Object.hasOwn(response, "systemMessage"), false);
  assert.equal(Object.hasOwn(response, "additionalContext"), false);
}

// ── 命令解析 ──

test("parseCommand extracts stage parameters for /tdd", () => {
  const result = parseCommand("/tdd --project demo --plan PLAN-01 --wave 1");
  assert.equal(result.command, "/tdd");
  assert.equal(result.project, "demo");
  assert.equal(result.plan, "PLAN-01");
  assert.equal(result.wave, "1");
});

test("parseCommand recognizes lite flow commands", () => {
  for (const command of ["/lite-prd", "/lite-design", "/lite-tdd"]) {
    const result = parseCommand(`${command} --project demo`);
    assert.ok(result, `${command} should parse`);
    assert.equal(result.command, command);
  }
});

test("parseCommand returns null for removed internal commands", () => {
  assert.equal(parseCommand("/pipeline-deploy demo"), null);
  assert.equal(parseCommand("/env-regression demo"), null);
});

test("expanded command prompt resolves back to workflow command", async () => {
  const rootDir = createFixture();
  const response = await handleHookPayload({
    hook_event_name: "UserPromptSubmit",
    session_id: "session-expanded",
    cwd: rootDir,
    prompt:
      "执行 JazzAI 工作流的阶段3a：技术方案生成或解析。\n\n使用 `/tech-design` skill 执行。\n\n参数: --project demo\n\n请先加载 `.claude/skills/tech-design/SKILL.md`，然后按照其中的工作流执行。",
  });
  assert.equal(response.continue, true);
  assert.match(response.systemMessage, /阶段3a 技术方案/);
});

test("/tdd and /tdd-execute resolve to the same stage", async () => {
  const rootDir = createFixture();
  const first = await handleHookPayload({
    hook_event_name: "UserPromptSubmit",
    session_id: "session-tdd",
    cwd: rootDir,
    prompt: "/tdd --project demo",
  });
  const second = await handleHookPayload({
    hook_event_name: "UserPromptSubmit",
    session_id: "session-tdd-execute",
    cwd: rootDir,
    prompt: "/tdd-execute --project demo",
  });
  assert.match(first.systemMessage, /阶段4 TDD 执行/);
  assert.match(second.systemMessage, /阶段4 TDD 执行/);
});

// ── 上下文注入 ──

test("UserPromptSubmit injects stage context", async () => {
  const rootDir = createFixture();
  const response = await handleHookPayload({
    hook_event_name: "UserPromptSubmit",
    session_id: "session-inject",
    cwd: rootDir,
    prompt: "/tech-design --project demo",
  });
  assert.equal(response.continue, true);
  assert.match(response.systemMessage, /JazzAI hooks-first runtime is active/);
  assert.match(response.additionalContext, /## Injected Artifacts/);
  assert.match(response.additionalContext, /path: \.prd\/demo\/03-context\/context\.md/);
});

test("/prd-input injects expanded input and exploration guidance", async () => {
  const rootDir = createFixture();
  const response = await handleHookPayload({
    hook_event_name: "UserPromptSubmit",
    session_id: "session-prd",
    cwd: rootDir,
    prompt: "/prd-input text --name demo",
  });
  assert.equal(response.continue, true);
  assert.match(response.systemMessage, /阶段1 需求输入与综合探索/);
});

test("/explore remains available for existing PRD exploration reruns", async () => {
  const rootDir = createFixture();
  const response = await handleHookPayload({
    hook_event_name: "UserPromptSubmit",
    session_id: "session-explore",
    cwd: rootDir,
    prompt: "/explore --project demo",
  });
  assert.equal(response.continue, true);
  assert.match(response.systemMessage, /阶段2 综合探索/);
});

test("UserPromptSubmit injects template reminder for plan-task", async () => {
  const rootDir = createFixture();
  const response = await handleHookPayload({
    hook_event_name: "UserPromptSubmit",
    session_id: "session-plan-template",
    cwd: rootDir,
    prompt: "/plan-task --project demo",
  });
  assert.match(response.additionalContext, /Template Reference Reminder/);
});

test("activated session only injects continuation context for explicit continuation", async () => {
  const rootDir = createFixture();
  await handleHookPayload({
    hook_event_name: "UserPromptSubmit",
    session_id: "session-cont",
    cwd: rootDir,
    prompt: "/tech-design --project demo",
  });
  const plain = await handleHookPayload({
    hook_event_name: "UserPromptSubmit",
    session_id: "session-cont",
    cwd: rootDir,
    prompt: "随便说点什么",
  });
  assert.deepEqual(plain, { continue: true });

  const resume = await handleHookPayload({
    hook_event_name: "UserPromptSubmit",
    session_id: "session-cont",
    cwd: rootDir,
    prompt: "继续",
  });
  assert.equal(resume.continue, true);
  assert.match(resume.additionalContext, /Continuation After Compact/);
});

// ── 安静模式 ──

test("SessionStart stays silent even when JazzAI artifacts exist", async () => {
  const rootDir = createFixture();
  const response = await handleHookPayload({
    hook_event_name: "SessionStart",
    session_id: "session-start",
    cwd: rootDir,
  });
  assertSilentHookResponse(response);
});

test("plain prompt before workflow activation does not hydrate or inject context", async () => {
  const rootDir = createFixture();
  const response = await handleHookPayload({
    hook_event_name: "UserPromptSubmit",
    session_id: "session-plain",
    cwd: rootDir,
    prompt: "帮我看下这个函数",
  });
  assertSilentHookResponse(response);
});

test("non workflow lifecycle hooks stay silent before activation", async () => {
  const rootDir = createFixture();
  for (const eventName of ["PreToolUse", "PostToolUse", "SubagentStop", "PreCompact"]) {
    const response = await handleHookPayload({
      hook_event_name: eventName,
      session_id: `session-silent-${eventName}`,
      cwd: rootDir,
      tool_name: "Read",
    });
    assert.equal(response.continue, true);
  }
});

test("PostToolUse does not track artifacts before activation", async () => {
  const rootDir = createFixture();
  const response = await handleHookPayload({
    hook_event_name: "PostToolUse",
    session_id: "session-pretrack",
    cwd: rootDir,
    tool_name: "Write",
    tool_input: { file_path: path.join(rootDir, ".prd", "demo", "04-design", "tech_design.md") },
  });
  assert.deepEqual(response, { continue: true });
});

// ── 项目扫描与索引 ──

test("project scanner generates project management indexes", async () => {
  const rootDir = createFixture();
  syncProjectIndexes(rootDir);
  const projectIndex = fs.readFileSync(path.join(rootDir, ".prd", "demo", "index.md"), "utf8");
  assert.match(projectIndex, /# demo — 项目主页/);
  assert.match(projectIndex, /shared\/question_backlog\.json/);
  const globalIndex = fs.readFileSync(path.join(rootDir, ".prd", "index.md"), "utf8");
  assert.match(globalIndex, /# 活动项目总览/);
  assert.match(globalIndex, /\[demo\]/);
});

test("project scanner does not surface removed regression column", () => {
  const rootDir = createFixture();
  syncProjectIndexes(rootDir);
  const globalIndex = fs.readFileSync(path.join(rootDir, ".prd", "index.md"), "utf8");
  assert.doesNotMatch(globalIndex, /环境回归/);
  const projectIndex = fs.readFileSync(path.join(rootDir, ".prd", "demo", "index.md"), "utf8");
  assert.doesNotMatch(projectIndex, /环境回归/);
});

test("project summary surfaces active project progress", () => {
  const rootDir = createFixture();
  const projects = scanProjects(rootDir);
  const summary = formatProjectsSummary(projects);
  assert.match(summary, /demo/);
});

test("project index surfaces pending tech design confirmation", async () => {
  const rootDir = createFixture();
  writeProjectFiles(rootDir, "demo", {
    "04-design/tech_design.md": "---\npending_human_confirm: true\n---\n# Tech Design\n",
  });
  syncProjectIndexes(rootDir);
  const projectIndex = fs.readFileSync(path.join(rootDir, ".prd", "demo", "index.md"), "utf8");
  assert.match(projectIndex, /技术方案待确认|未确认/);
});

test("archived projects are moved out of active view", async () => {
  const rootDir = createFixture();
  writeProjectFiles(rootDir, "demo", {
    "07-archive/archive.md": "---\nproject: demo\n---\n# Archive\n",
  });
  syncProjectIndexes(rootDir);
  const globalIndex = fs.readFileSync(path.join(rootDir, ".prd", "index.md"), "utf8");
  assert.match(globalIndex, /## 已归档项目/);
});

test("PostToolUse refreshes management indexes after artifact changes", async () => {
  const rootDir = createFixture();
  await handleHookPayload({
    hook_event_name: "UserPromptSubmit",
    session_id: "session-refresh",
    cwd: rootDir,
    prompt: "/tech-design --project demo",
  });
  const response = await handleHookPayload({
    hook_event_name: "PostToolUse",
    session_id: "session-refresh",
    cwd: rootDir,
    tool_name: "Write",
    tool_input: { file_path: path.join(rootDir, ".prd", "demo", "04-design", "tech_design.md") },
  });
  assert.equal(response.continue, true);
  assert.match(response.additionalContext, /Hook artifact tracker updated/);
  assert.ok(fs.existsSync(path.join(rootDir, ".prd", "index.md")));
});

test("PostToolUse ignores read-only tools even when artifact paths are present", async () => {
  const rootDir = createFixture();
  await handleHookPayload({
    hook_event_name: "UserPromptSubmit",
    session_id: "session-readonly",
    cwd: rootDir,
    prompt: "/tech-design --project demo",
  });
  const response = await handleHookPayload({
    hook_event_name: "PostToolUse",
    session_id: "session-readonly",
    cwd: rootDir,
    tool_name: "Read",
    tool_input: { file_path: path.join(rootDir, ".prd", "demo", "04-design", "tech_design.md") },
  });
  assert.deepEqual(response, { continue: true });
});

// ── Plan Slice ──

test("SubagentStart injects plan slice from execution plan instead of full stage documents", async () => {
  const rootDir = createFixture();
  const response = await handleHookPayload({
    hook_event_name: "SubagentStart",
    session_id: "session-slice",
    cwd: rootDir,
    prompt: "VIBE_TDD_PLAN_META project=demo plan=PLAN-01",
  });
  assert.equal(response.continue, true);
  assert.match(response.additionalContext, /Plan Slice Guidance/);
  const slicePath = path.join(rootDir, ".prd", "demo", "06-execution", "slices", "PLAN-01.md");
  assert.ok(fs.existsSync(slicePath));
});

// ── 阶段门控 ──

test("/tech-design is blocked when context is missing", async () => {
  const rootDir = createFixture();
  fs.rmSync(path.join(rootDir, ".prd", "demo", "03-context", "context.md"));
  const response = await handleHookPayload({
    hook_event_name: "UserPromptSubmit",
    session_id: "session-block-context",
    cwd: rootDir,
    prompt: "/tech-design --project demo",
  });
  assert.equal(response.continue, false);
  assert.equal(response.decision, "block");
  assert.match(response.reason, /上下文分析/);
});

test("/plan-task is blocked when tech design is not confirmed", async () => {
  const rootDir = createFixture();
  writeProjectFiles(rootDir, "demo", {
    "04-design/tech_design.md": "---\npending_human_confirm: true\n---\n# Tech Design\n",
  });
  const response = await handleHookPayload({
    hook_event_name: "UserPromptSubmit",
    session_id: "session-block-plan",
    cwd: rootDir,
    prompt: "/plan-task --project demo",
  });
  assert.equal(response.continue, false);
  assert.match(response.reason, /技术方案/);
});

test("/tdd is blocked when tasks are not confirmed", async () => {
  const rootDir = createFixture();
  writeProjectFiles(rootDir, "demo", {
    "05-tasks/tasks.md": buildTasksMarkdown({ humanConfirmed: false }),
  });
  const response = await handleHookPayload({
    hook_event_name: "UserPromptSubmit",
    session_id: "session-block-tdd",
    cwd: rootDir,
    prompt: "/tdd --project demo",
  });
  assert.equal(response.continue, false);
  assert.match(response.reason, /tasks\.md 尚未人工确认/);
});

test("/archive is blocked until TDD final compile passes", async () => {
  const rootDir = createFixture();
  writeProjectFiles(rootDir, "demo", {
    "06-execution/execution_report.md":
      "---\nproject: demo\ncompile_gate: failed\nready_for_delivery: false\n---\n# Execution\n",
  });
  const response = await handleHookPayload({
    hook_event_name: "UserPromptSubmit",
    session_id: "session-block-archive",
    cwd: rootDir,
    prompt: "/archive --project demo",
  });
  assert.equal(response.continue, false);
  assert.match(response.reason, /最终编译尚未通过/);
});

test("/archive accepts TDD report with passed compile gate", async () => {
  const rootDir = createFixture();
  const response = await handleHookPayload({
    hook_event_name: "UserPromptSubmit",
    session_id: "session-archive-ok",
    cwd: rootDir,
    prompt: "/archive --project demo",
  });
  assert.equal(response.continue, true);
  assert.match(response.systemMessage, /阶段5 归档/);
});

test("UserPromptSubmit blocks missing prerequisites", async () => {
  const rootDir = createFixture();
  fs.rmSync(path.join(rootDir, ".prd", "demo", "01-prd", "prd.md"));
  const response = await handleHookPayload({
    hook_event_name: "UserPromptSubmit",
    session_id: "session-block-prereq",
    cwd: rootDir,
    prompt: "/explore --project demo",
  });
  assert.equal(response.continue, false);
  assert.match(response.reason, /PRD/);
});

// ── Lite Flow ──

test("Lite Flow (L1) allows /tdd without tasks.md", async () => {
  const rootDir = createFixture();
  fs.rmSync(path.join(rootDir, ".prd", "demo", "05-tasks", "tasks.md"));
  writeLevel(rootDir, "demo", "L1");
  const response = await handleHookPayload({
    hook_event_name: "UserPromptSubmit",
    session_id: "session-lite-tdd",
    cwd: rootDir,
    prompt: "/tdd --project demo",
  });
  assert.equal(response.continue, true);
  assert.match(response.systemMessage, /阶段4 TDD 执行/);
});

test("Lite Flow (L1) still requires tech_design to be confirmed before /tdd", async () => {
  const rootDir = createFixture();
  fs.rmSync(path.join(rootDir, ".prd", "demo", "05-tasks", "tasks.md"));
  writeLevel(rootDir, "demo", "L1");
  writeProjectFiles(rootDir, "demo", {
    "04-design/tech_design.md": "---\npending_human_confirm: true\n---\n# Tech Design\n",
  });
  const response = await handleHookPayload({
    hook_event_name: "UserPromptSubmit",
    session_id: "session-lite-block",
    cwd: rootDir,
    prompt: "/tdd --project demo",
  });
  assert.equal(response.continue, false);
  assert.match(response.reason, /技术方案/);
});

test("/lite-tdd routes to tdd_execute and allows L1 without tasks.md", async () => {
  const rootDir = createFixture();
  fs.rmSync(path.join(rootDir, ".prd", "demo", "05-tasks", "tasks.md"));
  writeLevel(rootDir, "demo", "L1");
  const response = await handleHookPayload({
    hook_event_name: "UserPromptSubmit",
    session_id: "session-lite-tdd-cmd",
    cwd: rootDir,
    prompt: "/lite-tdd --project demo",
  });
  assert.equal(response.continue, true);
  assert.match(response.systemMessage, /阶段4 TDD 执行/);
});

test("/lite-design routes to tech_design and passes with lite prd artifacts", async () => {
  const rootDir = createFixture();
  writeLevel(rootDir, "demo", "L1");
  const response = await handleHookPayload({
    hook_event_name: "UserPromptSubmit",
    session_id: "session-lite-design",
    cwd: rootDir,
    prompt: "/lite-design --project demo",
  });
  assert.equal(response.continue, true);
  assert.match(response.systemMessage, /阶段3a 技术方案/);
});

// ── 执行状态恢复 ──

test("/tdd handles missing execution state predictably", async () => {
  const rootDir = createFixture();
  fs.rmSync(path.join(rootDir, ".prd", "demo", "06-execution", "state.json"));
  const response = await handleHookPayload({
    hook_event_name: "UserPromptSubmit",
    session_id: "session-no-state",
    cwd: rootDir,
    prompt: "/tdd --project demo",
  });
  assert.equal(response.continue, true);
});

test("/tdd handles corrupt execution state predictably", async () => {
  const rootDir = createFixture();
  writeProjectFiles(rootDir, "demo", {
    "06-execution/state.json": "{ not valid json",
  });
  const response = await handleHookPayload({
    hook_event_name: "UserPromptSubmit",
    session_id: "session-corrupt-state",
    cwd: rootDir,
    prompt: "/tdd --project demo",
  });
  assert.equal(response.continue, true);
});

// ── 安全策略 ──

test("PreToolUse and PermissionRequest do not block destructive commands", async () => {
  const rootDir = createFixture();
  await handleHookPayload({
    hook_event_name: "UserPromptSubmit",
    session_id: "session-destructive",
    cwd: rootDir,
    prompt: "/tdd --project demo",
  });
  const preToolUse = await handleHookPayload({
    hook_event_name: "PreToolUse",
    session_id: "session-destructive",
    cwd: rootDir,
    tool_name: "Bash",
    tool_input: { command: "rm -rf /" },
  });
  assert.equal(preToolUse.continue, true);
  assert.notEqual(preToolUse.decision, "block");

  const permission = await handleHookPayload({
    hook_event_name: "PermissionRequest",
    session_id: "session-destructive",
    cwd: rootDir,
    tool_name: "Bash",
  });
  assert.equal(permission.continue, true);
  assert.equal(permission.decision, "approve");
});

// ── 会话存储 ──

test("session store migrates legacy session payloads", () => {
  const rootDir = createFixture();
  const sessionsDir = path.join(rootDir, ".claude", "jazzai", "runtime", "sessions");
  fs.mkdirSync(sessionsDir, { recursive: true });
  fs.writeFileSync(
    path.join(sessionsDir, "legacy.json"),
    JSON.stringify({ session_id: "legacy", workflow_active: true, stage: "tdd_execute" })
  );
  const state = loadSessionState(rootDir, "legacy");
  assert.equal(state.schema_version, SESSION_SCHEMA_VERSION);
  assert.ok("tech_design_confirmed" in state.confirmations);
  assert.equal("regression_passed" in state.confirmations, false);
});

// ── Claude Code 输出适配层 ──
// 验证内部响应结构被正确翻译为 CC 官方 hook wire schema

test("adapter nests additionalContext into hookSpecificOutput with hookEventName", () => {
  const output = toClaudeCodeOutput(
    { continue: true, additionalContext: "ctx" },
    "SessionStart"
  );
  assert.equal(output.continue, true);
  assert.equal(output.hookSpecificOutput.hookEventName, "SessionStart");
  assert.equal(output.hookSpecificOutput.additionalContext, "ctx");
  // 顶层不得再出现 additionalContext（CC 会静默忽略顶层字段）
  assert.equal("additionalContext" in output, false);
});

test("adapter keeps systemMessage at top level and nests additionalContext", () => {
  const output = toClaudeCodeOutput(
    { continue: true, systemMessage: "sm", additionalContext: "ctx" },
    "UserPromptSubmit"
  );
  assert.equal(output.systemMessage, "sm");
  assert.equal(output.hookSpecificOutput.hookEventName, "UserPromptSubmit");
  assert.equal(output.hookSpecificOutput.additionalContext, "ctx");
});

test("adapter maps UserPromptSubmit block to top-level decision/reason", () => {
  const output = toClaudeCodeOutput(
    { continue: false, decision: "block", reason: "gate failed" },
    "UserPromptSubmit"
  );
  assert.equal(output.continue, false);
  assert.equal(output.decision, "block");
  assert.equal(output.reason, "gate failed");
  // UserPromptSubmit 用顶层 decision，不应转成 permissionDecision
  assert.equal("hookSpecificOutput" in output, false);
});

test("adapter maps PreToolUse block to hookSpecificOutput.permissionDecision deny", () => {
  const output = toClaudeCodeOutput(
    { continue: false, decision: "block", reason: "no business code in plan stage" },
    "PreToolUse"
  );
  assert.equal(output.hookSpecificOutput.hookEventName, "PreToolUse");
  assert.equal(output.hookSpecificOutput.permissionDecision, "deny");
  assert.equal(output.hookSpecificOutput.permissionDecisionReason, "no business code in plan stage");
  // PreToolUse 不使用顶层 decision
  assert.equal("decision" in output, false);
});

test("adapter maps PermissionRequest approve to permissionDecision allow", () => {
  const output = toClaudeCodeOutput(
    { continue: true, decision: "approve" },
    "PermissionRequest"
  );
  assert.equal(output.hookSpecificOutput.hookEventName, "PermissionRequest");
  assert.equal(output.hookSpecificOutput.permissionDecision, "allow");
});

test("adapter passes through bare continue without hookSpecificOutput", () => {
  const output = toClaudeCodeOutput({ continue: true }, "PostToolUse");
  assert.deepEqual(output, { continue: true });
});

test("adapter end-to-end: PermissionRequest produces allow schema", async () => {
  // 直接喂引擎一个真实事件，验证 handleHookPayload→adapter 全链路输出合法
  const internal = await handleHookPayload({
    hook_event_name: "PermissionRequest",
    session_id: "perm",
    cwd: os.tmpdir(),
  });
  const output = toClaudeCodeOutput(internal, "PermissionRequest");
  assert.equal(output.hookSpecificOutput.permissionDecision, "allow");
});

test("empty session id falls back to default-session", async () => {
  const rootDir = createFixture();
  const response = await handleHookPayload({
    hook_event_name: "SessionStart",
    cwd: rootDir,
  });
  assert.equal(response.continue, true);
});
