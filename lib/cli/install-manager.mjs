import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  AGENTS_DIR_NAME,
  ASCII_BANNER,
  BRAND_NAME,
  FRAMEWORK_DIR_NAME,
  FRAMEWORK_ID,
  GITIGNORE_COMMENT,
  GITIGNORE_RULES,
  GLOBAL_INSTALL_DIR,
  HOOKS_RELATIVE_PATH,
  INSTALL_MARKER_RELATIVE_PATH,
  JAZZAI_SUBDIR,
  PACKAGE_NAME,
  PACKAGE_REGISTRY,
  PACKAGE_ROOT,
  PACKAGE_VERSION,
  ROUTER_RELATIVE_PATH,
  RUNTIME_RELATIVE_PATH,
  SETTINGS_FILE_NAME,
  SKILLS_DIR_NAME,
  SOURCE_AGENTS_DIR,
  SOURCE_HOOKS_DIR,
  SOURCE_SETTINGS_TEMPLATE_PATH,
  SOURCE_SKILLS_DIR,
  VERSION_RELATIVE_PATH,
  WORKFLOW_NAME,
} from "./runtime.mjs";

export function parseCliArgs(argv) {
  const options = {
    help: false,
    version: false,
    yes: false,
    all: false,
    mode: null,
    target: null,
    positionals: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--help" || value === "-h") {
      options.help = true;
      continue;
    }
    if (value === "--version" || value === "-v") {
      options.version = true;
      continue;
    }
    if (value === "--yes" || value === "-y") {
      options.yes = true;
      continue;
    }
    if (value === "--all") {
      options.all = true;
      continue;
    }
    if (value === "--global") {
      options.mode = "global";
      continue;
    }
    if (value === "--mode" || value === "--target") {
      const next = argv[index + 1];
      if (!next) {
        throw new Error(`${value} requires a value`);
      }
      if (value === "--mode") {
        options.mode = next;
      } else {
        options.target = next;
      }
      index += 1;
      continue;
    }
    options.positionals.push(value);
  }

  return options;
}

export function printBanner(output = process.stdout) {
  output.write("\n");
  for (const line of ASCII_BANNER) {
    output.write(`${line}\n`);
  }
  output.write(`${BRAND_NAME} ${PACKAGE_VERSION}\n`);
  output.write(`运行于 Claude Code 技能工作流\n\n`);
}

export function buildUsageText() {
  return [
    `${BRAND_NAME} 命令行工具`,
    "",
    "用法：",
    "  jazz-ai install [path] [--mode project|global] [--yes]",
    "  jazz-ai update [path] [--mode project|global] [--yes]",
    "  jazz-ai uninstall [path] [--mode project|global] [--all] [--yes]",
    "  jazz-ai doctor [path] [--mode project|global]",
    "  jazz-ai whoami",
    "",
    "命令说明：",
    `  install    把 JazzAI 受管资产安装到目标目录下的 ${FRAMEWORK_DIR_NAME} 中。`,
    "  update     将已安装的 .claude 资产更新到当前 CLI 版本，并尽量保留现有自定义配置。",
    "             该命令只同步仓库资产，不会升级 CLI 包本身。",
    "  uninstall  卸载 JazzAI 受管资产；默认保留 .prd、.vibe、.archive，避免误删业务资料。",
    "  doctor     检查当前目录或全局共享目录中的安装状态、Node/npm 环境与版本信息。",
    "  whoami     输出当前 CLI 包信息、版本、工作流标识和安装根目录。",
    "",
    "常用选项：",
    "  --mode project   项目模式，安装到目标仓库下的 .claude 目录（默认）。",
    "  --mode global    全局共享模式，安装到 ~/.claude，供多个仓库复用同一套资产。",
    "  --yes            跳过确认提示，适合脚本、CI 或批量执行。",
    "  --all            仅配合 uninstall 使用，额外删除 .prd、.vibe、.archive。",
    "",
    "常见示例：",
    "  jazz-ai install",
    "  jazz-ai install /path/to/repo --yes",
    "  jazz-ai install --mode global",
    "  jazz-ai update",
    "  jazz-ai uninstall",
    "  jazz-ai uninstall --all",
  ].join("\n");
}

