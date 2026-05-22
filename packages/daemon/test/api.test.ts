import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DAEMON_PORT_FILENAME, DB_FILENAME } from "@ccgmon/shared/constants";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { startDaemon, type DaemonRuntime } from "../src/index.js";

type EventRecord = {
  event_id: string;
  event_type: string;
};

type SseSubscription = {
  close: () => Promise<void>;
  events: EventRecord[];
  waitForCount: (count: number, timeoutMs?: number) => Promise<void>;
};

const runtimes: DaemonRuntime[] = [];
const homes: string[] = [];

afterEach(async () => {
  while (runtimes.length > 0) {
    const runtime = runtimes.pop();
    if (!runtime) {
      break;
    }
    await runtime.close();
  }
});

describe("daemon api integration", () => {
  it("persists and streams 100 concurrent events with stable ordering", async () => {
    const runtime = await bootDaemon();
    const baseUrl = `http://127.0.0.1:${runtime.port}`;

    const projectsResponse = await fetch(`${baseUrl}/api/projects`);
    expect(projectsResponse.status).toBe(200);
    await expect(projectsResponse.json()).resolves.toEqual([]);

    const subscriber = await connectSse(`${baseUrl}/stream`);
    const events = Array.from({ length: 100 }, (_, index) =>
      makeRouteRequestedEvent(index + 1),
    );

    const responses = await Promise.all(
      events.map((event) =>
        fetch(`${baseUrl}/events`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(event),
        }),
      ),
    );
    expect(responses.every((response) => response.status === 202)).toBe(true);

    await subscriber.waitForCount(100, 12_000);

    const dbEvents = runtime.db.listEventsByRowOrder();
    expect(dbEvents).toHaveLength(100);
    expect(subscriber.events).toHaveLength(100);
    expect(subscriber.events.map((event) => event.event_id)).toEqual(
      dbEvents.map((row) => row.event_id),
    );

    const dbFilePath = join(homes[homes.length - 1], DB_FILENAME);
    const dbFileStats = await stat(dbFilePath);
    expect(dbFileStats.size).toBeGreaterThan(0);
    await expect(stat(`${dbFilePath}-wal`)).resolves.toBeDefined();
    await expect(stat(`${dbFilePath}-shm`)).resolves.toBeDefined();

    await subscriber.close();
  });

  it("returns 400 with zod issue paths for invalid events", async () => {
    const runtime = await bootDaemon();
    const baseUrl = `http://127.0.0.1:${runtime.port}`;

    const response = await fetch(`${baseUrl}/events`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ event_type: "route.requested" }),
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as {
      issues?: Array<{ path: string }>;
    };
    expect(body.issues?.some((issue) => issue.path === "event_id")).toBe(true);
  });

  it("returns healthz shape and enforces WAL mode", async () => {
    const runtime = await bootDaemon();
    const baseUrl = `http://127.0.0.1:${runtime.port}`;

    const healthzResponse = await fetch(`${baseUrl}/healthz`);
    expect(healthzResponse.status).toBe(200);

    const healthz = (await healthzResponse.json()) as Record<string, unknown>;
    expect(healthz.ok).toBe(true);
    expect(typeof healthz.version).toBe("string");
    expect(typeof healthz.uptime_s).toBe("number");
    expect(typeof healthz.event_count).toBe("number");
    expect(typeof healthz.db_size_bytes).toBe("number");

    expect(runtime.db.getJournalMode().toLowerCase()).toBe("wal");
  });

  it("does not leak sse listeners across repeated reconnects", async () => {
    const runtime = await bootDaemon();
    const baseUrl = `http://127.0.0.1:${runtime.port}`;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const subscription = await connectSse(`${baseUrl}/stream`);
      await waitForCondition(() => runtime.getSubscriberCount() === 1, 3_000);
      await subscription.close();
      await waitForCondition(() => runtime.getSubscriberCount() === 0, 3_000);
    }
  });

  it("writes daemon.port and removes it after clean shutdown", async () => {
    const runtime = await bootDaemon();
    const homeDir = homes[homes.length - 1];
    const portFilePath = join(homeDir, DAEMON_PORT_FILENAME);

    const rawPort = (await readFile(portFilePath, "utf8")).trim();
    expect(rawPort).toBe(String(runtime.port));

    await runtime.close();
    runtimes.pop();
    await expect(stat(portFilePath)).rejects.toBeDefined();
  });
});

async function bootDaemon(): Promise<DaemonRuntime> {
  const homeDir = await mkdtemp(join(tmpdir(), "ccgmon-phase2-"));
  homes.push(homeDir);
  const runtime = await startDaemon({
    homeDir,
    installSignalHandlers: false,
    port: 0,
  });
  runtimes.push(runtime);
  return runtime;
}

async function connectSse(url: string): Promise<SseSubscription> {
  const response = await fetch(url, {
    headers: {
      accept: "text/event-stream",
    },
  });
  if (!response.ok || !response.body) {
    throw new Error(`failed to open SSE stream: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const events: EventRecord[] = [];
  let buffer = "";
  let done = false;

  const loop = (async () => {
    while (!done) {
      const chunk = await reader.read();
      if (chunk.done) {
        break;
      }
      buffer += decoder.decode(chunk.value, { stream: true });
      buffer = collectEvents(buffer, events);
    }
  })();

  return {
    events,
    waitForCount: async (count: number, timeoutMs = 8_000) => {
      await waitForCondition(() => events.length >= count, timeoutMs);
    },
    close: async () => {
      done = true;
      await reader.cancel().catch(() => {
        // Ignore read cancellation races.
      });
      await loop.catch(() => {
        // Ignore disconnect read errors.
      });
    },
  };
}

function collectEvents(buffer: string, output: EventRecord[]): string {
  let nextBuffer = buffer;
  for (;;) {
    const delimiterIndex = nextBuffer.indexOf("\n\n");
    if (delimiterIndex === -1) {
      break;
    }
    const block = nextBuffer.slice(0, delimiterIndex);
    nextBuffer = nextBuffer.slice(delimiterIndex + 2);
    const dataLine = block
      .split("\n")
      .find((line) => line.startsWith("data: "));
    if (!dataLine) {
      continue;
    }
    const payload = JSON.parse(dataLine.slice("data: ".length)) as EventRecord;
    output.push(payload);
  }
  return nextBuffer;
}

function makeRouteRequestedEvent(id: number): Record<string, unknown> {
  const hex = id.toString(16);
  const eventId = `${hex.padStart(8, "0")}-0000-7000-8000-${hex.padStart(12, "0")}`;

  return {
    event_id: eventId,
    event_type: "route.requested",
    event_version: 1,
    ts: new Date(1_700_000_000_000 + id).toISOString(),
    source: "openmcp",
    machine_id: "machine-1",
    project_id: "project-1",
    repo_root: "F:/projects/demo",
    session_id: null,
    plan_slug: "2026-05-22-ccg-monitor",
    payload: {
      backend: "codex",
      cd: "F:/projects/demo",
      prompt_bytes: id,
    },
  };
}

async function waitForCondition(
  condition: () => boolean,
  timeoutMs: number,
): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`condition not met within ${timeoutMs}ms`);
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 15));
  }
}
