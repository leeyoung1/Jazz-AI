import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = path.resolve(".");
const cliPath = path.join(rootDir, "bin", "jazz-ai.mjs");
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));

function createTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function runCli(args, { cwd, env } = {}) {
  return spawnSync("node", [cliPath, ...args], {
    cwd: cwd ?? rootDir,
    env: {
      ...process.env,
      ...env,
    },
    encoding: "utf8",
  });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

test("install lands skills/agents under .claude, writes settings.json hooks and jazzai marker", () => {
  const projectRoot = createTempDir("jazz-ai-install-");
  fs.writeFileSync(path.join(projectRoot, ".gitignore"), "dist/\n");

  const result = runCli(["install", projectRoot, "--yes"], { cwd: rootDir });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /JazzAI installed/);

  const frameworkRoot = path.join(projectRoot, ".claude");
  // skills/agents 直接落在 CC 约定位置
  assert.ok(fs.existsSync(path.join(frameworkRoot, "skills", "prd-input", "SKILL.md")));
  assert.ok(fs.existsSync(path.join(frameworkRoot, "agents", "tdd-planner.md")));
  // hooks 与运行时隔离在 jazzai 子目录
  assert.ok(fs.existsSync(path.join(frameworkRoot, "jazzai", "hooks", "router.mjs")));
  assert.ok(fs.existsSync(path.join(frameworkRoot, "jazzai", "settings.template.json")));
  assert.equal(readText(path.join(frameworkRoot, "jazzai", "VERSION")).trim(), packageJson.version);

  // 受管安装标记落在 install.json（与用户 settings.json 隔离）
  const marker = readJson(path.join(frameworkRoot, "jazzai", "install.json"));
  assert.equal(marker.vibe_code.framework, "vibe-code");
  assert.equal(marker.vibe_code.version, packageJson.version);
  assert.equal(marker.vibe_code.install_mode, "project");
  assert.ok(Array.isArray(marker.managed.skills) && marker.managed.skills.length > 0);
  assert.ok(Array.isArray(marker.managed.agents) && marker.managed.agents.length > 0);
  // 内部通知/智能用例配置必须已彻底移除
  assert.equal("notifications" in marker.vibe_code, false);
  assert.equal("smart_case_generate" in marker.vibe_code, false);

  // hooks 注册写进 settings.json，command 指向 .claude/jazzai/hooks/router.mjs
  const settings = readJson(path.join(frameworkRoot, "settings.json"));
  for (const eventName of ["SessionStart", "UserPromptSubmit"]) {
    const managedHook = settings.hooks[eventName][0].hooks.find((hook) =>
      hook.command.includes(".claude/jazzai/hooks/router.mjs")
    );
    assert.ok(managedHook, `${eventName} managed hook exists`);
  }

  const gitignore = readText(path.join(projectRoot, ".gitignore"));
  assert.match(gitignore, /# JazzAI runtime and dependencies/);
  assert.match(gitignore, /\.claude\/jazzai\/runtime\//);
  assert.ok(fs.existsSync(path.join(frameworkRoot, "jazzai", "runtime", "sessions")));
});

test("install preserves user-owned skills, agents and custom hooks", () => {
  const projectRoot = createTempDir("jazz-ai-install-preserve-");
  // 预置用户自有资产
  fs.mkdirSync(path.join(projectRoot, ".claude", "skills", "user-custom"), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, ".claude", "skills", "user-custom", "SKILL.md"), "user\n");
  fs.mkdirSync(path.join(projectRoot, ".claude", "agents"), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, ".claude", "agents", "user-agent.md"), "user\n");
  writeJson(path.join(projectRoot, ".claude", "settings.json"), {
    hooks: {
      SessionStart: [{ hooks: [{ type: "command", command: "node my-own-hook.mjs" }] }],
    },
  });

  const installResult = runCli(["install", projectRoot, "--yes"], { cwd: rootDir });
  assert.equal(installResult.status, 0, installResult.stderr);

  // 用户资产与自定义 hook 完好保留
  assert.ok(fs.existsSync(path.join(projectRoot, ".claude", "skills", "user-custom", "SKILL.md")));
  assert.ok(fs.existsSync(path.join(projectRoot, ".claude", "agents", "user-agent.md")));
  const settings = readJson(path.join(projectRoot, ".claude", "settings.json"));
  const sessionCommands = settings.hooks.SessionStart.flatMap((entry) =>
    entry.hooks.map((hook) => hook.command)
  );
  assert.ok(sessionCommands.includes("node my-own-hook.mjs"), "user hook preserved");
  assert.ok(
    sessionCommands.some((cmd) => cmd.includes(".claude/jazzai/hooks/router.mjs")),
    "managed hook added"
  );

  // 卸载后用户资产仍在，受管资产被清
  const uninstallResult = runCli(["uninstall", projectRoot, "--mode", "project", "--yes"], { cwd: rootDir });
  assert.equal(uninstallResult.status, 0, uninstallResult.stderr);
  assert.ok(fs.existsSync(path.join(projectRoot, ".claude", "skills", "user-custom", "SKILL.md")), "user skill survives uninstall");
  assert.ok(fs.existsSync(path.join(projectRoot, ".claude", "agents", "user-agent.md")), "user agent survives uninstall");
  assert.equal(fs.existsSync(path.join(projectRoot, ".claude", "skills", "prd-input")), false, "managed skill removed");
  assert.equal(fs.existsSync(path.join(projectRoot, ".claude", "jazzai", "hooks")), false, "managed hooks removed");
  const afterSettings = readJson(path.join(projectRoot, ".claude", "settings.json"));
  const afterCommands = afterSettings.hooks.SessionStart.flatMap((entry) =>
    entry.hooks.map((hook) => hook.command)
  );
  assert.ok(afterCommands.includes("node my-own-hook.mjs"), "user hook still present after uninstall");
  assert.equal(afterCommands.some((cmd) => cmd.includes("jazzai/hooks/router.mjs")), false, "managed hook removed from settings");
});