export function printWhoAmI(output = process.stdout) {
  const lines = [
    `${PACKAGE_NAME}@${PACKAGE_VERSION}`,
    `brand=${BRAND_NAME}`,
    `workflow=${WORKFLOW_NAME}`,
    `registry=${PACKAGE_REGISTRY}`,
    `package_root=${PACKAGE_ROOT}`,
  ];
  output.write(`${lines.join("\n")}\n`);
}

export function runDoctor({ cwd = process.cwd(), output = process.stdout } = {}) {
  const npmVersion = readCommandVersion("npm", ["--version"]);
  const projectInstall = detectInstall({ mode: "project", target: cwd });
  const globalInstall = detectInstall({ mode: "global" });
  const lines = [
    `${BRAND_NAME} doctor`,
    `package=${PACKAGE_NAME}@${PACKAGE_VERSION}`,
    `node=${process.version}`,
    `npm=${npmVersion ?? "not found"}`,
    `cwd=${cwd}`,
    `tty=${Boolean(process.stdin.isTTY && process.stdout.isTTY)}`,
    describeInstall("project", projectInstall),
    describeInstall("global", globalInstall),
  ];
  output.write(`${lines.join("\n")}\n`);
}

export async function installPackage(options = {}) {
  const prompt = createPromptController({
    stdin: options.stdin,
    stdout: options.stdout,
    interactive: options.interactive,
    prompts: options.prompts,
  });
  const operation = prepareOperation({
    action: "install",
    mode: options.mode ?? "project",
    target: options.target ?? options.cwd ?? process.cwd(),
    yes: options.yes === true,
  });

  if (operation.mode === "project" && !fs.existsSync(operation.targetRoot)) {
    if (operation.yes) {
      fs.mkdirSync(operation.targetRoot, { recursive: true });
    } else {
      const allowCreate = await prompt.confirm(
        `Target directory does not exist: ${operation.targetRoot}. Create it?`
      );
      if (!allowCreate) {
        throw new Error("Installation cancelled");
      }
      fs.mkdirSync(operation.targetRoot, { recursive: true });
    }
  }

  const current = detectInstall({
    mode: operation.mode,
    target: operation.mode === "project" ? operation.targetRoot : undefined,
  });

  if (current.state !== "none" && !operation.yes) {
    const approved = await prompt.confirm(
      `${operation.frameworkRoot} already has a ${BRAND_NAME} installation (${current.state}). Overwrite it?`
    );
    if (!approved) {
      throw new Error("Installation cancelled");
    }
  }

  const nextSettings = buildInstalledSettings({
    mode: operation.mode,
    frameworkRoot: operation.frameworkRoot,
    existingSettings: current.existingSettings,
  });

  copyManagedAssets(operation.frameworkRoot);
  writeSettings(settingsPathFor(operation.frameworkRoot), nextSettings);
  writeInstallMarker(operation.frameworkRoot, operation.mode);
  writeVersionMarker(operation.frameworkRoot);
  ensureRuntimeDirectories(operation.frameworkRoot);

  if (operation.mode === "project") {
    ensureProjectGitignore(operation.targetRoot);
  }

  return {
    action: "install",
    mode: operation.mode,
    targetRoot: operation.targetRoot,
    frameworkRoot: operation.frameworkRoot,
    version: PACKAGE_VERSION,
    previousState: current.state,
  };
}

