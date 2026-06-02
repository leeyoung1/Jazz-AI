import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export const PACKAGE_ROOT = path.resolve(moduleDir, "../..");
export const PACKAGE_JSON_PATH = path.join(PACKAGE_ROOT, "package.json");
export const PACKAGE_JSON = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, "utf8"));

export const PACKAGE_NAME = PACKAGE_JSON.name;
export const PACKAGE_VERSION = PACKAGE_JSON.version;
export const PACKAGE_REGISTRY =
  PACKAGE_JSON.publishConfig?.registry ?? "https://registry.npmjs.org/";
export const BRAND_NAME = "JazzAI";
export const WORKFLOW_NAME = "JazzAI Claude Code workflow";
export const FRAMEWORK_ID = "vibe-code";
// Claude Code 约定根目录。项目模式落到 <repo>/.claude，全局模式落到 ~/.claude
export const FRAMEWORK_DIR_NAME = ".claude";
// JazzAI 独占隔离子目录：hooks/runtime/元数据全部收纳于此，绝不污染用户的 .claude
export const JAZZAI_SUBDIR = "jazzai";
export const GLOBAL_INSTALL_DIR =
  process.env.JAZZ_AI_HOME || path.join(os.homedir(), FRAMEWORK_DIR_NAME);

// 源资产路径（CLI 包内）
export const SOURCE_CLAUDE_DIR = path.join(PACKAGE_ROOT, FRAMEWORK_DIR_NAME);
export const SOURCE_SKILLS_DIR = path.join(SOURCE_CLAUDE_DIR, "skills");
export const SOURCE_AGENTS_DIR = path.join(SOURCE_CLAUDE_DIR, "agents");
export const SOURCE_JAZZAI_DIR = path.join(SOURCE_CLAUDE_DIR, JAZZAI_SUBDIR);
export const SOURCE_HOOKS_DIR = path.join(SOURCE_JAZZAI_DIR, "hooks");
export const SOURCE_HOOK_ROUTER_PATH = path.join(SOURCE_HOOKS_DIR, "router.mjs");
export const SOURCE_SETTINGS_TEMPLATE_PATH = path.join(
  SOURCE_JAZZAI_DIR,
  "settings.template.json"
);

// 受管资产落位（相对 frameworkRoot）
export const SKILLS_DIR_NAME = "skills";
export const AGENTS_DIR_NAME = "agents";
export const HOOKS_RELATIVE_PATH = path.join(JAZZAI_SUBDIR, "hooks");
export const ROUTER_RELATIVE_PATH = path.join(JAZZAI_SUBDIR, "hooks", "router.mjs");
export const INSTALL_MARKER_RELATIVE_PATH = path.join(JAZZAI_SUBDIR, "install.json");
export const VERSION_RELATIVE_PATH = path.join(JAZZAI_SUBDIR, "VERSION");
export const RUNTIME_RELATIVE_PATH = path.join(JAZZAI_SUBDIR, "runtime");
export const SETTINGS_FILE_NAME = "settings.json";

export const GITIGNORE_COMMENT = "# JazzAI runtime and dependencies";
export const GITIGNORE_RULES = [
  ".claude/jazzai/runtime/",
  ".claude/jazzai/hooks/node_modules/",
  ".claude/jazzai/hooks/package-lock.json",
];

export const ASCII_BANNER = [
  "      _                 _____ ___ ",
  "     | | __ _ ________ |  _  |_ _|",
  "  _  | |/ _` |_  /_  / | |_| || | ",
  " | |_| | (_| |/ / / /  |  _  || | ",
  "  \\___/ \\__,_/___/___| |_| |_|___|",
];
