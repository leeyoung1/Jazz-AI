import { getStageConfig } from "./stage-registry.mjs";
import { truncate } from "./utils.mjs";


export function buildStageContext({
  commandInfo,
  sessionState,
  artifacts,
  rootDir,
}) {
  const stageConfig = getStageConfig(sessionState.stage);
  const availableArtifacts = artifacts.filter((artifact) => artifact.exists);
  const missingRequired = artifacts.filter((artifact) => artifact.required && !artifact.exists);
  const stageRules = stageConfig?.stageRules ?? [];
  const hasTemplateIndex = availableArtifacts.some((artifact) => artifact.key === "repo_index");
  const hasInterfaceIndex = availableArtifacts.some((artifact) => artifact.key === "interface_index");

  const systemMessage = [
    "JazzAI hooks-first runtime is active.",
    `Current stage: ${stageConfig?.label ?? sessionState.stage}.`,
    `Current command: ${commandInfo?.raw ?? sessionState.current_command ?? "none"}`,
    `Current project: ${sessionState.project ?? "none"}`,
    "Do not rebuild stage context from scratch. Use the injected bundle first and open source files only when deeper evidence is needed.",
    ...stageRules.map((rule, index) => `RULE ${index + 1}: ${rule}`),
  ].join("\n\n");

  const additionalSections = [
    "## Hook Context Bundle",
    `stage=${sessionState.stage ?? "none"}`,
    `project=${sessionState.project ?? "none"}`,
    `plan=${sessionState.plan_id ?? "none"}`,
    `wave=${sessionState.wave ?? "none"}`,
  ];

  if (availableArtifacts.length > 0) {
    additionalSections.push(
      "## Injected Artifacts",
      ...availableArtifacts.map(
        (artifact) =>
          `### ${artifact.label}\npath: ${artifact.path}\n${truncate(artifact.summary ?? "", 1800)}`
      )
    );
  }

  if (hasTemplateIndex) {
    additionalSections.push(
      "## Template Reference Reminder",
      "已注入模板索引。优先把模板和现有相似代码作为参考输入，先想复用途径和差量实现，再展开通用方案；这只是推荐做法，不构成强约束。"
    );
  }

  if (hasInterfaceIndex) {
    additionalSections.push(
      "## Interface Reference Reminder",
      "已注入接口图谱总索引。先用它把需求功能点锚定到候选功能域或候选 RPC/HTTP 边界；只有命中特定功能域时，才按需读取 `.vibe/interfaces/domains/` 下的领域文件。"
    );
  }

  if (missingRequired.length > 0) {
    additionalSections.push(
      "## Missing Required Artifacts",
      ...missingRequired.map((artifact) => `- ${artifact.label}: ${artifact.path}`)
    );
  }

  return {
    systemMessage,
    additionalContext: additionalSections.join("\n\n"),
  };
}
