import { listWorkflowCommands } from "./stage-registry.mjs";

const COMMANDS = listWorkflowCommands().sort((left, right) => right.length - left.length);
const SKILL_TO_COMMAND = {
  "/project-init": "/project-init",
  "/prd-input": "/prd-input",
  "/lite-prd": "/lite-prd",
  "/explore": "/explore",
  "/biz-discovery": "/explore",
  "/context-explore": "/explore",
  "/tech-design": "/tech-design",
  "/lite-design": "/lite-design",
  "/plan-task": "/plan-task",
  "/tdd": "/tdd",
  "/lite-tdd": "/lite-tdd",
  "/tdd-execute": "/tdd-execute",
  "/archive": "/archive",
  "/templates-index": "/templates-index",
};

export function extractCommandText(payload = {}) {
  const candidates = [];
  collectCandidates(payload, candidates, []);
  for (const candidate of candidates) {
    const commandText = findWorkflowLine(candidate.value);
    if (commandText) {
      return commandText;
    }
    const expandedCommandText = findExpandedWorkflowCommand(candidate.value);
    if (expandedCommandText) {
      return expandedCommandText;
    }
  }
  return null;
}

export function extractPromptText(payload = {}) {
  const candidates = [];
  collectCandidates(payload, candidates, []);
  return candidates[0]?.value ?? null;
}

function collectCandidates(value, candidates, path) {
  if (typeof value === "string") {
    candidates.push({ path: path.join("."), value });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectCandidates(item, candidates, [...path, String(index)]));
    return;
  }
  if (value && typeof value === "object") {
    const preferredKeys = ["prompt", "text", "message", "user_prompt", "userPrompt", "content"];
    for (const key of preferredKeys) {
      if (key in value) {
        collectCandidates(value[key], candidates, [...path, key]);
      }
    }
    for (const [key, item] of Object.entries(value)) {
      if (preferredKeys.includes(key)) {
        continue;
      }
      collectCandidates(item, candidates, [...path, key]);
    }
  }
}

function findWorkflowLine(text) {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    if (COMMANDS.some((command) => line.startsWith(command))) {
      return line;
    }
  }
  if (COMMANDS.some((command) => text.trim().startsWith(command))) {
    return text.trim();
  }
  return null;
}

function findExpandedWorkflowCommand(text) {
  const skillMatch = text.match(/使用\s+[`'"]?(\/[a-z0-9-]+)[`'"]?\s+skill\s+执行/iu);
  const skillSlash = skillMatch?.[1] ?? null;
  const command = skillSlash ? SKILL_TO_COMMAND[skillSlash] ?? null : null;
  if (!command) {
    return null;
  }
  const paramsMatch = text.match(/^参数:\s*(.*)$/mu);
  const params = paramsMatch?.[1]?.trim() ?? "";
  return params ? `${command} ${params}` : command;
}

export function parseCommand(commandText) {
  if (!commandText) {
    return null;
  }
  const tokens = tokenize(commandText);
  if (tokens.length === 0) {
    return null;
  }
  const command = tokens[0];
  if (!COMMANDS.includes(command)) {
    return null;
  }
  const flags = {};
  const positionals = [];
  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = tokens[index + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        index += 1;
      } else {
        flags[key] = true;
      }
      continue;
    }
    positionals.push(token);
  }
  return {
    command,
    raw: commandText,
    flags,
    positionals,
    project: typeof flags.project === "string" ? flags.project : null,
    name: typeof flags.name === "string" ? flags.name : null,
    plan: typeof flags.plan === "string" ? flags.plan : null,
    wave: typeof flags.wave === "string" ? flags.wave : null,
    url: typeof flags.url === "string" ? flags.url : null,
    file: typeof flags.file === "string" ? flags.file : null,
  };
}

function tokenize(text) {
  const matches = text.match(/"[^"]*"|'[^']*'|\S+/g) ?? [];
  return matches.map((token) => token.replace(/^['"]|['"]$/g, ""));
}
