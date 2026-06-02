import {
  buildUsageText,
  formatLifecycleSummary,
  installPackage,
  parseCliArgs,
  printBanner,
  printWhoAmI,
  runDoctor,
  uninstallPackage,
  updatePackage,
} from "./install-manager.mjs";
import { PACKAGE_VERSION } from "./runtime.mjs";

export async function runCli(argv, io = {}) {
  const stdin = io.stdin ?? process.stdin;
  const stdout = io.stdout ?? process.stdout;
  const stderr = io.stderr ?? process.stderr;

  try {
    const options = parseCliArgs(argv);
    const command = options.positionals[0];
    const target = options.target ?? options.positionals[1] ?? null;

    if (options.version && !command) {
      stdout.write(`${PACKAGE_VERSION}\n`);
      return;
    }

    if (!command || options.help) {
      printBanner(stdout);
      stdout.write(`${buildUsageText()}\n`);
      return;
    }

    if (command === "whoami") {
      printWhoAmI(stdout);
      return;
    }

    if (command === "doctor") {
      runDoctor({
        cwd: target ?? process.cwd(),
        output: stdout,
      });
      return;
    }

    if (command === "install") {
      const result = await installPackage({
        mode: options.mode ?? "project",
        target,
        yes: options.yes,
        stdin,
        stdout,
      });
      stdout.write(`${formatLifecycleSummary(result)}\n`);
      return;
    }

    if (command === "update") {
      const result = await updatePackage({
        mode: options.mode ?? null,
        target,
        yes: options.yes,
      });
      stdout.write(`${formatLifecycleSummary(result)}\n`);
      return;
    }

    if (command === "uninstall") {
      const result = await uninstallPackage({
        mode: options.mode ?? null,
        target,
        yes: options.yes,
        all: options.all,
      });
      stdout.write(`${formatLifecycleSummary(result)}\n`);
      return;
    }

    throw new Error(`Unknown command: ${command}`);
  } catch (error) {
    stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