export async function updatePackage(options = {}) {
  const prompt = createPromptController({
    stdin: options.stdin,
    stdout: options.stdout,
    interactive: options.interactive,
    prompts: options.prompts,
  });
  const install = resolveExistingInstallForLifecycle(options);
  if (install.state === "none") {
    throw new Error(`No ${BRAND_NAME} installation found to update`);
  }

  const operation = prepareOperation({
    action: "update",
    mode: install.mode,
    target: install.mode === "project" ? install.targetRoot : undefined,
    yes: options.yes === true,
  });

  if (!operation.yes) {
    const approved = await prompt.confirm(
      `Update ${operation.frameworkRoot} from ${install.version ?? "unknown"} to ${PACKAGE_VERSION}?`
    );
    if (!approved) {
      throw new Error("Update cancelled");
    }
  }

  const settingsPath = settingsPathFor(operation.frameworkRoot);
  if (fs.existsSync(settingsPath)) {
    fs.copyFileSync(settingsPath, `${settingsPath}.bak`);
  }

  const nextSettings = buildInstalledSettings({
    mode: operation.mode,
    frameworkRoot: operation.frameworkRoot,
    existingSettings: install.existingSettings,
  });

  copyManagedAssets(operation.frameworkRoot);
  writeSettings(settingsPath, nextSettings);
  writeInstallMarker(operation.frameworkRoot, operation.mode);
  writeVersionMarker(operation.frameworkRoot);
  ensureRuntimeDirectories(operation.frameworkRoot);

  if (operation.mode === "project") {
    ensureProjectGitignore(operation.targetRoot);
  }

  return {
    action: "update",
    mode: operation.mode,
    targetRoot: operation.targetRoot,
    frameworkRoot: operation.frameworkRoot,
    previousVersion: install.version ?? null,
    version: PACKAGE_VERSION,
  };
}

export async function uninstallPackage(options = {}) {
  const prompt = createPromptController({
    stdin: options.stdin,
    stdout: options.stdout,
    interactive: options.interactive,
    prompts: options.prompts,
  });
  const install = resolveExistingInstallForLifecycle(options);
  if (install.state === "none") {
    throw new Error(`No ${BRAND_NAME} installation found to uninstall`);
  }

  if (!options.yes) {
    const scope = options.all ? "This removes the framework and project artifacts." : "This removes managed JazzAI assets only.";
    const approved = await prompt.confirm(`${scope} Continue?`);
    if (!approved) {
      throw new Error("Uninstall cancelled");
    }
  }

  // 按受管清单精确删除 skills/agents 子项，绝不删整个目录——避免误删用户自有 skill/agent
  removeManagedSkillsAndAgents(install.frameworkRoot, install.marker);

  // jazzai 子目录为 JazzAI 独占（hooks/runtime/install.json/VERSION），可整目录安全移除
  const jazzaiDir = path.join(install.frameworkRoot, JAZZAI_SUBDIR);
  const preserveRuntime = !options.all;
  if (preserveRuntime && fs.existsSync(jazzaiDir)) {
    // 默认保留 runtime（会话产物），只删受管代码与元数据
    fs.rmSync(path.join(jazzaiDir, "hooks"), { recursive: true, force: true });
    fs.rmSync(path.join(install.frameworkRoot, INSTALL_MARKER_RELATIVE_PATH), { force: true });
    fs.rmSync(path.join(install.frameworkRoot, VERSION_RELATIVE_PATH), { force: true });
    fs.rmSync(path.join(jazzaiDir, "settings.template.json"), { force: true });
    if (isDirectoryEmpty(jazzaiDir)) {
      fs.rmSync(jazzaiDir, { recursive: true, force: true });
    }
  } else {
    fs.rmSync(jazzaiDir, { recursive: true, force: true });
  }

  // 从 settings.json 摘除受管 hooks，保留用户自定义；清空后删除文件
  const settingsPath = settingsPathFor(install.frameworkRoot);
  if (fs.existsSync(settingsPath)) {
    const nextSettings = removeManagedConfig(readJson(settingsPath, {}));
    if (isEmptyConfig(nextSettings)) {
      fs.rmSync(settingsPath, { force: true });
    } else {
      writeSettings(settingsPath, nextSettings);
    }
  }

  if (options.all) {
    if (install.mode === "project") {
      fs.rmSync(path.join(install.targetRoot, ".prd"), { recursive: true, force: true });
      fs.rmSync(path.join(install.targetRoot, ".vibe"), { recursive: true, force: true });
      fs.rmSync(path.join(install.targetRoot, ".archive"), { recursive: true, force: true });
    }
    if (isDirectoryEmpty(install.frameworkRoot)) {
      fs.rmSync(install.frameworkRoot, { recursive: true, force: true });
    }
  }

  return {
    action: "uninstall",
    mode: install.mode,
    targetRoot: install.targetRoot,
    frameworkRoot: install.frameworkRoot,
    version: install.version ?? null,
    all: options.all === true,
  };
}

