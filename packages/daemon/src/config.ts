import { mkdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import {
  CCGMON_HOME_DIR,
  CONFIG_FILENAME,
  DAEMON_PORT_FILENAME,
  DB_FILENAME,
  DEFAULT_DAEMON_PORT,
} from "@ccgmon/shared/constants";

export type DaemonConfig = {
  homeDir: string;
  dbPath: string;
  portFilePath: string;
  configFilePath: string;
  defaultPort: number;
};

export async function loadConfig(explicitHomeDir?: string): Promise<DaemonConfig> {
  const homeDir = explicitHomeDir ?? resolveDefaultHomeDir();
  await mkdir(homeDir, { recursive: true });

  const configFilePath = join(homeDir, CONFIG_FILENAME);
  const fromFile = await readConfigToml(configFilePath);

  return {
    homeDir,
    dbPath: join(homeDir, DB_FILENAME),
    portFilePath: join(homeDir, DAEMON_PORT_FILENAME),
    configFilePath,
    defaultPort: fromFile.defaultPort ?? DEFAULT_DAEMON_PORT,
  };
}

function resolveDefaultHomeDir(): string {
  const normalized = CCGMON_HOME_DIR.replace(/\/+$/, "");
  if (normalized.startsWith("~/")) {
    return join(homedir(), normalized.slice(2));
  }
  if (normalized === "~") {
    return homedir();
  }
  return normalized;
}

async function readConfigToml(
  configFilePath: string,
): Promise<{ defaultPort?: number }> {
  try {
    const raw = await readFile(configFilePath, "utf8");
    const portMatch = raw.match(/^\s*default_port\s*=\s*(\d+)\s*$/m);
    if (!portMatch) {
      return {};
    }
    const parsed = Number(portMatch[1]);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535) {
      return {};
    }
    return { defaultPort: parsed };
  } catch {
    return {};
  }
}
