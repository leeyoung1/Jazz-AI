import { getStageConfig } from "./stage-registry.mjs";
import { resolveStageArtifacts } from "./artifact-resolver.mjs";
import { truncate } from "./utils.mjs";

export function buildCompactSummary(rootDir, sessionState) {
  const stage = sessionState.stage;
  const project = sessionState.project;
  const stageConfig = getStageConfig(stage);
  const artifacts = stage ? resolveStageArtifacts(rootDir, stage, project) : [];
  const availableArtifacts = artifacts.filter((a) => a.exists);

  const sections = [
    "# JazzAI Compact Summary — CRITICAL: You are inside the JazzAI codeflicker workflow",
    "",
    "## Workflow Identity",
    "You are operating inside the **JazzAI codeflicker workflow** (hooks-first architecture).",
    "This is NOT a generic coding session. You MUST follow the stage rules and constraints below.",
    "Do NOT ask the user about 'spec mode', 'OpenSpec', or any other framework — you are in JazzAI.",
    "If the user says '继续' (continue), resume the current stage immediately without re-asking context.",
    "",
    "## Session State",
    `- stage: ${stage ?? "none"}`,
    `- stage_label: ${stageConfig?.label ?? "none"}`,
    `- project: ${project ?? "none"}`,
    `- plan: ${sessionState.plan_id ?? "none"}`,
    `- wave: ${sessionState.wave ?? "none"}`,
    `- last_outputs: ${JSON.stringify(sessionState.last_outputs)}`,
    `- confirmations: ${JSON.stringify(sessionState.confirmations)}`,
  ];

  if (stageConfig?.stageRules?.length) {
    sections.push("", "## Stage Rules (MUST follow)");
    stageConfig.stageRules.forEach((rule, i) => {
      sections.push(`RULE ${i + 1}: ${rule}`);
    });
  }

  if (availableArtifacts.length > 0) {
    sections.push("", "## Injected Artifact Summaries");
    for (const artifact of availableArtifacts) {
      sections.push(`### ${artifact.label}`);
      sections.push(`path: ${artifact.path}`);
      if (artifact.summary) {
        sections.push(truncate(artifact.summary, 1500));
      }
    }
  }

  sections.push(
    "",
    "## Resume Instructions",
    "After compact, you MUST:",
    "1. Recognize you are in the JazzAI codeflicker workflow (not a generic session).",
    "2. Resume the current stage listed above using the injected artifact summaries.",
    "3. If user says '继续', pick up exactly where you left off — do NOT restart or re-discover context.",
    "4. Follow the Stage Rules above strictly."
  );

  return sections.join("\n");
}
