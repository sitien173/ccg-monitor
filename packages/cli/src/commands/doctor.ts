import { access, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

import { CCGMON_HOME_DIR, DAEMON_PORT_FILENAME, OPENMCP_DEFAULT_LOG_PATH } from "@ccgmon/shared/constants";

type HealthzPayload = {
  ok?: boolean;
  db_writable?: boolean;
  uptime_s?: number;
};

type EventPayload = {
  ts?: string;
};

const DOCTOR_HELP = `Usage: ccgmon doctor\n\nRun environment checks for daemon, hooks, and event flow.`;

export async function runDoctorCommand(args: string[]): Promise<void> {
  const parsed = parseArgs({
    args,
    allowPositionals: false,
    options: {
      help: {
        type: "boolean",
        short: "h",
      },
    },
  });

  if (parsed.values.help) {
    process.stdout.write(`${DOCTOR_HELP}\n`);
    return;
  }

  const failures: string[] = [];
  const output: string[] = ["ccgmon doctor"];

  const portFile = join(resolveHome(CCGMON_HOME_DIR), DAEMON_PORT_FILENAME);
  const port = await readDaemonPort(portFile);

  let daemonBaseUrl: string | null = null;
  let healthz: HealthzPayload | null = null;
  if (port !== null) {
    daemonBaseUrl = `http://127.0.0.1:${port}`;
    healthz = await fetchJson<HealthzPayload>(`${daemonBaseUrl}/healthz`);
  }

  if (daemonBaseUrl && healthz?.ok) {
    output.push(`\u2713 Daemon reachable at 127.0.0.1:${port}`);
  } else {
    failures.push("daemon");
    output.push("\u2717 Daemon not reachable - run: ccgmon start");
  }

  if (healthz?.db_writable === true) {
    output.push("\u2713 Database writable");
  } else {
    failures.push("db");
    output.push("\u2717 Database not writable - fix: check file permissions");
  }

  const hooksInstalled = await hasInstalledHooks();
  if (hooksInstalled) {
    output.push("\u2713 Claude hooks installed");
  } else {
    failures.push("hooks");
    output.push("\u2717 Claude hooks not installed - run: ccgmon install-hooks");
  }

  const openmcpLogPath = resolveOpenmcpLogPath();
  const openmcpLogExists = await fileExists(openmcpLogPath);
  if (openmcpLogExists) {
    output.push("\u2713 openmcp log found");
  } else {
    failures.push("log");
    output.push("\u2717 openmcp log not found - fix: ensure openmcp is configured");
  }

  let recentEventsLine = "\u2717 Recent events unavailable - fix: run a Claude Code session";
  if (daemonBaseUrl) {
    const events = await fetchJson<EventPayload[]>(`${daemonBaseUrl}/api/events`);
    const recent = getMostRecentAge(events ?? []);
    if (recent !== null && recent <= 60 * 60 * 1000) {
      recentEventsLine = `\u2713 Recent events (last: ${formatAge(recent)} ago)`;
    } else {
      failures.push("events");
    }
  } else {
    failures.push("events");
  }
  output.push(recentEventsLine);

  output.push("");
  output.push(`${failures.length} issue${failures.length === 1 ? "" : "s"} found.`);

  process.stdout.write(`${output.join("\n")}\n`);
  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

async function readDaemonPort(portFilePath: string): Promise<number | null> {
  try {
    const raw = await readFile(portFilePath, "utf8");
    const value = Number(raw.trim());
    if (!Number.isInteger(value) || value <= 0 || value > 65535) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function hasInstalledHooks(): Promise<boolean> {
  const settingsPath = join(homedir(), ".claude", "settings.json");
  try {
    const raw = await readFile(settingsPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return containsMarker(parsed);
  } catch {
    return false;
  }
}

function containsMarker(input: unknown): boolean {
  if (!input || typeof input !== "object") {
    return false;
  }

  if ((input as { _ccgmon?: unknown })._ccgmon === true) {
    return true;
  }

  if (Array.isArray(input)) {
    return input.some((entry) => containsMarker(entry));
  }

  for (const value of Object.values(input)) {
    if (containsMarker(value)) {
      return true;
    }
  }
  return false;
}

function resolveOpenmcpLogPath(): string {
  const envPath = process.env.OPENMCP_LOG_FILE?.trim();
  if (envPath && envPath.length > 0) {
    return envPath;
  }

  return resolveHome(OPENMCP_DEFAULT_LOG_PATH);
}

function resolveHome(inputPath: string): string {
  if (inputPath.startsWith("~/")) {
    return resolve(homedir(), inputPath.slice(2));
  }
  return resolve(inputPath);
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function getMostRecentAge(events: EventPayload[]): number | null {
  let newestMs = -1;
  for (const event of events) {
    if (!event.ts) {
      continue;
    }
    const parsed = Date.parse(event.ts);
    if (!Number.isFinite(parsed)) {
      continue;
    }
    newestMs = Math.max(newestMs, parsed);
  }

  if (newestMs < 0) {
    return null;
  }

  return Math.max(0, Date.now() - newestMs);
}

function formatAge(ageMs: number): string {
  if (ageMs < 60_000) {
    return `${Math.max(1, Math.floor(ageMs / 1000))}s`;
  }
  if (ageMs < 3_600_000) {
    return `${Math.max(1, Math.floor(ageMs / 60_000))}m`;
  }
  return `${Math.max(1, Math.floor(ageMs / 3_600_000))}h`;
}