test("install does not ship removed internal skills", () => {
  const projectRoot = createTempDir("jazz-ai-install-clean-");
  const result = runCli(["install", projectRoot, "--yes"], { cwd: rootDir });
  assert.equal(result.status, 0, result.stderr);

  const skillsDir = path.join(projectRoot, ".claude", "skills");
  for (const removed of ["kim-sender", "docs-shuttle", "pipeline-deploy", "env-regression", "ks-cli-team"]) {
    assert.equal(fs.existsSync(path.join(skillsDir, removed)), false, `${removed} should not be installed`);
  }
});

test("update upgrades managed assets and version marker in place", () => {
  const projectRoot = createTempDir("jazz-ai-update-");
  const installResult = runCli(["install", projectRoot, "--yes"], { cwd: rootDir });
  assert.equal(installResult.status, 0, installResult.stderr);

  // 模拟旧版本标记
  const markerPath = path.join(projectRoot, ".claude", "jazzai", "install.json");
  const marker = readJson(markerPath);
  marker.vibe_code.version = "0.9.0";
  writeJson(markerPath, marker);
  fs.writeFileSync(path.join(projectRoot, ".claude", "jazzai", "VERSION"), "0.9.0\n");

  const result = runCli(["update", projectRoot, "--mode", "project", "--yes"], { cwd: rootDir });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /JazzAI updated/);

  const nextMarker = readJson(markerPath);
  assert.equal(nextMarker.vibe_code.framework, "vibe-code");
  assert.equal(nextMarker.vibe_code.version, packageJson.version);
  // settings.json 备份在更新时生成
  assert.ok(fs.existsSync(path.join(projectRoot, ".claude", "settings.json.bak")));
});

