import fs from "node:fs";
import path from "node:path";
import {
  PROJECT_DOCUMENT_KEYS,
  PROJECT_LAYOUT_DIRECTORIES,
  PROJECT_PIPELINE_KEYS,
  MAIN_DOC_PRIORITY_KEYS,
  PRIMARY_DOC_BY_STAGE,
  getProjectArtifact,
  resolveArtifactPath,
} from "./artifact-catalog.mjs";
import { ensureDir, nowIso, parseFrontmatter } from "./utils.mjs";

export const ARTIFACT_PIPELINE = PROJECT_PIPELINE_KEYS.map((key) => {
  const artifact = getProjectArtifact(key);
  return {
    key,
    label: artifact.label,
    stage: artifact.stage,
    relativePath: artifact.relativePath,
  };
});

const PROJECT_DOCUMENTS = PROJECT_DOCUMENT_KEYS.map((key) => getProjectArtifact(key));

const BASELINE_REFERENCES = [
  { path: "AGENTS.md", label: "仓库规范", description: "工程规则与仓库约束（根目录优先）" },
  { path: ".vibe/AGENTS.md", label: "仓库规范（兼容）", description: "工程规则与仓库约束（兼容旧路径）" },
  { path: ".vibe/domain.md", label: "业务知识基线", description: "术语、规则与业务流程" },
  { path: ".vibe/index.md", label: "模板索引", description: "模板与样例入口" },
  { path: ".vibe/interfaces/index.md", label: "接口图谱总索引", description: "RPC/HTTP 功能域入口" },
  { path: ".archive/index.md", label: "归档索引", description: "历史项目归档入口" },
];

const STAGE_ORDER = [
  "prd_input",
  "explore",
  "tech_design",
  "plan_task",
  "tdd_execute",
  "archive",
];

const STAGE_LABELS = {
  prd_input: "需求输入与综合探索",
  explore: "综合探索",
  tech_design: "技术方案",
  plan_task: "任务拆解",
  tdd_execute: "TDD执行",
  archive: "已归档",
};

const STAGE_COMMANDS = {
  prd_input: "/prd-input <prd_url> --name {project}",
  explore: "/explore --project {project}  # 已有 PRD 重跑探索；新需求优先 /prd-input <PRD/文件/文本> --name {project}",
  tech_design: "/tech-design --project {project}",
  plan_task: "/plan-task --project {project}",
  tdd_execute: "/tdd --project {project}",
  archive: "/archive --project {project}",
};

export function scanProjects(rootDir) {
  const prdDir = path.join(rootDir, ".prd");
  if (!fs.existsSync(prdDir)) {
    return [];
  }

  const entries = fs.readdirSync(prdDir, { withFileTypes: true });
  const projects = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const projectName = entry.name;
    const projectDir = path.join(prdDir, projectName);
    projects.push(scanProjectStatus(rootDir, projectName, projectDir));
  }

  return projects.sort((a, b) => {
    if (a.archived !== b.archived) {
      return a.archived ? 1 : -1;
    }
    return (b.furthestStageIndex ?? -1) - (a.furthestStageIndex ?? -1);
  });
}

