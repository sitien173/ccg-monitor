import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

import { resolveDaemonBaseUrl } from "../lib/daemon-endpoint.js";

const HELP_TEXT = `Usage: ccgmon export <out.json>\n\nExport daemon projection tables to a JSON file.`;

export async function runExportCommand(args: string[]): Promise<void> {
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

  const outputPath = parsed.positionals[0];
  if (!outputPath) {
    throw new Error("export requires an output path");
  }

  const baseUrl = await resolveDaemonBaseUrl();
  const response = await fetch(`${baseUrl}/api/projections/export`);
  if (!response.ok) {
    throw new Error(`export failed with status ${response.status}`);
  }

  const payload = await response.json();
  const resolvedPath = resolve(outputPath);
  await writeFile(resolvedPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  process.stdout.write(`Exported projections to ${resolvedPath}.\n`);
}
