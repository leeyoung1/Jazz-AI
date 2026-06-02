import { buildStageArtifact } from "./artifact-catalog.mjs";

export const WORKFLOW_COMMANDS = {
  "/project-init": "bootstrap",
  "/prd-input": "prd_input",
  "/lite-prd": "prd_input",
  "/explore": "explore",
  "/biz-discovery": "explore",
  "/context-explore": "explore",
  "/tech-design": "tech_design",
  "/lite-design": "tech_design",
  "/plan-task": "plan_task",
  "/tdd": "tdd_execute",
  "/lite-tdd": "tdd_execute",
  "/tdd-execute": "tdd_execute",
  "/archive": "archive",
};

const BASELINE_ARTIFACTS = [
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
  {
    key: "interface_index",
    label: "接口图谱总索引",
    required: false,
    inject: "summary",
    candidates: [".vibe/interfaces/index.md"],
  },
  {
    key: "archive_index",
    label: "历史归档索引",
    required: false,
    inject: "summary",
    candidates: [".archive/index.md"],
  },
];

const TEMPLATE_REFERENCE_RULE =
  "若已注入模板索引或能找到相似现有实现，优先把模板与样例作为参考输入；这是推荐做法，不是强约束，无匹配时继续推进。";
const INTERFACE_REFERENCE_RULE =
  "若已注入接口图谱总索引，先用它把功能点锚定到候选功能域或候选 RPC/HTTP 边界；只在命中特定功能域时再按需读取对应 domain file。";
const INTERFACE_TECH_DESIGN_RULE =
  "技术方案阶段如涉及接口变化，优先消费 scope_map.json 中已由用户确认的 confirmed_interfaces；只有确认清单不存在、为空或仍为 pending 时，才基于接口图谱总索引和 domain file 走降级确认流程，且不得自行猜测接口身份。";
const INTERFACE_EXECUTION_RULE =
  "任务拆解和 TDD 阶段只继承技术方案中已确认的接口边界，在 execution_hints 或实现说明中引用功能域或接口 ID，不重新展开全量接口图谱。";