function scanProjectStatus(rootDir, projectName, projectDir) {
  const artifacts = {};
  for (const def of ARTIFACT_PIPELINE) {
    artifacts[def.key] = {
      key: def.key,
      exists: fs.existsSync(path.join(rootDir, resolveArtifactPath(projectName, def.key))),
      label: def.label,
      stage: def.stage,
      relativePath: def.relativePath,
    };
  }

  const documents = collectProjectDocuments(rootDir, projectName);
  const techDesignConfirmed = readTechDesignConfirmation(rootDir, projectName);
  const tasksConfirmed = readTasksConfirmation(rootDir, projectName);
  const archived = artifacts.archive.exists;

  let furthestStage = null;
  let furthestStageIndex = -1;
  for (const def of ARTIFACT_PIPELINE) {
    if (!artifacts[def.key].exists) {
      continue;
    }
    const index = STAGE_ORDER.indexOf(def.stage);
    if (index > furthestStageIndex) {
      furthestStageIndex = index;
      furthestStage = def.stage;
    }
  }

  const nextStage = determineNextStage(furthestStageIndex);
  const nextStepLabel = deriveNextStepLabel({
    artifacts,
    techDesignConfirmed,
    tasksConfirmed,
    nextStage,
    archived,
  });
  const recommendedCommand = deriveRecommendedCommand({
    projectName,
    artifacts,
    techDesignConfirmed,
    tasksConfirmed,
    nextStage,
    archived,
  });
  const primaryDoc = determinePrimaryDoc({
    furthestStage,
    techDesignConfirmed,
    tasksConfirmed,
    archived,
    documents,
  });
  const pendingItems = derivePendingItems({
    artifacts,
    techDesignConfirmed,
    tasksConfirmed,
    archived,
    nextStepLabel,
  });
  const updatedAt = determineUpdatedAt(rootDir, projectName, documents);

  return {
    name: projectName,
    artifacts,
    documents,
    furthestStage,
    furthestStageIndex,
    nextStage,
    nextStepLabel,
    techDesignConfirmed,
    tasksConfirmed,
    archived,
    updatedAt,
    primaryDoc,
    pendingItems,
    recommendedCommand,
  };
}

function collectProjectDocuments(rootDir, projectName) {
  const documents = {};
  for (const def of PROJECT_DOCUMENTS) {
    const relativePath = resolveArtifactPath(projectName, def.key);
    documents[def.key] = {
      ...def,
      path: relativePath,
      exists: fs.existsSync(path.join(rootDir, relativePath)),
    };
  }
  return documents;
}

function readArtifactFrontmatter(rootDir, projectName, key) {
  const relativePath = resolveArtifactPath(projectName, key);
  const absolutePath = path.join(rootDir, relativePath);
  if (!fs.existsSync(absolutePath)) {
    return null;
  }
  const raw = fs.readFileSync(absolutePath, "utf8");
  return { raw, data: parseFrontmatter(raw).data };
}

function readTechDesignConfirmation(rootDir, projectName) {
  const artifact = readArtifactFrontmatter(rootDir, projectName, "tech_design");
  return artifact ? artifact.data.pending_human_confirm === false : false;
}

function readTasksConfirmation(rootDir, projectName) {
  const artifact = readArtifactFrontmatter(rootDir, projectName, "tasks");
  return artifact ? artifact.data.human_confirmed === true : false;
}

function determineNextStage(furthestStageIndex) {
  if (furthestStageIndex < 0) {
    return "prd_input";
  }
  if (furthestStageIndex >= STAGE_ORDER.length - 1) {
    return null;
  }
  return STAGE_ORDER[furthestStageIndex + 1];
}

function deriveNextStepLabel({ artifacts, techDesignConfirmed, tasksConfirmed, nextStage, archived }) {
  if (archived) {
    return "已归档";
  }
  if (artifacts.tech_design.exists && !techDesignConfirmed) {
    return "下一步: 确认技术方案";
  }
  if (artifacts.tasks.exists && !tasksConfirmed) {
    return "下一步: 确认任务拆解";
  }
  if (nextStage) {
    return `下一步: ${STAGE_LABELS[nextStage]}`;
  }
  return "已完成全流程";
}

function deriveRecommendedCommand({ projectName, artifacts, techDesignConfirmed, tasksConfirmed, nextStage, archived }) {
  if (archived) {
    return null;
  }
  if (artifacts.tech_design.exists && !techDesignConfirmed) {
    return interpolateCommand(STAGE_COMMANDS.tech_design, projectName);
  }
  if (artifacts.tasks.exists && !tasksConfirmed) {
    return interpolateCommand(STAGE_COMMANDS.plan_task, projectName);
  }
  if (nextStage) {
    return interpolateCommand(STAGE_COMMANDS[nextStage], projectName);
  }
  return null;
}

