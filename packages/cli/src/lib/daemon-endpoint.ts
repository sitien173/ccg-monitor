import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

import { CCGMON_HOME_DIR, DAEMON_PORT_FILENAME } from "@ccgmon/shared/constants";

export function resolveCcgmonHome(): string {
  if (CCGMON_HOME_DIR.startsWith("~/")) {
    return resolve(homedir(), CCGMON_HOME_DIR.slice(2));
  }
  return resolve(CCGMON_HOME_DIR);
}

export function resolveDaemonPortFilePath(): string {
  return join(resolveCcgmonHome(), DAEMON_PORT_FILENAME);
}

export async function readDaemonPort(): Promise<number> {
  const raw = await readFile(resolveDaemonPortFilePath(), "utf8");
  const port = Number(raw.trim());
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error("daemon.port is invalid");
  }
  return port;
}

export async function resolveDaemonBaseUrl(): Promise<string> {
  const port = await readDaemonPort();
  return `http://127.0.0.1:${port}`;
}