test("update preserves custom settings and user hooks", () => {
  const projectRoot = createTempDir("jazz-ai-update-custom-");
  const installResult = runCli(["install", projectRoot, "--yes"], { cwd: rootDir });
  assert.equal(installResult.status, 0, installResult.stderr);

  const settingsPath = path.join(projectRoot, ".claude", "settings.json");
  const currentSettings = readJson(settingsPath);
  currentSettings.custom_root = { audit: true };
  currentSettings.hooks.SessionStart.push({
    hooks: [{ type: "command", command: "node custom-audit.mjs", timeout: 3 }],
  });
  writeJson(settingsPath, currentSettings);

  const result = runCli(["update", projectRoot, "--mode", "project", "--yes"], { cwd: rootDir });

  assert.equal(result.status, 0, result.stderr);
  const nextSettings = readJson(settingsPath);
  assert.equal(nextSettings.custom_root.audit, true);
  assert.ok(
    nextSettings.hooks.SessionStart.some((entry) => entry.hooks?.[0]?.command === "node custom-audit.mjs")
  );
});

test("uninstall preserves project artifacts by default and --all removes them", () => {
  const projectRoot = createTempDir("jazz-ai-uninstall-");
  const installResult = runCli(["install", projectRoot, "--yes"], { cwd: rootDir });
  assert.equal(installResult.status, 0, installResult.stderr);

  fs.mkdirSync(path.join(projectRoot, ".prd", "demo"), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, ".vibe"), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, ".archive"), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, ".prd", "demo", "prd.md"), "demo\n");

  const uninstallResult = runCli(["uninstall", projectRoot, "--mode", "project", "--yes"], { cwd: rootDir });
  assert.equal(uninstallResult.status, 0, uninstallResult.stderr);
  assert.ok(!fs.existsSync(path.join(projectRoot, ".claude", "jazzai", "hooks")));
  assert.ok(fs.existsSync(path.join(projectRoot, ".prd")));
  assert.ok(fs.existsSync(path.join(projectRoot, ".vibe")));
  assert.ok(fs.existsSync(path.join(projectRoot, ".archive")));

  const reinstallResult = runCli(["install", projectRoot, "--yes"], { cwd: rootDir });
  assert.equal(reinstallResult.status, 0, reinstallResult.stderr);

  const uninstallAllResult = runCli(
    ["uninstall", projectRoot, "--mode", "project", "--yes", "--all"],
    { cwd: rootDir }
  );
  assert.equal(uninstallAllResult.status, 0, uninstallAllResult.stderr);
  assert.ok(!fs.existsSync(path.join(projectRoot, ".prd")));
  assert.ok(!fs.existsSync(path.join(projectRoot, ".vibe")));
  assert.ok(!fs.existsSync(path.join(projectRoot, ".archive")));
});

test("global install writes absolute hook command into shared ~/.claude directory", () => {
  const fakeHome = createTempDir("jazz-ai-global-home-");
  const globalDir = path.join(fakeHome, ".claude");
  const result = runCli(["install", "--mode", "global", "--yes"], {
    cwd: rootDir,
    env: {
      JAZZ_AI_HOME: globalDir,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  const settings = readJson(path.join(globalDir, "settings.json"));
  const sessionStartCommand = settings.hooks.SessionStart[0].hooks[0].command;
  assert.equal(
    sessionStartCommand,
    `node ${path.join(globalDir, "jazzai", "hooks", "router.mjs")}`
  );
  const marker = readJson(path.join(globalDir, "jazzai", "install.json"));
  assert.equal(marker.vibe_code.install_mode, "global");
});

test("help output is Chinese guidance for jazz-ai only, no internal references", () => {
  const result = runCli(["--help"], { cwd: rootDir });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, new RegExp(`JazzAI ${packageJson.version.replaceAll(".", "\\.")}`));
  assert.match(result.stdout, /用法：/);
  assert.match(result.stdout, /命令说明：/);
  assert.doesNotMatch(result.stdout, /KIM/);
  assert.doesNotMatch(result.stdout, /智能用例/);
  assert.doesNotMatch(result.stdout, /kim-recipient/);
});

test("whoami reports clean package identity without company registry", () => {
  const result = runCli(["whoami"], { cwd: rootDir });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /jazzai@/);
  assert.doesNotMatch(result.stdout, /kuaishou/);
  assert.doesNotMatch(result.stdout, /corp\./);
});