function interpolateCommand(template, projectName) {
  return template.replaceAll("{project}", projectName);
}

function determinePrimaryDoc({ furthestStage, techDesignConfirmed, tasksConfirmed, archived, documents }) {
  if (archived && documents.archive?.exists) {
    return "archive";
  }
  if (documents.tasks?.exists && !tasksConfirmed) {
    return "tasks";
  }
  if (documents.tech_design?.exists && !techDesignConfirmed) {
    return "tech_design";
  }
  const candidateKey = PRIMARY_DOC_BY_STAGE[furthestStage] ?? null;
  if (candidateKey && documents[candidateKey]?.exists) {
    return candidateKey;
  }
  return MAIN_DOC_PRIORITY_KEYS.find((key) => documents[key]?.exists) ?? null;
}

function derivePendingItems({ artifacts, techDesignConfirmed, tasksConfirmed, archived, nextStepLabel }) {
  const items = [];
  if (artifacts.tech_design.exists && !techDesignConfirmed) {
    items.push("技术方案待确认");
  }
  if (artifacts.tasks.exists && !tasksConfirmed) {
    items.push("任务拆解待确认");
  }
  if (!archived && nextStepLabel && !nextStepLabel.startsWith("已完成") && !nextStepLabel.startsWith("已归档")) {
    items.push(nextStepLabel.replace(/^下一步:\s*/, ""));
  }
  if (!archived && artifacts.execution_report.exists && !artifacts.archive.exists) {
    items.push("TDD 已完成但尚未归档");
  }
  return [...new Set(items)];
}

function determineUpdatedAt(rootDir, projectName, documents) {
  let latest = null;
  for (const def of PROJECT_DOCUMENTS) {
    if (!documents[def.key]?.exists) {
      continue;
    }
    const absolutePath = path.join(rootDir, resolveArtifactPath(projectName, def.key));
    const stat = fs.statSync(absolutePath);
    if (!latest || stat.mtimeMs > latest.mtimeMs) {
      latest = stat;
    }
  }
  return latest ? latest.mtime.toISOString() : nowIso();
}

function determineLatestProjectUpdate(projects) {
  const timestamps = projects
    .map((project) => project.updatedAt)
    .filter(Boolean)
    .sort();
  return timestamps.length > 0 ? timestamps[timestamps.length - 1] : null;
}

function writeIfChanged(targetPath, nextContent) {
  const current = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, "utf8") : null;
  if (current === nextContent) {
    return;
  }
  fs.writeFileSync(targetPath, nextContent);
}

function ensureProjectLayout(projectDir) {
  for (const directory of PROJECT_LAYOUT_DIRECTORIES) {
    ensureDir(path.join(projectDir, directory));
  }
}

export function syncProjectIndexes(rootDir) {
  const prdDir = path.join(rootDir, ".prd");
  if (!fs.existsSync(prdDir)) {
    return;
  }

  ensureDir(prdDir);
  const projects = scanProjects(rootDir);

  for (const project of projects) {
    const projectDir = path.join(prdDir, project.name);
    ensureDir(projectDir);
    ensureProjectLayout(projectDir);
    writeIfChanged(path.join(projectDir, "index.md"), buildProjectIndexMarkdown(rootDir, project));
  }

  writeIfChanged(path.join(prdDir, "index.md"), buildProjectsIndexMarkdown(projects));
}

