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

test("install copies .codeflicker assets, writes version marker, updates gitignore and clean config", () => {
  const projectRoot = createTempDir("jazz-ai-install-");
  fs.writeFileSync(path.join(projectRoot, ".gitignore"), "dist/\n");

  const result = runCli(["install", projectRoot, "--yes"], { cwd: rootDir });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /JazzAI installed/);

  const frameworkRoot = path.join(projectRoot, ".codeflicker");
  assert.ok(fs.existsSync(path.join(frameworkRoot, "hooks", "router.mjs")));
  assert.ok(fs.existsSync(path.join(frameworkRoot, "skills")));
  assert.ok(fs.existsSync(path.join(frameworkRoot, "agents")));
  assert.equal(readText(path.join(frameworkRoot, "VERSION")).trim(), packageJson.version);

  const config = readJson(path.join(frameworkRoot, "config.json"));
  assert.equal(config.vibe_code.framework, "vibe-code");
  assert.equal(config.vibe_code.name, "JazzAI codeflicker workflow");
  assert.equal(config.vibe_code.version, packageJson.version);
  assert.equal(config.vibe_code.install_mode, "project");
  // 内部通知/智能用例配置必须已彻底移除
  assert.equal("notifications" in config.vibe_code, false);
  assert.equal("smart_case_generate" in config.vibe_code, false);

  for (const eventName of ["SessionStart", "UserPromptSubmit"]) {
    const managedHook = config.hooks[eventName][0].hooks.find((hook) => hook.command.includes("hooks/router.mjs"));
    assert.ok(managedHook, `${eventName} managed hook exists`);
  }

  const gitignore = readText(path.join(projectRoot, ".gitignore"));
  assert.match(gitignore, /# JazzAI runtime and dependencies/);
  assert.match(gitignore, /\.codeflicker\/runtime\//);
  assert.ok(fs.existsSync(path.join(frameworkRoot, "runtime", "sessions")));
});

test("install does not ship removed internal skills", () => {
  const projectRoot = createTempDir("jazz-ai-install-clean-");
  const result = runCli(["install", projectRoot, "--yes"], { cwd: rootDir });
  assert.equal(result.status, 0, result.stderr);

  const skillsDir = path.join(projectRoot, ".codeflicker", "skills");
  for (const removed of ["kim-sender", "docs-shuttle", "pipeline-deploy", "env-regression", "ks-cli-team"]) {
    assert.equal(fs.existsSync(path.join(skillsDir, removed)), false, `${removed} should not be installed`);
  }
});

test("update detects legacy install and upgrades metadata in place", () => {
  const projectRoot = createTempDir("jazz-ai-update-legacy-");
  const frameworkRoot = path.join(projectRoot, ".codeflicker");
  fs.mkdirSync(path.join(frameworkRoot, "hooks"), { recursive: true });
  fs.mkdirSync(path.join(frameworkRoot, "skills"), { recursive: true });
  fs.mkdirSync(path.join(frameworkRoot, "agents"), { recursive: true });
  fs.writeFileSync(path.join(frameworkRoot, "hooks", "router.mjs"), "legacy-router\n");
  writeJson(path.join(frameworkRoot, "config.json"), {
    hooks: {
      SessionStart: [
        {
          hooks: [
            {
              type: "command",
              command: "node .codeflicker/hooks/router.mjs",
              timeout: 15,
            },
          ],
        },
      ],
    },
  });
  fs.writeFileSync(path.join(frameworkRoot, "VERSION"), "0.9.0\n");

  const result = runCli(["update", projectRoot, "--mode", "project", "--yes"], { cwd: rootDir });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /JazzAI updated/);

  const config = readJson(path.join(frameworkRoot, "config.json"));
  assert.equal(config.vibe_code.framework, "vibe-code");
  assert.equal(config.vibe_code.version, packageJson.version);
  assert.ok(fs.existsSync(path.join(frameworkRoot, "config.json.bak")));
});

test("update preserves custom config and hooks", () => {
  const projectRoot = createTempDir("jazz-ai-update-custom-");
  const installResult = runCli(["install", projectRoot, "--yes"], { cwd: rootDir });
  assert.equal(installResult.status, 0, installResult.stderr);

  const configPath = path.join(projectRoot, ".codeflicker", "config.json");
  const currentConfig = readJson(configPath);
  currentConfig.custom_root = { audit: true };
  currentConfig.hooks.SessionStart.push({
    hooks: [{ type: "command", command: "node custom-audit.mjs", timeout: 3 }],
  });
  writeJson(configPath, currentConfig);

  const result = runCli(["update", projectRoot, "--mode", "project", "--yes"], { cwd: rootDir });

  assert.equal(result.status, 0, result.stderr);
  const nextConfig = readJson(configPath);
  assert.equal(nextConfig.custom_root.audit, true);
  assert.ok(
    nextConfig.hooks.SessionStart.some((entry) => entry.hooks?.[0]?.command === "node custom-audit.mjs")
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
  assert.ok(!fs.existsSync(path.join(projectRoot, ".codeflicker", "hooks")));
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

test("global install writes absolute hook command into shared .codeflicker directory", () => {
  const fakeHome = createTempDir("jazz-ai-global-home-");
  const result = runCli(["install", "--mode", "global", "--yes"], {
    cwd: rootDir,
    env: {
      JAZZ_AI_HOME: path.join(fakeHome, ".codeflicker"),
    },
  });

  assert.equal(result.status, 0, result.stderr);
  const config = readJson(path.join(fakeHome, ".codeflicker", "config.json"));
  const sessionStartCommand = config.hooks.SessionStart[0].hooks[0].command;
  assert.equal(
    sessionStartCommand,
    `node ${path.join(fakeHome, ".codeflicker", "hooks", "router.mjs")}`
  );
  assert.equal(config.vibe_code.install_mode, "global");
});

test("help output is Chinese guidance for jazz-ai only, no internal references", () => {
  const result = runCli(["--help"], { cwd: rootDir });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, new RegExp(`JazzAI ${packageJson.version.replaceAll(".", "\\.")}`));
  assert.match(result.stdout, /运行于 codeflicker 技能工作流/);
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
