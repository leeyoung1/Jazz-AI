export const PROJECT_LAYOUT_DIRECTORIES = [
  "shared",
  "01-prd",
  "02-biz",
  "03-context",
  "04-design",
  "05-tasks",
  "06-execution",
  "06-execution/slices",
  "06-execution/plans",
  "07-archive",
];

const FIXED_PROJECT_ARTIFACT_DEFINITIONS = [
  {
    key: "prd",
    label: "PRD 文档",
    stage: "prd_input",
    relativePath: "01-prd/prd.md",
    layer: "主文档",
    description: "PRD 原文与结构化提炼的单一来源",
  },
  {
    key: "biz_discovery",
    label: "业务探索",
    stage: "explore",
    relativePath: "02-biz/discovery.md",
    layer: "主文档",
    description: "业务语义、边界与待确认假设",
  },
  {
    key: "question_backlog",
    label: "问题待办",
    stage: "explore",
    relativePath: "shared/question_backlog.json",
    layer: "结构化支撑",
    description: "跨阶段流转的问题清单",
  },
  {
    key: "context",
    label: "上下文分析",
    stage: "explore",
    relativePath: "03-context/context.md",
    layer: "主文档",
    description: "现有逻辑、改动点与风险分析",
  },
  {
    key: "scope_map",
    label: "范围定位地图",
    stage: "explore",
    relativePath: "shared/scope_map.json",
    layer: "结构化支撑",
    description: "功能点到文件范围的映射",
  },
  {
    key: "tech_design",
    label: "技术方案",
    stage: "tech_design",
    relativePath: "04-design/tech_design.md",
    layer: "主文档",
    description: "方案设计与改造策略",
  },
  {
    key: "tasks",
    label: "任务拆解",
    stage: "plan_task",
    relativePath: "05-tasks/tasks.md",
    layer: "主文档",
    description: "Wave 与 Plan 任务列表",
  },
  {
    key: "execution_plan_index",
    label: "执行计划索引",
    stage: "tdd_execute",
    relativePath: "06-execution/plans/INDEX.md",
    layer: "结构化支撑",
    description: "TDD planner 生成的 Plan 级测试/实现计划索引",
  },
  {
    key: "execution_state",
    label: "执行状态",
    stage: "tdd_execute",
    relativePath: "06-execution/state.json",
    layer: "结构化支撑",
    description: "Wave 进度、issue 收敛和重试状态",
  },
  {
    key: "execution_report",
    label: "执行报告",
    stage: "tdd_execute",
    relativePath: "06-execution/execution_report.md",
    layer: "主文档",
    description: "TDD 执行结果与门禁状态",
  },
  {
    key: "archive",
    label: "归档",
    stage: "archive",
    relativePath: "07-archive/archive.md",
    layer: "主文档",
    description: "本项目的最终归档入口",
  },
];

const PLAN_SLICE_DEFINITION = {
  key: "plan_slice",
  label: "Plan 切片",
  stage: "tdd_execute",
  relativePath: "06-execution/slices/{plan}.md",
  layer: "派生产物",
  description: "由 hooks 从 execution plan 或 tasks 回退生成的单 Plan 最小切片",
  derived: true,
};

const EXECUTION_PLAN_DEFINITION = {
  key: "execution_plan",
  label: "单 Plan 执行计划",
  stage: "tdd_execute",
  relativePath: "06-execution/plans/{plan}.md",
  layer: "派生产物",
  description: "由 TDD planner 生成的单 Plan 测试/实现计划",
  derived: true,
};

const FIXED_PROJECT_ARTIFACTS = FIXED_PROJECT_ARTIFACT_DEFINITIONS.map((artifact) => ({
  ...artifact,
  directory: artifact.relativePath.includes("/") ? artifact.relativePath.split("/").slice(0, -1).join("/") : ".",
  file: artifact.relativePath.split("/").at(-1),
  pathTemplate: `.prd/{project}/${artifact.relativePath}`,
}));

export const PROJECT_ARTIFACTS = [
  ...FIXED_PROJECT_ARTIFACTS,
  {
    ...EXECUTION_PLAN_DEFINITION,
    directory: "06-execution/plans",
    file: "{plan}.md",
    pathTemplate: `.prd/{project}/${EXECUTION_PLAN_DEFINITION.relativePath}`,
  },
  {
    ...PLAN_SLICE_DEFINITION,
    directory: "06-execution/slices",
    file: "{plan}.md",
    pathTemplate: `.prd/{project}/${PLAN_SLICE_DEFINITION.relativePath}`,
  },
];

