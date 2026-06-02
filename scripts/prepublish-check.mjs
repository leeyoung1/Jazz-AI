import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const packageJsonPath = path.join(rootDir, "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

const requiredFiles = [
  "bin/jazz-ai.mjs",
  "lib/cli/run.mjs",
  "lib/cli/runtime.mjs",
  "lib/cli/install-manager.mjs",
  ".codeflicker/config.json",
  ".codeflicker/hooks/router.mjs",
  "README.md",
  "USAGE_GUIDE.md",
];

const failures = [];

if (packageJson.name !== "jazzai") {
  failures.push(`Unexpected package name: ${packageJson.name}`);
}

if (typeof packageJson.version !== "string" || !/^\d+\.\d+\.\d+$/.test(packageJson.version)) {
  failures.push(`Invalid package version: ${packageJson.version}`);
}

if (packageJson.scripts?.postinstall || packageJson.scripts?.postuninstall) {
  failures.push("postinstall/postuninstall scripts must not be defined");
}

for (const relativePath of requiredFiles) {
  if (!fs.existsSync(path.join(rootDir, relativePath))) {
    failures.push(`Missing required publish asset: ${relativePath}`);
  }
}

if (fs.existsSync(path.join(rootDir, "VERSION"))) {
  failures.push("Root VERSION file should not be used after npm migration");
}

if (failures.length > 0) {
  for (const failure of failures) {
    process.stderr.write(`${failure}\n`);
  }
  process.exit(1);
}

process.stdout.write("prepublish check passed\n");