function buildProjectsIndexMarkdown(projects) {
  const activeProjects = projects.filter((project) => !project.archived);
  const archivedProjects = projects.filter((project) => project.archived);
  const latestProjectUpdate = determineLatestProjectUpdate(projects);
  const lines = [
    "---",
    `latest_project_update: "${latestProjectUpdate ?? "none"}"`,
    `active_projects: ${activeProjects.length}`,
    `archived_projects: ${archivedProjects.length}`,
    "---",
    "",
    "# 活动项目总览",
    "",
    "## 进行中项目",
    "",
  ];

  if (activeProjects.length === 0) {
    lines.push("当前没有进行中的项目。");
  } else {
    lines.push("| 项目 | 当前阶段 | 下一步 | 方案确认 | 任务确认 | 已归档 | 最近更新 |");
    lines.push("|------|---------|--------|---------|---------|--------|---------|");
    for (const project of activeProjects) {
      lines.push(
        `| [${project.name}](./${project.name}/index.md) | ${formatStageLabel(project.furthestStage)} | ${project.nextStepLabel} | ${formatConfirmation(project.techDesignConfirmed, project.artifacts.tech_design.exists)} | ${formatConfirmation(project.tasksConfirmed, project.artifacts.tasks.exists)} | 否 | ${project.updatedAt} |`
      );
    }
  }

  lines.push("", "## 已归档项目", "");
  if (archivedProjects.length === 0) {
    lines.push("当前没有已归档项目。");
  } else {
    lines.push("| 项目 | 当前阶段 | 最近更新 |");
    lines.push("|------|---------|---------|");
    for (const project of archivedProjects) {
      lines.push(`| [${project.name}](./${project.name}/index.md) | 已归档 | ${project.updatedAt} |`);
    }
    lines.push("", "完整归档历史请查看 `../.archive/index.md`。");
  }

  return `${lines.filter((line) => line !== null).join("\n")}\n`;
}

function buildProjectIndexMarkdown(rootDir, project) {
  const mainDocs = PROJECT_DOCUMENTS.filter((doc) => doc.layer === "主文档" && project.documents[doc.key]?.exists);
  const supportDocs = PROJECT_DOCUMENTS.filter((doc) => doc.layer === "结构化支撑" && project.documents[doc.key]?.exists);
  const baselineRefs = BASELINE_REFERENCES.filter((ref) => fs.existsSync(path.join(rootDir, ref.path)));
  const primaryDoc = project.primaryDoc ? PROJECT_DOCUMENTS.find((doc) => doc.key === project.primaryDoc) : null;
  const lines = [
    "---",
    `project: ${project.name}`,
    `current_stage: ${project.furthestStage ?? "none"}`,
    `next_step: "${project.nextStepLabel}"`,
    `tech_design_confirmed: ${project.techDesignConfirmed}`,
    `tasks_confirmed: ${project.tasksConfirmed}`,
    `archived: ${project.archived}`,
    `updated_at: "${project.updatedAt}"`,
    "---",
    "",
    `# ${project.name} — 项目主页`,
    "",
    "## 当前状态",
    "",
    "| 字段 | 值 |",
    "|------|------|",
    `| 当前阶段 | ${formatStageLabel(project.furthestStage)} |`,
    `| 下一步 | ${project.nextStepLabel} |`,
    `| 方案确认 | ${formatConfirmation(project.techDesignConfirmed, project.artifacts.tech_design.exists)} |`,
    `| 任务确认 | ${formatConfirmation(project.tasksConfirmed, project.artifacts.tasks.exists)} |`,
    `| 已归档 | ${project.archived ? "是" : "否"} |`,
    `| 最近更新 | ${project.updatedAt} |`,
    "",
    "## 下一步操作",
    "",
    `- 建议动作：${project.nextStepLabel}`,
    `- 推荐命令：${project.recommendedCommand ? `\`${project.recommendedCommand}\`` : "当前无推荐命令"}`,
    project.nextStage === "explore"
      ? "- 入口说明：新需求主路径是 `/prd-input <PRD/文件/文本> --name {project}` 一次完成输入与探索；当前项目已有 PRD 时可用 `/explore --project {project}` 重跑探索。"
      : null,
    "",
    "## 阶段产物总览",
    "",
    "| 分层 | 路径 | 状态 | 说明 |",
    "|------|------|------|------|",
    ...PROJECT_DOCUMENTS.map((doc) => {
      const entry = project.documents[doc.key];
      return `| ${doc.layer} | \`${doc.relativePath}\` | ${entry.exists ? "存在" : "缺失"} | ${doc.description} |`;
    }),
    "",
    "## 当前主文档",
    "",
  ];

  if (primaryDoc && project.documents[primaryDoc.key]?.exists) {
    lines.push(`- 优先查看: [${primaryDoc.relativePath}](./${primaryDoc.relativePath}) — ${primaryDoc.description}`);
  } else {
    lines.push("- 当前还没有可阅读的主文档。");
  }

  if (mainDocs.length > 0) {
    for (const doc of mainDocs) {
      if (primaryDoc && doc.key === primaryDoc.key) {
        continue;
      }
      lines.push(`- [${doc.relativePath}](./${doc.relativePath}) — ${doc.description}`);
    }
  }

  lines.push("", "## 辅助文档", "");
  if (supportDocs.length === 0 && baselineRefs.length === 0) {
    lines.push("- 当前没有辅助文档。");
  } else {
    for (const doc of supportDocs) {
      lines.push(`- [${doc.relativePath}](./${doc.relativePath}) — ${doc.layer}，${doc.description}`);
    }
    for (const ref of baselineRefs) {
      lines.push(`- [${ref.path}](${relativeBaselineLink(ref.path)}) — 基线引用，${ref.description}`);
    }
  }

  lines.push("", "## 确认状态", "");
  lines.push(`- 技术方案：${formatConfirmation(project.techDesignConfirmed, project.artifacts.tech_design.exists)}`);
  lines.push(`- 任务拆解：${formatConfirmation(project.tasksConfirmed, project.artifacts.tasks.exists)}`);

  lines.push("", "## 阻塞项/未完成项", "");
  if (project.pendingItems.length === 0) {
    lines.push("- 当前没有明显阻塞项。");
  } else {
    for (const item of project.pendingItems) {
      lines.push(`- ${item}`);
    }
  }

  lines.push("", "## 推荐命令", "");
  if (project.recommendedCommand) {
    lines.push(`- \`${project.recommendedCommand}\``);
    if (project.nextStage === "explore") {
      lines.push("- 新需求无需手动拆成 `/prd-input` + `/explore` 两步；`/explore` 仅用于已有 PRD 项目的探索重跑。");
    }
  } else if (project.archived) {
    lines.push("- 当前项目已归档，无需继续推进。");
  } else {
    lines.push("- 当前没有明确的下一步命令。");
  }

  return `${lines.join("\n")}\n`;
}