export function formatLifecycleSummary(result) {
  if (result.action === "install") {
    return [
      `${BRAND_NAME} installed`,
      `mode=${result.mode}`,
      `target=${result.frameworkRoot}`,
      `version=${result.version}`,
    ].join("\n");
  }
  if (result.action === "update") {
    return [
      `${BRAND_NAME} updated`,
      `mode=${result.mode}`,
      `target=${result.frameworkRoot}`,
      `from=${result.previousVersion ?? "unknown"}`,
      `to=${result.version}`,
    ].join("\n");
  }
  return [
    `${BRAND_NAME} uninstalled`,
    `mode=${result.mode}`,
    `target=${result.frameworkRoot}`,
    `removed_all=${result.all === true}`,
  ].join("\n");
}

function resolveExistingInstallForLifecycle(options) {
  if (options.mode === "project" || options.target) {
    return detectInstall({
      mode: options.mode ?? "project",
      target: options.target ?? process.cwd(),
    });
  }
  const projectInstall = detectInstall({ mode: "project", target: process.cwd() });
  if (projectInstall.state !== "none") {
    return projectInstall;
  }
  return detectInstall({ mode: "global" });
}

function prepareOperation({ action, mode, target, yes }) {
  const resolvedMode = normalizeMode(mode);
  if (resolvedMode === "global") {
    return {
      action,
      mode: "global",
      yes,
      targetRoot: GLOBAL_INSTALL_DIR,
      frameworkRoot: GLOBAL_INSTALL_DIR,
    };
  }

  const targetRoot = path.resolve(target ?? process.cwd());
  return {
    action,
    mode: "project",
    yes,
    targetRoot,
    frameworkRoot: path.join(targetRoot, FRAMEWORK_DIR_NAME),
  };
}

export function detectInstall({ mode, target } = {}) {
  const resolvedMode = normalizeMode(mode ?? "project");
  const targetRoot = resolvedMode === "global" ? GLOBAL_INSTALL_DIR : path.resolve(target ?? process.cwd());
  const frameworkRoot = resolvedMode === "global" ? targetRoot : path.join(targetRoot, FRAMEWORK_DIR_NAME);
  const markerPath = path.join(frameworkRoot, INSTALL_MARKER_RELATIVE_PATH);
  const versionPath = path.join(frameworkRoot, VERSION_RELATIVE_PATH);
  const settingsPath = settingsPathFor(frameworkRoot);
  const marker = fs.existsSync(markerPath) ? readJson(markerPath, {}) : null;
  const existingSettings = fs.existsSync(settingsPath) ? readJson(settingsPath, {}) : null;
  const version = resolveInstalledVersion(marker, versionPath);

  const base = { mode: resolvedMode, targetRoot, frameworkRoot, markerPath, marker, existingSettings, version };

  if (isManagedInstall(marker, frameworkRoot)) {
    return { ...base, state: "installed" };
  }

  if (hasLegacyLayout(targetRoot)) {
    return { ...base, state: "legacy" };
  }

  return { ...base, state: "none", version: null };
}

function normalizeMode(mode) {
  if (!mode || mode === "project") {
    return "project";
  }
  if (mode === "global") {
    return "global";
  }
  throw new Error(`Unsupported mode: ${mode}`);
}

// 合并受管 hooks 进现有 settings.json（保留用户自定义 hooks 与其它字段）
function buildInstalledSettings({ mode, frameworkRoot, existingSettings }) {
  const template = loadHookTemplate(mode, frameworkRoot);
  return mergeConfig(template, existingSettings ?? {});
}

