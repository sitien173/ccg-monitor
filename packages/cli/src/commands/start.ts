import { parseArgs } from "node:util";

import { startDaemon } from "@ccgmon/daemon";

const START_HELP_TEXT = `Usage: ccgmon start [--port <N>]

Options:
  --port <N>  Pin daemon to a single port (no fallback)`;

export async function runStartCommand(args: string[]): Promise<void> {
  const parsed = parseArgs({
    args,
    allowPositionals: false,
    options: {
      help: {
        type: "boolean",
        short: "h",
      },
      port: {
        type: "string",
      },
    },
  });

  if (parsed.values.help) {
    process.stdout.write(`${START_HELP_TEXT}\n`);
    return;
  }

  let port: number | undefined;
  if (parsed.values.port !== undefined) {
    const candidate = Number(parsed.values.port);
    if (!Number.isInteger(candidate) || candidate < 0 || candidate > 65535) {
      throw new Error("--port must be an integer between 0 and 65535");
    }
    port = candidate;
  }

  await startDaemon({
    homeDir: process.env.CCGMON_HOME,
    port,
    log: (message) => process.stdout.write(`${message}\n`),
  });
}
