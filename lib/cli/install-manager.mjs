import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  ASCII_BANNER,
  BRAND_NAME,
  FRAMEWORK_DIR_NAME,
  FRAMEWORK_ID,
  GITIGNORE_COMMENT,
  GITIGNORE_RULES,
  GLOBAL_INSTALL_DIR,
  MANAGED_DIRECTORIES,
  PACKAGE_NAME,
  PACKAGE_REGISTRY,
  PACKAGE_ROOT,
  PACKAGE_VERSION,
  SOURCE_CODEFLICKER_DIR,
  SOURCE_CONFIG_PATH,
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
  output.write(`运行于 codeflicker 技能工作流\n\n`);
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
    "  update     将已安装的 .codeflicker 资产更新到当前 CLI 版本，并尽量保留现有自定义配置。",
    "             该命令只同步仓库资产，不会升级 CLI 包本身。",
    "  uninstall  卸载 JazzAI 受管资产；默认保留 .prd、.vibe、.archive，避免误删业务资料。",
    "  doctor     检查当前目录或全局共享目录中的安装状态、Node/npm 环境与版本信息。",
    "  whoami     输出当前 CLI 包信息、版本、工作流标识和安装根目录。",
    "",
    "常用选项：",
    "  --mode project   项目模式，安装到目标仓库下的 .codeflicker 目录（默认）。",
    "  --mode global    全局共享模式，安装到共享目录，供多个仓库复用同一套资产。",
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

  const existingConfig = current.config;
  const nextConfig = buildInstalledConfig({
    mode: operation.mode,
    frameworkRoot: operation.frameworkRoot,
    existingConfig,
  });

  copyManagedAssets(operation.frameworkRoot);
  writeConfig(path.join(operation.frameworkRoot, "config.json"), nextConfig);
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

  if (install.configPath && fs.existsSync(install.configPath)) {
    fs.copyFileSync(install.configPath, `${install.configPath}.bak`);
  }

  const nextConfig = buildInstalledConfig({
    mode: operation.mode,
    frameworkRoot: operation.frameworkRoot,
    existingConfig: install.config,
  });

  copyManagedAssets(operation.frameworkRoot);
  writeConfig(path.join(operation.frameworkRoot, "config.json"), nextConfig);
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

  for (const directory of MANAGED_DIRECTORIES) {
    const target = path.join(install.frameworkRoot, directory);
    if (fs.existsSync(target)) {
      fs.rmSync(target, { recursive: true, force: true });
    }
  }

  const configPath = path.join(install.frameworkRoot, "config.json");
  if (fs.existsSync(configPath)) {
    const nextConfig = removeManagedConfig(readJson(configPath, {}));
    if (isEmptyConfig(nextConfig)) {
      fs.rmSync(configPath, { force: true });
    } else {
      writeConfig(configPath, nextConfig);
    }
  }

  fs.rmSync(path.join(install.frameworkRoot, "VERSION"), { force: true });

  if (options.all) {
    fs.rmSync(path.join(install.frameworkRoot, "runtime"), { recursive: true, force: true });
    if (install.mode === "project") {
      fs.rmSync(path.join(install.targetRoot, ".prd"), { recursive: true, force: true });
      fs.rmSync(path.join(install.targetRoot, ".vibe"), { recursive: true, force: true });
      fs.rmSync(path.join(install.targetRoot, ".archive"), { recursive: true, force: true });
      if (isDirectoryEmpty(install.frameworkRoot)) {
        fs.rmSync(install.frameworkRoot, { recursive: true, force: true });
      }
    } else if (isDirectoryEmpty(install.frameworkRoot)) {
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
  const configPath = path.join(frameworkRoot, "config.json");
  const versionPath = path.join(frameworkRoot, "VERSION");
  const config = fs.existsSync(configPath) ? readJson(configPath, {}) : null;
  const version = resolveInstalledVersion(config, versionPath);

  if (isManagedInstall(config, frameworkRoot)) {
    return {
      state: "installed",
      mode: resolvedMode,
      targetRoot,
      frameworkRoot,
      configPath,
      config,
      version,
    };
  }

  if (hasLegacyLayout(frameworkRoot)) {
    return {
      state: "legacy",
      mode: resolvedMode,
      targetRoot,
      frameworkRoot,
      configPath,
      config,
      version,
    };
  }

  return {
    state: "none",
    mode: resolvedMode,
    targetRoot,
    frameworkRoot,
    configPath,
    config,
    version: null,
  };
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

function buildInstalledConfig({ mode, frameworkRoot, existingConfig }) {
  const template = loadTemplateConfig(mode, frameworkRoot);
  const merged = mergeConfig(template, existingConfig ?? {});
  const vibeCode = asObject(merged.vibe_code);

  vibeCode.framework = FRAMEWORK_ID;
  vibeCode.name = WORKFLOW_NAME;
  vibeCode.version = PACKAGE_VERSION;
  vibeCode.install_mode = mode;
  vibeCode.marker_version = 1;
  vibeCode.package_name = PACKAGE_NAME;
  vibeCode.brand = BRAND_NAME;
  merged.vibe_code = vibeCode;

  return merged;
}

function loadTemplateConfig(mode, frameworkRoot) {
  const template = readJson(SOURCE_CONFIG_PATH, {});
  const command =
    mode === "global"
      ? `node ${path.join(frameworkRoot, "hooks", "router.mjs")}`
      : "node .codeflicker/hooks/router.mjs";
  const hooks = rewriteManagedHookCommands(asObject(template.hooks), command);
  return {
    ...template,
    hooks,
  };
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
  merged.vibe_code = {
    ...asObject(template.vibe_code),
    ...asObject(existing.vibe_code),
  };

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

  const vibeCode = asObject(next.vibe_code);
  delete vibeCode.framework;
  delete vibeCode.name;
  delete vibeCode.version;
  delete vibeCode.install_mode;
  delete vibeCode.marker_version;
  delete vibeCode.package_name;
  delete vibeCode.brand;
  if (Object.keys(vibeCode).length > 0) {
    next.vibe_code = vibeCode;
  } else {
    delete next.vibe_code;
  }

  return next;
}

function isEmptyConfig(config) {
  return Object.keys(asObject(config)).length === 0;
}

function copyManagedAssets(frameworkRoot) {
  fs.mkdirSync(frameworkRoot, { recursive: true });
  for (const directory of MANAGED_DIRECTORIES) {
    const source = path.join(SOURCE_CODEFLICKER_DIR, directory);
    const target = path.join(frameworkRoot, directory);
    fs.rmSync(target, { recursive: true, force: true });
    if (fs.existsSync(source)) {
      fs.cpSync(source, target, {
        recursive: true,
        force: true,
        preserveTimestamps: false,
      });
    }
  }
}

function ensureRuntimeDirectories(frameworkRoot) {
  fs.mkdirSync(path.join(frameworkRoot, "runtime", "sessions"), { recursive: true });
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
  fs.writeFileSync(path.join(frameworkRoot, "VERSION"), `${PACKAGE_VERSION}\n`);
}

function writeConfig(filePath, config) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(config, null, 2)}\n`);
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function resolveInstalledVersion(config, versionPath) {
  const metadataVersion = asObject(config)?.vibe_code?.version;
  if (typeof metadataVersion === "string" && metadataVersion.trim()) {
    return metadataVersion.trim();
  }
  if (fs.existsSync(versionPath)) {
    return fs.readFileSync(versionPath, "utf8").trim() || null;
  }
  return null;
}

function isManagedInstall(config, frameworkRoot) {
  const vibeCode = asObject(config)?.vibe_code;
  if (vibeCode?.framework === FRAMEWORK_ID) {
    return true;
  }
  if (vibeCode?.package_name === PACKAGE_NAME) {
    return true;
  }
  return false;
}

function hasLegacyLayout(frameworkRoot) {
  return (
    fs.existsSync(path.join(frameworkRoot, "config.json")) &&
    fs.existsSync(path.join(frameworkRoot, "hooks", "router.mjs")) &&
    fs.existsSync(path.join(frameworkRoot, "skills")) &&
    fs.existsSync(path.join(frameworkRoot, "agents"))
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
