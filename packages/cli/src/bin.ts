#!/usr/bin/env node

import { parseArgs } from "node:util";

import { runStartCommand } from "./commands/start.js";
import { printVersion } from "./commands/version.js";

const HELP_TEXT = `Usage: ccgmon <command> [options]

Options:
  --help, -h     Show this help message
  --version, -v  Print ccg-monitor version

Commands:
  start          Run daemon in foreground`;

function printHelp(): void {
  process.stdout.write(`${HELP_TEXT}\n`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args[0] === "start") {
    await runStartCommand(args.slice(1));
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