export const STAGE_REGISTRY = {
  bootstrap: {
    label: "Day0 基线注入与知识初始化",
    command: "/project-init",
    requiresProject: false,
    prerequisiteChecks: [],
    stageRules: [
      "当前处于 Day0 基线阶段，目标是建立仓库规范、模板和角色地图。",
      "输出应聚焦仓库基线产物，不应越级进入具体需求实现。",
    ],
    artifacts: [],
    baselineArtifacts: BASELINE_ARTIFACTS,
  },
  prd_input: {
    label: "阶段1 需求输入与综合探索",
    command: "/prd-input",
    requiresProject: false,
    prerequisiteChecks: [],
    stageRules: [
      "当前处于新需求主入口：先获取并结构化 PRD，再继续完成业务探索和代码上下文探索。",
      "禁止在 PRD 摘要或代码探索中途分散提问；业务和工程不确定项必须在探索完成后统一向用户确认。",
      "探索阶段采用主 Agent 扁平调度的并行 DAG：多个 Vertical Feature Agent 按功能点/功能组探索，多个 Template Reuse Agent 按已有模板进行复用匹配。",
      "subAgent 禁止再 spawn subAgent；如发现缺口只返回 follow_up_tasks，由主 Agent 统一补派、合并和写最终产物。",
      "所有 AI 判断必须带 PRD、历史归档或代码证据；纯方案决策记录到 question_backlog 并推迟到 tech-design。",
      TEMPLATE_REFERENCE_RULE,
      INTERFACE_REFERENCE_RULE,
    ],
    artifacts: [
      buildStageArtifact("prd", { required: false }),
      buildStageArtifact("biz_discovery", { required: false }),
      buildStageArtifact("question_backlog", { required: false }),
      buildStageArtifact("context", { required: false }),
      buildStageArtifact("scope_map", { required: false }),
    ],
    baselineArtifacts: BASELINE_ARTIFACTS,
  },
  explore: {
    label: "阶段2 综合探索（重跑/兼容）",
    command: "/explore",
    requiresProject: true,
    prerequisiteChecks: ["prd"],
    stageRules: [
      "上下文由 hooks 自动注入，不要把时间浪费在手工重新装配产物上。",
      "本阶段先做业务语义、边界和 backlog 重分类，再做代码范围定位与上下文分析。",
      "探索阶段采用主 Agent 扁平调度的并行 DAG：多个 Vertical Feature Agent 按功能点/功能组探索，多个 Template Reuse Agent 按已有模板进行复用匹配。",
      "subAgent 禁止再 spawn subAgent；如发现缺口只返回 follow_up_tasks，由主 Agent 统一补派、合并和写最终产物。",
      "仅在需要更深代码证据时按需打开原文件。",
      TEMPLATE_REFERENCE_RULE,
      INTERFACE_REFERENCE_RULE,
    ],
    artifacts: [
      buildStageArtifact("prd"),
      buildStageArtifact("biz_discovery", { required: false }),
      buildStageArtifact("question_backlog", { required: false }),
    ],
    baselineArtifacts: BASELINE_ARTIFACTS,
  },
  tech_design: {
    label: "阶段3a 技术方案",
    command: "/tech-design",
    requiresProject: true,
    prerequisiteChecks: ["context", "scope_map", "prd"],
    stageRules: [
      "阶段输入由 hooks 自动注入，重点是做方案决策，不是重新拼上下文。",
      "方案必须基于代码分析结果和 question backlog 的残留项。",
      TEMPLATE_REFERENCE_RULE,
      INTERFACE_REFERENCE_RULE,
      INTERFACE_TECH_DESIGN_RULE,
    ],
    artifacts: [
      buildStageArtifact("context"),
      buildStageArtifact("scope_map"),
      buildStageArtifact("prd"),
      buildStageArtifact("question_backlog", { required: false }),
    ],
    baselineArtifacts: BASELINE_ARTIFACTS,
  },
  plan_task: {
    label: "阶段3b 任务拆解",
    command: "/plan-task",
    requiresProject: true,
    prerequisiteChecks: ["tech_design_confirmed"],
    stageRules: [
      "拆解应直接消费已经注入的技术方案与上下文，不要重复做输入拼装。",
      "仅在验证文件路径或细节时按需打开原始产物。",
      TEMPLATE_REFERENCE_RULE,
      INTERFACE_EXECUTION_RULE,
    ],
    artifacts: [
      buildStageArtifact("tech_design"),
      buildStageArtifact("context"),
      buildStageArtifact("scope_map"),
    ],
    baselineArtifacts: BASELINE_ARTIFACTS,
  },
  tdd_execute: {
    label: "阶段4 TDD 执行",
    command: "/tdd",
    requiresProject: true,
    prerequisiteChecks: ["tasks_confirmed", "tech_design_confirmed_if_present"],
    stageRules: [
      "当前阶段的正式入口是 /tdd；/tdd-execute 仅作为兼容别名保留。",
      "hooks 已经预注入当前 Plan、执行计划索引或执行状态，主 Agent 不应从零开始装配。",
      "默认 /tdd 是轻量模式：执行范围仍是整个项目/指定 wave/指定 plan，但过程不做每 Plan 编译；只有显式 --full 才启用严格全量验证闭环。",
      "每个 Plan 必须由独立 subAgent 执行，主 Agent 只做 planner/executor/verifier 编排、修订路由与汇总；严格 --full 模式才默认启动 wave 级 tdd-test-writer。",
      "有核心业务行为、接口契约、状态流转或关键分支的 Plan 必须有测试；DTO、enum、常量、简单 mapper、无分支胶水代码可标记 unit_test_gate=not_required，但必须写明豁免原因。",
      "unit_test_gate 四态：passed（测试通过）、deferred（已写未执行）、not_required（低价值或不适合测试且有原因）、failed（必测但未写或失败）。",
      "test-writer 和 executor 禁止主动运行 Maven/Gradle/npm/pnpm/yarn/go/cargo 等重型编译、构建或全量测试命令；需要验证时标记 deferred_to_final_compile。",
      "tdd-verifier 分轻量 wave 验收和 final compile 验收：wave 只做测试价值/实现完整性检查；final compile 统一运行最小必要编译，默认跳过 checkstyle/spotbugs/pmd。",
      "compile_gate=passed 是交付硬门禁；未通过最终编译时不得设置 ready_for_delivery=true。",
      "verifier 发现 blocker 后进入修订循环，每轮必须先递增 iteration_count_by_wave 并写回 state.json；返工完成后必须再次回到 verifier/final compile，不能直接进入下一 Wave 或 execution_report。",
      "当 iteration_count_by_wave[wave] >= 3 时，不得再次启动 verifier，不得继续推进；必须报告用户修订上限、最后 issue 和人工介入建议。",
      "禁止在 subAgent prompt 中直接提供完整实现代码，只提供任务定义、上下文和约束。",
      "subAgent 返回后必须验证测试文件是否存在；只有 unit_test_gate=not_required 且有豁免原因时，缺测试文件才允许通过。",
      "最终回复必须明确给出下一步命令：TDD 全部通过且 compile_gate=passed 时提示 `/archive --project {project}`；若未通过则给出阻断原因和恢复/重试建议。",
      TEMPLATE_REFERENCE_RULE,
      INTERFACE_EXECUTION_RULE,
    ],
    artifacts: [
      buildStageArtifact("tasks", { required: false }),
      buildStageArtifact("tech_design"),
      buildStageArtifact("context"),
      buildStageArtifact("execution_plan_index", { required: false }),
      buildStageArtifact("execution_state", { required: false }),
      {
        key: "repo_index",
        label: "模板索引",
        required: false,
        inject: "summary",
        candidates: [".vibe/index.md"],
      },
    ],
    baselineArtifacts: BASELINE_ARTIFACTS,
  },
  archive: {
    label: "阶段5 归档与知识沉淀",
    command: "/archive",
    requiresProject: true,
    prerequisiteChecks: ["tdd_compile_passed"],
    stageRules: [
      "归档阶段输入由 hooks 自动汇总到当前上下文。",
      "知识沉淀必须基于已通过 TDD 与最终编译的产物，不要重新推断已完成阶段的事实。",
    ],
    artifacts: [
      buildStageArtifact("execution_report"),
      buildStageArtifact("tasks", { required: false }),
      buildStageArtifact("tech_design"),
      buildStageArtifact("context", { required: false }),
      buildStageArtifact("prd", { required: false }),
    ],
    baselineArtifacts: BASELINE_ARTIFACTS,
  },
};

export function getStageForCommand(commandName) {
  return WORKFLOW_COMMANDS[commandName] ?? null;
}

export function getStageConfig(stage) {
  return stage ? STAGE_REGISTRY[stage] ?? null : null;
}

export function listWorkflowCommands() {
  return Object.keys(WORKFLOW_COMMANDS);
}
