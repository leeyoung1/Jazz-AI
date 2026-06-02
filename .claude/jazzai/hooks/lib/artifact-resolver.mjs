import fs from "node:fs";
import path from "node:path";
import { getStageConfig } from "./stage-registry.mjs";
import {
  fileExists,
  interpolatePath,
  isJson,
  isJsonl,
  isMarkdown,
  readTextFile,
  summarizeJson,
  summarizeJsonl,
  summarizeMarkdown,
} from "./utils.mjs";

export function resolveStageArtifacts(rootDir, stage, project) {
  const stageConfig = getStageConfig(stage);
  if (!stageConfig) {
    return [];
  }
  const descriptors = [...stageConfig.baselineArtifacts, ...stageConfig.artifacts];
  return resolveArtifacts(rootDir, descriptors, project);
}

export function resolveArtifacts(rootDir, descriptors, project) {
  return descriptors.map((descriptor) => resolveArtifact(rootDir, descriptor, project));
}

function resolveArtifact(rootDir, descriptor, project) {
  const candidates = descriptor.candidates.map((candidate) => interpolatePath(candidate, project));
  const discoveredPath = descriptor.discoverFilename
    ? discoverProjectFile(rootDir, project, descriptor.discoverFilename)
    : null;
  const path = candidates.find((candidate) => fileExists(rootDir, candidate)) ?? discoveredPath ?? candidates[0];
  const exists = fileExists(rootDir, path);
  const raw = exists ? readTextFile(rootDir, path) : null;
  return {
    ...descriptor,
    path,
    exists,
    summary: raw ? summarizeByPath(path, raw) : null,
  };
}

function discoverProjectFile(rootDir, project, filename) {
  if (!project) {
    return null;
  }
  const projectRoot = `.prd/${project}`;
  const absoluteProjectRoot = path.join(rootDir, projectRoot);
  const matches = findFilesByName(absoluteProjectRoot, filename, 4)
    .map((absolutePath) => absolutePath.slice(rootDir.length + 1).replaceAll("\\", "/"))
    .sort();
  return matches[0] ?? null;
}

function findFilesByName(directory, filename, maxDepth, depth = 0) {
  if (depth > maxDepth || !fs.existsSync(directory)) {
    return [];
  }
  let entries;
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch {
    return [];
  }
  const matches = [];
  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isFile() && entry.name === filename) {
      matches.push(absolutePath);
      continue;
    }
    if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
      matches.push(...findFilesByName(absolutePath, filename, maxDepth, depth + 1));
    }
  }
  return matches;
}

function summarizeByPath(relativePath, raw) {
  if (isMarkdown(relativePath)) {
    return summarizeMarkdown(raw);
  }
  if (isJsonl(relativePath)) {
    return summarizeJsonl(raw);
  }
  if (isJson(relativePath)) {
    return summarizeJson(raw);
  }
  return raw.slice(0, 1800);
}

export function artifactMap(artifacts) {
  return Object.fromEntries(artifacts.map((artifact) => [artifact.key, artifact]));
}
