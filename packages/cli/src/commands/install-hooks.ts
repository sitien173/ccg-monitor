import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";

import { mergeCcgmonHooks, removeCcgmonHooks } from "../lib/settings-merge.js";

function hookDistPath(file: string): string {
  const require = createRequire(import.meta.url);
  const pkg = require.resolve("@ccgmon/claude-hooks/package.json");
  return join(dirname(pkg), "dist", file).replace(/\\/g, "/");
}

export async function runInstallHooksCommand(args: string[]): Promise<void> {
  const parsed = parseArgs({ args, options: { uninstall: { type: "boolean" }, help: { type: "boolean", short: "h" } } });
  if (parsed.values.help) {
    process.stdout.write("Usage: ccgmon install-hooks [--uninstall]\n");
    return;
  }

  const settingsPath = join(homedir(), ".claude", "settings.json");
  await mkdir(dirname(settingsPath), { recursive: true });

  let current: Record<string, unknown> = {};
  try {
    const raw = await readFile(settingsPath, "utf8");
    try {
      current = JSON.parse(raw) as Record<string, unknown>;
    } catch (error) {
      throw new Error(`Malformed JSON in ${settingsPath}: ${String(error)}`);
    }
  } catch (error: any) {
    if (error?.code !== "ENOENT") throw error;
  }

  const next = parsed.values.uninstall
    ? removeCcgmonHooks(current)
    : mergeCcgmonHooks(current, {
        SessionStart: `node ${hookDistPath("session-start.js")}`,
        PreToolUse: `node ${hookDistPath("tool-pre.js")}`,
        PostToolUse: `node ${hookDistPath("tool-post.js")}`,
        Stop: `node ${hookDistPath("session-stop.js")}`,
      });

  await writeFile(settingsPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  process.stdout.write(`${parsed.values.uninstall ? "Removed" : "Installed"} ccgmon Claude hooks in ${settingsPath}\n`);
}
