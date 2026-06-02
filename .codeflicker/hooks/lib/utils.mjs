import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export function resolveRootDir(payload = {}) {
  return (
    payload.cwd ||
    process.env.TAKUMI_PROJECT_DIR ||
    process.env.CLAUDE_PROJECT_DIR ||
    process.cwd()
  );
}

export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function runtimeDir(rootDir) {
  return path.join(rootDir, ".codeflicker", "runtime");
}

export function sessionsDir(rootDir) {
  return path.join(runtimeDir(rootDir), "sessions");
}

export function fileExists(rootDir, relativePath) {
  return fs.existsSync(path.join(rootDir, relativePath));
}

export function readTextFile(rootDir, relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

export function safeReadTextFile(rootDir, relativePath) {
  try {
    return readTextFile(rootDir, relativePath);
  } catch {
    return null;
  }
}

export function relativeFromRoot(rootDir, targetPath) {
  const normalizedRoot = path.resolve(rootDir);
  const normalizedTarget = path.resolve(targetPath);
  if (!normalizedTarget.startsWith(normalizedRoot)) {
    return normalizedTarget;
  }
  return path.relative(normalizedRoot, normalizedTarget);
}

export function interpolatePath(template, project) {
  return template.replaceAll("{project}", project ?? "");
}

export function nowIso() {
  return new Date().toISOString();
}

export function shortHash(input, length = 12) {
  return crypto.createHash("sha256").update(input).digest("hex").slice(0, length);
}

export function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) {
    return { data: {}, body: markdown };
  }
  const data = {};
  for (const line of match[1].split("\n")) {
    const separator = line.indexOf(":");
    if (separator === -1) {
      continue;
    }
    const key = line.slice(0, separator).trim();
    const rawValue = line.slice(separator + 1).trim();
    if (!key) {
      continue;
    }
    data[key] = parseScalar(rawValue);
  }
  return { data, body: markdown.slice(match[0].length) };
}

function parseScalar(rawValue) {
  if (rawValue === "true") {
    return true;
  }
  if (rawValue === "false") {
    return false;
  }
  if (/^-?\d+$/.test(rawValue)) {
    return Number.parseInt(rawValue, 10);
  }
  if ((rawValue.startsWith("'") && rawValue.endsWith("'")) || (rawValue.startsWith("\"") && rawValue.endsWith("\""))) {
    return rawValue.slice(1, -1);
  }
  return rawValue;
}

export function isMarkdown(relativePath) {
  return relativePath.endsWith(".md");
}

export function isJson(relativePath) {
  return relativePath.endsWith(".json");
}

export function isJsonl(relativePath) {
  return relativePath.endsWith(".jsonl");
}

export function summarizeMarkdown(markdown, maxLines = 24, maxChars = 1800) {
  const { data, body } = parseFrontmatter(markdown);
  const lines = body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const selected = [];
  const headings = lines.filter((line) => line.startsWith("#")).slice(0, 6);
  const tableAndBullets = lines
    .filter((line) => line.startsWith("- ") || line.startsWith("|") || /^\d+\./.test(line))
    .slice(0, maxLines - headings.length);
  const prose = lines
    .filter((line) => !line.startsWith("#") && !line.startsWith("- ") && !line.startsWith("|") && !/^\d+\./.test(line))
    .slice(0, Math.max(0, maxLines - headings.length - tableAndBullets.length));
  selected.push(...headings, ...tableAndBullets, ...prose);
  let summary = selected.join("\n").slice(0, maxChars);
  if (Object.keys(data).length > 0) {
    const frontmatterSummary = Object.entries(data)
      .slice(0, 8)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join("; ");
    summary = `frontmatter: ${frontmatterSummary}\n${summary}`.slice(0, maxChars);
  }
  return summary || markdown.slice(0, maxChars);
}

export function summarizeJson(text, maxChars = 1800) {
  try {
    const value = JSON.parse(text);
    if (Array.isArray(value)) {
      return JSON.stringify(value.slice(0, 6), null, 2).slice(0, maxChars);
    }
    if (value && typeof value === "object") {
      const compact = {};
      for (const [key, item] of Object.entries(value).slice(0, 12)) {
        compact[key] = summarizeJsonValue(item);
      }
      return JSON.stringify(compact, null, 2).slice(0, maxChars);
    }
    return JSON.stringify(value).slice(0, maxChars);
  } catch {
    return text.slice(0, maxChars);
  }
}

function summarizeJsonValue(value) {
  if (Array.isArray(value)) {
    return value.slice(0, 4);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).slice(0, 6));
  }
  return value;
}

export function summarizeJsonl(text, maxChars = 1800) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 120);
  const typeCounts = new Map();
  const examples = [];
  for (const line of lines) {
    try {
      const value = JSON.parse(line);
      const type =
        value.type ||
        value.record_type ||
        value.kind ||
        value.category ||
        "unknown";
      typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
      if (examples.length < 6) {
        examples.push({
          type,
          id: value.id ?? value.name ?? value.title ?? value.feature_name ?? null,
        });
      }
    } catch {
      if (examples.length < 6) {
        examples.push(line.slice(0, 100));
      }
    }
  }
  const summary = {
    records: lines.length,
    types: Object.fromEntries(typeCounts),
    examples,
  };
  return JSON.stringify(summary, null, 2).slice(0, maxChars);
}

export function normalizeWhitespace(text) {
  return text.replace(/\s+/g, " ").trim();
}

export function truncate(text, maxChars) {
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, maxChars - 3)}...`;
}

export function findLikelyProjectFromPath(targetPath) {
  const match = targetPath.replaceAll("\\", "/").match(/\.prd\/([^/]+)\//);
  return match ? match[1] : null;
}

export function flattenStrings(value, accumulator = []) {
  if (typeof value === "string") {
    accumulator.push(value);
    return accumulator;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      flattenStrings(item, accumulator);
    }
    return accumulator;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      flattenStrings(item, accumulator);
    }
  }
  return accumulator;
}