// 读 settings.template.json 并把受管 hook 命令重写为目标位置的 router 路径
function loadHookTemplate(mode, frameworkRoot) {
  const template = readJson(SOURCE_SETTINGS_TEMPLATE_PATH, {});
  // 全局模式：frameworkRoot 已是 ~/.claude 绝对路径，直接拼 jazzai/hooks/router.mjs
  // 项目模式：command 相对仓库根（${CLAUDE_PROJECT_DIR}），需带 .claude/ 前缀
  const command =
    mode === "global"
      ? `node ${path.join(frameworkRoot, ROUTER_RELATIVE_PATH)}`
      : `node ${path.posix.join("${CLAUDE_PROJECT_DIR}", FRAMEWORK_DIR_NAME, JAZZAI_SUBDIR, "hooks", "router.mjs")}`;
  const hooks = rewriteManagedHookCommands(asObject(template.hooks), command);
  return { hooks };
}

function rewriteManagedHookCommands(hooksConfig, command) {
  const next = {};
  for (const [event, entries] of Object.entries(hooksConfig)) {
    if (!Array.isArray(entries)) {
      continue;
    }
    next[event] = entries.map((entry) => rewriteManagedEntry(entry, command));
  }
  return next;
}

function rewriteManagedEntry(entry, command) {
  const next = structuredClone(entry);
  if (!Array.isArray(next.hooks)) {
    return next;
  }
  next.hooks = next.hooks.map((hook) => {
    if (hook?.type === "command") {
      return {
        ...hook,
        command,
      };
    }
    return hook;
  });
  return next;
}

function mergeConfig(template, existing) {
  const merged = {
    ...asObject(existing),
    ...asObject(template),
  };

  merged.hooks = mergeHooks(asObject(template.hooks), asObject(existing.hooks));

  return merged;
}

function mergeHooks(templateHooks, existingHooks) {
  const merged = structuredClone(templateHooks);
  for (const [event, entries] of Object.entries(existingHooks)) {
    if (!Array.isArray(entries)) {
      continue;
    }
    const preserved = entries.filter((entry) => !isManagedHookEntry(entry));
    if (preserved.length === 0) {
      continue;
    }
    merged[event] = dedupeEntries([...(merged[event] ?? []), ...preserved]);
  }
  return merged;
}

function dedupeEntries(entries) {
  const seen = new Set();
  const output = [];
  for (const entry of entries) {
    const key = JSON.stringify(entry);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(entry);
  }
  return output;
}

function isManagedHookEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return false;
  }
  if (!Array.isArray(entry.hooks)) {
    return false;
  }
  return entry.hooks.some((hook) => isManagedRouterCommand(hook?.command));
}

function isManagedRouterCommand(command) {
  return typeof command === "string" && command.includes("hooks/router.mjs");
}

// 从 settings.json 中摘除受管 hooks，保留用户自定义 hooks 与其它所有字段
function removeManagedConfig(config) {
  const next = structuredClone(asObject(config));
  const hooks = asObject(next.hooks);
  const cleanedHooks = {};
  for (const [event, entries] of Object.entries(hooks)) {
    if (!Array.isArray(entries)) {
      continue;
    }
    const kept = entries.filter((entry) => !isManagedHookEntry(entry));
    if (kept.length > 0) {
      cleanedHooks[event] = kept;
    }
  }
  if (Object.keys(cleanedHooks).length > 0) {
    next.hooks = cleanedHooks;
  } else {
    delete next.hooks;
  }

  return next;
}

function isEmptyConfig(config) {
  return Object.keys(asObject(config)).length === 0;
}

