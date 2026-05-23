import { parseArgs } from "node:util";

import { CcgmonDatabase, loadConfig } from "@ccgmon/daemon";

const HELP_TEXT = `Usage: ccgmon prune --older-than <Nd>\n\nDelete old events while preserving latest event per active plan.`;

export async function runPruneCommand(args: string[]): Promise<void> {
  const parsed = parseArgs({
    args,
    allowPositionals: false,
    options: {
      help: { type: "boolean", short: "h" },
      "older-than": { type: "string" },
    },
  });

  if (parsed.values.help) {
    process.stdout.write(`${HELP_TEXT}\n`);
    return;
  }

  const rawOlderThan = parsed.values["older-than"] ?? "90d";
  const match = rawOlderThan.match(/^(\d+)d$/);
  if (!match) {
    throw new Error("--older-than must be formatted like 90d");
  }

  const days = Number(match[1]);
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const config = await loadConfig(process.env.CCGMON_HOME);
  const db = new CcgmonDatabase(config.dbPath);
  try {
    const deleted = db.pruneEventsOlderThan(cutoffDate);
    process.stdout.write(`Pruned ${deleted} events older than ${rawOlderThan}.\n`);
  } finally {
    db.close();
  }
}
