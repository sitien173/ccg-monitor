import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { homedir, hostname } from "node:os";
import { join } from "node:path";

import { CCGMON_HOME_DIR, DAEMON_PORT_FILENAME, DEFAULT_DAEMON_PORT } from "@ccgmon/shared/constants";

export type EnvelopeBase = {
  event_id: string;
  event_version: 1;
  ts: string;
  source: "claude_hook";
  machine_id: string;
  project_id: string;
  repo_root: string;
  session_id: string | null;
  plan_slug: null;
};

export async function readStdinJson(): Promise<any> {
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    }
    if (chunks.length === 0) return {};
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    process.stderr.write(`ccgmon hook warning: bad stdin JSON (${String(error)})\n`);
    return {};
  }
}

export function makeEnvelope(cwd: string, sessionId: string | null): EnvelopeBase {
  const normalized = cwd.replaceAll("\\", "/");
  return {
    event_id: randomUUID(),
    event_version: 1,
    ts: new Date().toISOString(),
    source: "claude_hook",
    machine_id: hostname(),
    project_id: createHash("sha1").update(normalized).digest("hex"),
    repo_root: cwd,
    session_id: sessionId,
    plan_slug: null,
  };
}

export async function postEvent(event: unknown): Promise<void> {
  const daemonUrl = await resolveDaemonUrl();
  if (daemonUrl === null) return;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 50);
  try {
    await fetch(`${daemonUrl}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event),
      signal: controller.signal,
    });
  } catch {
    // fail-silent by design
  } finally {
    clearTimeout(timer);
  }
}

async function resolveDaemonUrl(): Promise<string | null> {
  const envUrl = process.env.CCGMON_URL;
  if (envUrl === "off") return null;
  if (envUrl && envUrl.trim().length > 0) return envUrl;

  try {
    const ccgmonHome = CCGMON_HOME_DIR.replace("~/", `${homedir()}/`);
    const portRaw = await readFile(join(ccgmonHome, DAEMON_PORT_FILENAME), "utf8");
    const port = Number(portRaw.trim());
    if (Number.isInteger(port) && port > 0 && port <= 65535) {
      return `http://127.0.0.1:${port}`;
    }
  } catch {
    // fallback
  }

  return `http://127.0.0.1:${DEFAULT_DAEMON_PORT}`;
}