// 安全落位受管资产：
// - skills/agents 落到 CC 约定位置，但按"源清单"逐项删旧+拷新，绝不删整个目录（保护用户自有 skill/agent）
// - jazzai 子目录为 JazzAI 独占，可整目录重置
function copyManagedAssets(frameworkRoot) {
  fs.mkdirSync(frameworkRoot, { recursive: true });

  copyManagedChildren(SOURCE_SKILLS_DIR, path.join(frameworkRoot, SKILLS_DIR_NAME));
  copyManagedChildren(SOURCE_AGENTS_DIR, path.join(frameworkRoot, AGENTS_DIR_NAME));

  // hooks（含 router + lib）整目录重置——独占区，安全
  const hooksTarget = path.join(frameworkRoot, HOOKS_RELATIVE_PATH);
  fs.rmSync(hooksTarget, { recursive: true, force: true });
  if (fs.existsSync(SOURCE_HOOKS_DIR)) {
    fs.cpSync(SOURCE_HOOKS_DIR, hooksTarget, {
      recursive: true,
      force: true,
      preserveTimestamps: false,
    });
  }

  // settings.template.json 也随包落地，便于排查与重装
  const templateTarget = path.join(frameworkRoot, JAZZAI_SUBDIR, "settings.template.json");
  if (fs.existsSync(SOURCE_SETTINGS_TEMPLATE_PATH)) {
    fs.mkdirSync(path.dirname(templateTarget), { recursive: true });
    fs.copyFileSync(SOURCE_SETTINGS_TEMPLATE_PATH, templateTarget);
  }
}

// 把源目录下每个直接子项（受管清单）逐一删旧+拷新，目标目录里其它内容原样保留
function copyManagedChildren(sourceDir, targetDir) {
  if (!fs.existsSync(sourceDir)) {
    return;
  }
  fs.mkdirSync(targetDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir)) {
    const source = path.join(sourceDir, entry);
    const target = path.join(targetDir, entry);
    fs.rmSync(target, { recursive: true, force: true });
    fs.cpSync(source, target, {
      recursive: true,
      force: true,
      preserveTimestamps: false,
    });
  }
}

// 卸载时按"源清单"反向精确删除 skills/agents 受管子项；marker 里记录的清单优先（兼容历史新增）
function removeManagedSkillsAndAgents(frameworkRoot, marker) {
  const managed = asObject(marker)?.managed ?? {};
  const skills = Array.isArray(managed.skills) ? managed.skills : listSourceChildren(SOURCE_SKILLS_DIR);
  const agents = Array.isArray(managed.agents) ? managed.agents : listSourceChildren(SOURCE_AGENTS_DIR);

  for (const name of skills) {
    fs.rmSync(path.join(frameworkRoot, SKILLS_DIR_NAME, name), { recursive: true, force: true });
  }
  for (const name of agents) {
    fs.rmSync(path.join(frameworkRoot, AGENTS_DIR_NAME, name), { recursive: true, force: true });
  }

  removeIfEmpty(path.join(frameworkRoot, SKILLS_DIR_NAME));
  removeIfEmpty(path.join(frameworkRoot, AGENTS_DIR_NAME));
}

function listSourceChildren(sourceDir) {
  return fs.existsSync(sourceDir) ? fs.readdirSync(sourceDir) : [];
}

