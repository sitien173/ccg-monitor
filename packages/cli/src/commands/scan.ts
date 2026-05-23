import { resolve } from "node:path";
import { parseArgs } from "node:util";

import { resolveDaemonBaseUrl } from "../lib/daemon-endpoint.js";

const HELP_TEXT = `Usage: ccgmon scan <path>\n\nRequest daemon backfill for a repository root.`;

export async function runScanCommand(args: string[]): Promise<void> {
  const parsed = parseArgs({
    args,
    allowPositionals: true,
    options: {
      help: { type: "boolean", short: "h" },
    },
  });

  if (parsed.values.help) {
    process.stdout.write(`${HELP_TEXT}\n`);
    return;
  }

  const targetPath = parsed.positionals[0];
  if (!targetPath) {
    throw new Error("scan requires a <path> argument");
  }

  const baseUrl = await resolveDaemonBaseUrl();
  const response = await fetch(`${baseUrl}/api/backfill`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ repo_root: resolve(targetPath) }),
  });
  if (!response.ok) {
    throw new Error(`backfill failed with status ${response.status}`);
  }

  const body = (await response.json()) as { emitted?: number };
  process.stdout.write(`Backfill emitted ${body.emitted ?? 0} synthetic events.\n`);
}
