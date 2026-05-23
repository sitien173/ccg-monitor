import { readFile, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";

import { CCGMON_HOME_DIR, DAEMON_PID_FILENAME, DAEMON_PORT_FILENAME } from "@ccgmon/shared/constants";

const HELP_TEXT = `Usage: ccgmon stop\n\nStop daemon process recorded in daemon.pid.`;

export async function runStopCommand(args: string[]): Promise<void> {
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

  const homeDir = resolveHomeDir();
  const pidPath = join(homeDir, DAEMON_PID_FILENAME);
  const portPath = join(homeDir, DAEMON_PORT_FILENAME);

  const rawPid = await readFile(pidPath, "utf8").catch(() => "");
  const pid = Number(rawPid.trim());
  if (!Number.isInteger(pid) || pid <= 0) {
    throw new Error(`invalid daemon pid file: ${pidPath}`);
  }

  process.kill(pid, "SIGTERM");
  await rm(pidPath, { force: true });
  await rm(portPath, { force: true });

  process.stdout.write(`Stopped daemon process ${pid}.\n`);
}

function resolveHomeDir(): string {
  if (CCGMON_HOME_DIR.startsWith("~/")) {
    return join(homedir(), CCGMON_HOME_DIR.slice(2));
  }
  return CCGMON_HOME_DIR;
}