function removeIfEmpty(dir) {
  if (fs.existsSync(dir) && isDirectoryEmpty(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function ensureRuntimeDirectories(frameworkRoot) {
  fs.mkdirSync(path.join(frameworkRoot, RUNTIME_RELATIVE_PATH, "sessions"), { recursive: true });
}

function ensureProjectGitignore(projectRoot) {
  const gitignorePath = path.join(projectRoot, ".gitignore");
  const existing = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, "utf8") : "";
  const missingRules = GITIGNORE_RULES.filter((rule) => !existing.includes(rule));
  if (missingRules.length === 0) {
    return;
  }
  const suffix = `${existing.endsWith("\n") || existing.length === 0 ? "" : "\n"}${
    existing.includes(GITIGNORE_COMMENT) ? "" : `${GITIGNORE_COMMENT}\n`
  }${missingRules.join("\n")}\n`;
  fs.appendFileSync(gitignorePath, suffix);
}

function writeVersionMarker(frameworkRoot) {
  const versionPath = path.join(frameworkRoot, VERSION_RELATIVE_PATH);
  fs.mkdirSync(path.dirname(versionPath), { recursive: true });
  fs.writeFileSync(versionPath, `${PACKAGE_VERSION}\n`);
}

// 受管安装标记，落在 .claude/jazzai/install.json（与用户 settings.json 完全隔离）
// 同时记录本次安装的 skills/agents 清单，供卸载时精确反删
function writeInstallMarker(frameworkRoot, mode) {
  const markerPath = path.join(frameworkRoot, INSTALL_MARKER_RELATIVE_PATH);
  const marker = {
    vibe_code: {
      framework: FRAMEWORK_ID,
      name: WORKFLOW_NAME,
      version: PACKAGE_VERSION,
      install_mode: mode,
      marker_version: 2,
      package_name: PACKAGE_NAME,
      brand: BRAND_NAME,
    },
    managed: {
      skills: listSourceChildren(SOURCE_SKILLS_DIR),
      agents: listSourceChildren(SOURCE_AGENTS_DIR),
    },
  };
  fs.mkdirSync(path.dirname(markerPath), { recursive: true });
  fs.writeFileSync(markerPath, `${JSON.stringify(marker, null, 2)}\n`);
}

function settingsPathFor(frameworkRoot) {
  return path.join(frameworkRoot, SETTINGS_FILE_NAME);
}

function writeSettings(filePath, settings) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(settings, null, 2)}\n`);
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function resolveInstalledVersion(marker, versionPath) {
  const metadataVersion = asObject(marker)?.vibe_code?.version;
  if (typeof metadataVersion === "string" && metadataVersion.trim()) {
    return metadataVersion.trim();
  }
  if (fs.existsSync(versionPath)) {
    return fs.readFileSync(versionPath, "utf8").trim() || null;
  }
  return null;
}

function isManagedInstall(marker) {
  const vibeCode = asObject(marker)?.vibe_code;
  if (vibeCode?.framework === FRAMEWORK_ID) {
    return true;
  }
  if (vibeCode?.package_name === PACKAGE_NAME) {
    return true;
  }
  return false;
}

// 识别旧版 .codeflicker 布局（迁移前安装），用于 doctor/update 提示
function hasLegacyLayout(targetRoot) {
  const legacyRoot = path.join(targetRoot, ".codeflicker");
  return (
    fs.existsSync(path.join(legacyRoot, "config.json")) &&
    fs.existsSync(path.join(legacyRoot, "hooks", "router.mjs"))
  );
}

function describeInstall(label, install) {
  return `${label}=${install.state} path=${install.frameworkRoot} version=${install.version ?? "unknown"}`;
}

function readCommandVersion(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  if (result.status !== 0) {
    return null;
  }
  return result.stdout.trim() || null;
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function isDirectoryEmpty(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    return true;
  }
  return fs.readdirSync(directoryPath).length === 0;
}

function createPromptController({ stdin, stdout, interactive, prompts } = {}) {
  const input = stdin ?? process.stdin;
  const output = stdout ?? process.stdout;
  const canPrompt = interactive ?? Boolean(input?.isTTY && output?.isTTY);
  const controller = {
    interactive: canPrompt,
    write(message) {
      if (prompts?.write) {
        prompts.write(message);
        return;
      }
      output.write(message);
    },
    async confirm(message, defaultValue = false) {
      if (prompts?.confirm) {
        return prompts.confirm(message, defaultValue);
      }
      const suffix = defaultValue ? "[Y/n]" : "[y/N]";
      const answer = await askQuestion({
        input,
        output,
        interactive: canPrompt,
        message: `${message} ${suffix} `,
      });
      const normalized = answer.trim();
      if (!normalized) {
        return defaultValue;
      }
      return /^y(es)?$/i.test(normalized);
    },
  };
  return controller;
}

async function askQuestion({ input, output, interactive, message }) {
  if (!interactive) {
    throw new Error(`Refusing to prompt in non-interactive mode: ${message.trim()}. Re-run with --yes.`);
  }
  const readline = await import("node:readline/promises");
  const rl = readline.createInterface({
    input,
    output,
  });
  const answer = await rl.question(message);
  rl.close();
  return answer;
}