const PROJECT_ARTIFACTS_BY_KEY = new Map(PROJECT_ARTIFACTS.map((artifact) => [artifact.key, artifact]));
const FIXED_ARTIFACTS_BY_RELATIVE_PATH = new Map(FIXED_PROJECT_ARTIFACTS.map((artifact) => [artifact.relativePath, artifact]));

export const PROJECT_PIPELINE_KEYS = FIXED_PROJECT_ARTIFACTS.filter((artifact) => artifact.layer === "主文档").map((artifact) => artifact.key);

export const PROJECT_DOCUMENT_KEYS = FIXED_PROJECT_ARTIFACTS.map((artifact) => artifact.key);

export const MAIN_DOC_PRIORITY_KEYS = [
  "archive",
  "execution_report",
  "tasks",
  "tech_design",
  "context",
  "biz_discovery",
  "prd",
];

export const PRIMARY_DOC_BY_STAGE = {
  prd_input: "prd",
  explore: "context",
  tech_design: "tech_design",
  plan_task: "tasks",
  tdd_execute: "execution_report",
  archive: "archive",
};

export function listProjectArtifacts({ includeDerived = false } = {}) {
  if (includeDerived) {
    return [...PROJECT_ARTIFACTS];
  }
  return [...FIXED_PROJECT_ARTIFACTS];
}

export function getProjectArtifact(key) {
  return PROJECT_ARTIFACTS_BY_KEY.get(key) ?? null;
}

export function resolveProjectRelativePath(key, options = {}) {
  if (key === "execution_plan") {
    if (!options.planId) {
      throw new Error("execution_plan requires options.planId");
    }
    return EXECUTION_PLAN_DEFINITION.relativePath.replace("{plan}", `${options.planId}`);
  }
  if (key === "plan_slice") {
    if (!options.planId) {
      throw new Error("plan_slice requires options.planId");
    }
    return PLAN_SLICE_DEFINITION.relativePath.replace("{plan}", `${options.planId}`);
  }
  const artifact = getProjectArtifact(key);
  if (!artifact || artifact.derived) {
    throw new Error(`Unknown fixed artifact key: ${key}`);
  }
  return artifact.relativePath;
}

export function resolveArtifactPath(project, key, options = {}) {
  if (!project) {
    throw new Error(`Artifact ${key} requires a project name`);
  }
  return `.prd/${project}/${resolveProjectRelativePath(key, options)}`;
}

export function buildStageArtifact(key, overrides = {}) {
  const artifact = getProjectArtifact(key);
  if (!artifact || artifact.derived) {
    throw new Error(`Cannot build stage artifact descriptor for key: ${key}`);
  }
  return {
    key,
    label: artifact.label,
    required: true,
    inject: "summary",
    candidates: [artifact.pathTemplate],
    discoverFilename: artifact.discoverFilename,
    ...overrides,
  };
}

export function matchArtifactPath(relativePath) {
  const normalized = relativePath.replaceAll("\\", "/");
  const match = normalized.match(/^\.prd\/([^/]+)\/(.+)$/u);
  if (!match) {
    return null;
  }

  const [, project, projectRelativePath] = match;
  const fixedArtifact = FIXED_ARTIFACTS_BY_RELATIVE_PATH.get(projectRelativePath);
  if (fixedArtifact) {
    return {
      project,
      key: fixedArtifact.key,
      artifact: fixedArtifact,
      relativePath: normalized,
      projectRelativePath,
    };
  }

  const executionPlanMatch = projectRelativePath.match(/^06-execution\/plans\/([^/]+)\.md$/u);
  if (executionPlanMatch && executionPlanMatch[1] !== "INDEX") {
    return {
      project,
      key: "execution_plan",
      artifact: PROJECT_ARTIFACTS_BY_KEY.get("execution_plan"),
      relativePath: normalized,
      projectRelativePath,
      planId: executionPlanMatch[1],
    };
  }

  const planSliceMatch = projectRelativePath.match(/^06-execution\/slices\/([^/]+)\.md$/u);
  if (planSliceMatch) {
    return {
      project,
      key: "plan_slice",
      artifact: PROJECT_ARTIFACTS_BY_KEY.get("plan_slice"),
      relativePath: normalized,
      projectRelativePath,
      planId: planSliceMatch[1],
    };
  }

  return null;
}
