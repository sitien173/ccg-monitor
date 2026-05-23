import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";

import { DAEMON_PID_FILENAME } from "@ccgmon/shared/constants";
import { loadConfig, startDaemon } from "@ccgmon/daemon";

const START_HELP_TEXT = `Usage: ccgmon start [--port <N>] [--detach]

Options:
  --port <N>   Pin daemon to a single port (no fallback)
  --detach     Run daemon in background and return immediately`;

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
      detach: {
        type: "boolean",
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

  if (parsed.values.detach) {
    await startDetachedDaemon(port);
    return;
  }

  await startDaemon({
    homeDir: process.env.CCGMON_HOME,
    port,
    log: (message) => process.stdout.write(`${message}\n`),
  });
}

async function startDetachedDaemon(port: number | undefined): Promise<void> {
  const config = await loadConfig(process.env.CCGMON_HOME);
  await mkdir(config.homeDir, { recursive: true });

  const daemonEntry = resolveDaemonEntryPoint();
  const daemonArgs = [daemonEntry];
  if (port !== undefined) {
    daemonArgs.push("--port", String(port));
  }

  const child = spawn(process.execPath, daemonArgs, {
    detached: true,
    stdio: "ignore",
    env: process.env,
  });
  child.unref();

  const pidFilePath = join(config.homeDir, DAEMON_PID_FILENAME);
  await writeFile(pidFilePath, `${child.pid}\n`, "utf8");
  const portValue = await waitForPort(config.portFilePath, port);

  process.stdout.write(
    `ccgmon daemon detached (pid ${child.pid}${portValue ? `, port ${portValue}` : ""}).\n`,
  );
}

function resolveDaemonEntryPoint(): string {
  const require = createRequire(import.meta.url);
  const pkgPath = require.resolve("@ccgmon/daemon/package.json");
  return join(dirname(pkgPath), "dist", "index.js");
}

async function waitForPort(portFilePath: string, fallbackPort: number | undefined): Promise<number | null> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const raw = await readFile(portFilePath, "utf8");
      const value = Number(raw.trim());
      if (Number.isInteger(value) && value > 0 && value <= 65535) {
        return value;
      }
    } catch {
      // Daemon has not written the file yet.
    }
    await new Promise<void>((resolvePromise) => {
      setTimeout(resolvePromise, 100);
    });
  }

  return fallbackPort ?? null;
}
