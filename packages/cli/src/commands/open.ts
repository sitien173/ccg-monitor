import { exec } from "node:child_process";
import { parseArgs } from "node:util";

import { readDaemonPort } from "../lib/daemon-endpoint.js";

const HELP_TEXT = `Usage: ccgmon open\n\nOpen the ccgmon UI in your default browser.`;

export async function runOpenCommand(args: string[]): Promise<void> {
  const parsed = parseArgs({
    args,
    allowPositionals: false,
    options: {
      help: { type: "boolean", short: "h" },
    },
  });

  if (parsed.values.help) {
    process.stdout.write(`${HELP_TEXT}\n`);
    return;
  }

  const port = await readDaemonPort();
  const url = `http://127.0.0.1:${port}`;

  await openUrl(url);
  process.stdout.write(`Opened ${url}\n`);
}

async function openUrl(url: string): Promise<void> {
  const command =
    process.platform === "win32"
      ? `start \"\" \"${url}\"`
      : process.platform === "darwin"
        ? `open \"${url}\"`
        : `xdg-open \"${url}\"`;

  await new Promise<void>((resolvePromise, rejectPromise) => {
    exec(command, (error) => {
      if (error) {
        rejectPromise(error);
        return;
      }
      resolvePromise();
    });
  });
}
