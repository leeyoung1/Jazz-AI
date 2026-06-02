import fs from "node:fs";
import path from "node:path";
import { resolveArtifactPath } from "./artifact-catalog.mjs";
import { ensureDir, nowIso, parseFrontmatter } from "./utils.mjs";

export function defaultPlanSlicePath(project, planId) {
  return resolveArtifactPath(project, "plan_slice", { planId });
}

export function ensurePlanSlice(rootDir, project, planId, slicePath = defaultPlanSlicePath(project, planId)) {
  const executionPlanPath = path.join(rootDir, resolveArtifactPath(project, "execution_plan", { planId }));
  if (fs.existsSync(executionPlanPath)) {
    const executionPlanRaw = fs.readFileSync(executionPlanPath, "utf8");
    const generatedAt = fs.statSync(executionPlanPath).mtime.toISOString();
    const metadata = extractExecutionPlanMetadata(executionPlanRaw, planId);
    const content = buildPlanSliceContent({
      project,
      planId,
      metadata,
      planSection: executionPlanRaw.trim(),
      generatedAt,
      sourceKind: "execution_plan",
      sourcePath: resolveArtifactPath(project, "execution_plan", { planId }),
    });
    const absoluteSlicePath = path.join(rootDir, slicePath);
    ensureDir(path.dirname(absoluteSlicePath));
    writeIfChanged(absoluteSlicePath, content);
    return slicePath;
  }

  const tasksPath = path.join(rootDir, resolveArtifactPath(project, "tasks"));
  if (!fs.existsSync(tasksPath)) {
    return null;
  }

  const tasksRaw = fs.readFileSync(tasksPath, "utf8");
  const generatedAt = fs.statSync(tasksPath).mtime.toISOString();
  const planSection = extractPlanSection(tasksRaw, planId);
  if (!planSection) {
    return null;
  }

  const metadata = extractPlanMetadata(planSection);
  const content = buildPlanSliceContent({
    project,
    planId,
    metadata,
    planSection,
    generatedAt,
    sourceKind: "tasks",
    sourcePath: resolveArtifactPath(project, "tasks"),
  });
  const absoluteSlicePath = path.join(rootDir, slicePath);
  ensureDir(path.dirname(absoluteSlicePath));
  writeIfChanged(absoluteSlicePath, content);
  return slicePath;
}

function extractPlanSection(tasksRaw, planId) {
  const lines = tasksRaw.split("\n");
  const planHeaderPattern = /^###\s+PLAN-\d+\b/;
  const targetPattern = new RegExp(`^###\\s+${escapeRegExp(planId)}\\b`);

  let start = -1;
  let end = lines.length;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (start === -1) {
      if (targetPattern.test(line)) {
        start = index;
      }
      continue;
    }
    if (index > start && planHeaderPattern.test(line)) {
      end = index;
      break;
    }
  }

  if (start === -1) {
    return null;
  }

  return lines.slice(start, end).join("\n").trim();
}

function extractPlanMetadata(planSection) {
  const metadata = {
    wave: null,
    depends_on: "无",
    requirements: "",
    files_modified: "",
  };

  const lines = planSection.split("\n");
  for (const line of lines) {
    const normalizedLine = line.replace(/^>\s*/, "").trim();
    const match = normalizedLine.match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/);
    if (!match) {
      continue;
    }
    const key = match[1].trim();
    const value = match[2].trim();
    if (key === "wave") {
      metadata.wave = value;
    } else if (key === "depends_on") {
      metadata.depends_on = value;
    } else if (key === "requirements") {
      metadata.requirements = value;
    } else if (key === "files_modified") {
      metadata.files_modified = value;
    }
  }

  return metadata;
}

function extractExecutionPlanMetadata(planRaw, planId) {
  const { data } = parseFrontmatter(planRaw);
  return {
    wave: data.wave ?? null,
    depends_on: data.depends_on ?? "无",
    requirements: data.requirements ?? "",
    files_modified: data.files_modified ?? data.files ?? "",
    source_plan: data.plan ?? data.plan_id ?? planId,
  };
}

function buildPlanSliceContent({ project, planId, metadata, planSection, generatedAt, sourceKind, sourcePath }) {
  const sourceLabel = sourceKind === "execution_plan" ? "execution plan" : "tasks";
  const needsTasksFallbackHint = sourceKind !== "execution_plan";
  const lines = [
    "---",
    `project: ${project}`,
    `plan: ${planId}`,
    `wave: ${metadata.wave ?? ""}`,
    `depends_on: "${escapeFrontmatter(metadata.depends_on)}"`,
    `requirements: "${escapeFrontmatter(metadata.requirements)}"`,
    `files_modified: "${escapeFrontmatter(metadata.files_modified)}"`,
    `generated_at: "${generatedAt ?? nowIso()}"`,
    `source_kind: "${sourceLabel}"`,
    `source_path: "${sourcePath}"`,
    `source_tasks: "${resolveArtifactPath(project, "tasks")}"`,
    `source_execution_plan: "${resolveArtifactPath(project, "execution_plan", { planId })}"`,
    `source_tech_design: "${resolveArtifactPath(project, "tech_design")}"`,
    `source_context: "${resolveArtifactPath(project, "context")}"`,
    "---",
    "",
    `# ${planId} — 执行切片`,
    "",
    sourceKind === "execution_plan" ? "## 当前执行计划" : "## 当前 Plan 定义",
    "",
    planSection,
    "",
    "## 相关文档路径提示",
    "",
    `- 当前执行计划: \`${resolveArtifactPath(project, "execution_plan", { planId })}\``,
    `- tasks 总表: \`${resolveArtifactPath(project, "tasks")}\``,
    `- 技术方案: \`${resolveArtifactPath(project, "tech_design")}\``,
    `- 上下文分析: \`${resolveArtifactPath(project, "context")}\``,
    "",
    "## 执行提醒",
    "",
    "- 你当前拿到的是当前 Plan 的最小切片，不是整份阶段文档。",
    needsTasksFallbackHint
      ? "- 如果当前上下文不够，请优先按需阅读：`tech_design.md` → `context.md` → `tasks.md`。"
      : `- 如果当前上下文不够，请优先按需阅读：\`${resolveArtifactPath(project, "execution_plan", { planId })}\` → \`${resolveArtifactPath(project, "tech_design")}\` → \`${resolveArtifactPath(project, "context")}\` → \`${resolveArtifactPath(project, "tasks")}\`。`,
    "- 不要默认重新加载所有阶段文档。",
    "",
  ];
  return lines.join("\n");
}

function writeIfChanged(targetPath, nextContent) {
  const current = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, "utf8") : null;
  if (current === nextContent) {
    return;
  }
  fs.writeFileSync(targetPath, nextContent);
}

function escapeFrontmatter(value) {
  return String(value ?? "").replaceAll("\"", "\\\"");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
