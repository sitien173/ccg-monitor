#!/usr/bin/env node

import { parseArgs } from "node:util";

import { runDoctorCommand } from "./commands/doctor.js";
import { runExportCommand } from "./commands/export.js";
import { runInstallHooksCommand } from "./commands/install-hooks.js";
import { runOpenCommand } from "./commands/open.js";
import { runPruneCommand } from "./commands/prune.js";
import { runScanCommand } from "./commands/scan.js";
import { runStartCommand } from "./commands/start.js";
import { runStatusCommand } from "./commands/status.js";
import { runStopCommand } from "./commands/stop.js";
import { printVersion } from "./commands/version.js";

const HELP_TEXT = `Usage: ccgmon <command> [options]

Options:
  --help, -h     Show this help message
  --version, -v  Print ccg-monitor version

Commands:
  start          Run daemon in foreground
  install-hooks  Install Claude Code hooks into ~/.claude/settings.json
  doctor         Run environment checks
  scan           Request repository backfill from daemon
  prune          Remove old events from database
  export         Export projection tables to JSON
  status         Print daemon health summary
  open           Open dashboard in browser
  stop           Stop detached daemon`;

function printHelp(): void {
  process.stdout.write(`${HELP_TEXT}\n`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args[0] === "start") {
    await runStartCommand(args.slice(1));
    return;
  }
  if (args[0] === "install-hooks") {
    await runInstallHooksCommand(args.slice(1));
    return;
  }
  if (args[0] === "doctor") {
    await runDoctorCommand(args.slice(1));
    return;
  }
  if (args[0] === "scan") {
    await runScanCommand(args.slice(1));
    return;
  }
  if (args[0] === "prune") {
    await runPruneCommand(args.slice(1));
    return;
  }
  if (args[0] === "export") {
    await runExportCommand(args.slice(1));
    return;
  }
  if (args[0] === "status") {
    await runStatusCommand(args.slice(1));
    return;
  }
  if (args[0] === "open") {
    await runOpenCommand(args.slice(1));
    return;
  }
  if (args[0] === "stop") {
    await runStopCommand(args.slice(1));
    return;
  }

  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    strict: false,
    options: {
      help: {
        type: "boolean",
        short: "h",
      },
      version: {
        type: "boolean",
        short: "v",
      },
    },
  });

  if (values.help) {
    printHelp();
    return;
  }

  if (values.version) {
    await printVersion(import.meta.url);
    return;
  }

  if (positionals.length > 0) {
    process.stderr.write(`Unknown command: ${positionals.join(" ")}\n\n`);
    printHelp();
    process.exitCode = 1;
    return;
  }

  printHelp();
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`ccgmon failed: ${message}\n`);
  process.exit(1);
});