function relativeBaselineLink(target) {
  return `../../${target}`;
}

function formatStageLabel(stage) {
  return stage ? STAGE_LABELS[stage] ?? stage : "未开始";
}

function formatConfirmation(confirmed, exists) {
  if (!exists) {
    return "未生成";
  }
  return confirmed ? "已确认" : "未确认";
}

export function formatProjectsSummary(projects) {
  if (projects.length === 0) {
    return null;
  }

  const lines = [];

  for (const project of projects) {
    if (project.archived) {
      lines.push(`- **${project.name}** — 已归档`);
      continue;
    }

    const stageLabel = formatStageLabel(project.furthestStage);
    const artifactMarkers = ARTIFACT_PIPELINE
      .filter((def) => def.key !== "archive")
      .map((def) => (project.artifacts[def.key].exists ? `${def.label} ✓` : `${def.label} ✗`))
      .join(" | ");

    const confirmFlags = [];
    if (project.artifacts.tech_design.exists) {
      confirmFlags.push(project.techDesignConfirmed ? "方案已确认" : "方案未确认");
    }
    if (project.artifacts.tasks.exists) {
      confirmFlags.push(project.tasksConfirmed ? "任务已确认" : "任务未确认");
    }

    const confirmSummary = confirmFlags.length > 0 ? ` (${confirmFlags.join(", ")})` : "";
    lines.push(`- **${project.name}** — 进度: ${stageLabel} | ${project.nextStepLabel}${confirmSummary}`);
    lines.push(`  ${artifactMarkers}`);
  }

  return lines.join("\n");
}
