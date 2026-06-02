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
export const WORKFLOW_NAME = "JazzAI codeflicker workflow";
export const FRAMEWORK_ID = "vibe-code";
export const FRAMEWORK_DIR_NAME = ".codeflicker";
export const GLOBAL_INSTALL_DIR =
  process.env.JAZZ_AI_HOME || path.join(os.homedir(), FRAMEWORK_DIR_NAME);

export const SOURCE_CODEFLICKER_DIR = path.join(PACKAGE_ROOT, FRAMEWORK_DIR_NAME);
export const SOURCE_CONFIG_PATH = path.join(SOURCE_CODEFLICKER_DIR, "config.json");
export const SOURCE_HOOK_ROUTER_PATH = path.join(SOURCE_CODEFLICKER_DIR, "hooks", "router.mjs");

export const MANAGED_DIRECTORIES = ["hooks", "skills", "agents"];
export const MANAGED_FILES = ["config.json", "VERSION"];
export const GITIGNORE_COMMENT = "# JazzAI runtime and dependencies";
export const GITIGNORE_RULES = [
  ".codeflicker/runtime/",
  ".codeflicker/hooks/node_modules/",
  ".codeflicker/hooks/package-lock.json",
];

export const ASCII_BANNER = [
  "      _                 _____ ___ ",
  "     | | __ _ ________ |  _  |_ _|",
  "  _  | |/ _` |_  /_  / | |_| || | ",
  " | |_| | (_| |/ / / /  |  _  || | ",
  "  \\___/ \\__,_/___/___| |_| |_|___|",
];
