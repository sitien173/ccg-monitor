import { cp, mkdtemp, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { backfillRepoPlans } from "../src/backfill.js";
import { CcgmonDatabase, projectIdFromRepoRoot } from "../src/db.js";
import { startDaemon, type DaemonRuntime } from "../src/index.js";
import { EventProjector } from "../src/projector.js";
import { emitSyntheticEventForFile, ReconcileWorker } from "../src/reconcile.js";
import { PlanWatcher } from "../src/watcher.js";

const fixtureRepoRoot = fileURLToPath(new URL("./fixtures/plan-sample", import.meta.url));

const runtimes: DaemonRuntime[] = [];
const teardownCallbacks: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (runtimes.length > 0) {
    const runtime = runtimes.pop();
    if (!runtime) {
      continue;
    }
    await runtime.close();
  }

  while (teardownCallbacks.length > 0) {
    const callback = teardownCallbacks.pop();
    if (!callback) {
      continue;
    }
    await callback();
  }
});

describe("projector and reconcile integration", () => {
  it("backfills sample plan into projection tables and is idempotent for replays", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "ccgmon-phase3-db-"));
    const repoRoot = await copyFixtureRepo();

    const db = new CcgmonDatabase(join(homeDir, "ccgmon.db"));
    const projector = new EventProjector(db);
    teardownCallbacks.push(async () => {
      db.close();
    });

    const registration = db.upsertProjectByRepoRoot(repoRoot, new Date().toISOString());
    expect(registration.created).toBe(true);

    const backfill = await backfillRepoPlans({
      db,
      projector,
      projectId: registration.project.project_id,
      repoRoot,
    });

    expect(backfill.emitted).toBeGreaterThan(0);
    expect(db.countTableRows("projects")).toBe(1);
    expect(db.countTableRows("plans")).toBe(1);
    expect(db.countTableRows("phases")).toBe(4);
    expect(db.countTableRows("tasks")).toBe(10);
    expect(db.countTasksByStatus(registration.project.project_id, "sample-plan", "DONE")).toBe(4);
    expect(db.countTasksByStatus(registration.project.project_id, "sample-plan", "PENDING")).toBe(6);

    const phasePath = join(repoRoot, "docs", "plans", "sample-plan", "PHASE-2.md");
    await emitSyntheticEventForFile({
      db,
      projector,
      projectId: registration.project.project_id,
      repoRoot,
      filePath: phasePath,
      source: "fs_watcher",
    });
    await emitSyntheticEventForFile({
      db,
      projector,
      projectId: registration.project.project_id,
      repoRoot,
      filePath: phasePath,
      source: "fs_watcher",
    });

    expect(db.countTableRows("tasks")).toBe(10);
    expect(db.countTasksByStatus(registration.project.project_id, "sample-plan", "DONE")).toBe(4);
    expect(db.countTasksByStatus(registration.project.project_id, "sample-plan", "PENDING")).toBe(6);
  });

  it("does not fan out backfill events to SSE subscribers", async () => {
    const runtime = await bootDaemon();
    const baseUrl = `http://127.0.0.1:${runtime.port}`;
    const repoRoot = await copyFixtureRepo();

    const subscription = await connectSse(`${baseUrl}/stream`);

    const response = await fetch(`${baseUrl}/events`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(makePlanUpdatedEvent(repoRoot)),
    });

    expect(response.status).toBe(202);
    await subscription.waitForCount(1, 8_000);
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 400));

    expect(subscription.events).toHaveLength(1);
    expect(runtime.db.countEvents()).toBeGreaterThan(1);

    await subscription.close();
  });

  it("reconcile re-emits when known file mtime drifts", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "ccgmon-phase3-reconcile-"));
    const repoRoot = await copyFixtureRepo();

    const db = new CcgmonDatabase(join(homeDir, "ccgmon.db"));
    const projector = new EventProjector(db);
    const watcher = new PlanWatcher({ db, onFileChange: () => undefined });
    await watcher.start();

    teardownCallbacks.push(async () => {
      await watcher.stop();
      db.close();
    });

    const registration = db.upsertProjectByRepoRoot(repoRoot, new Date().toISOString());
    await backfillRepoPlans({
      db,
      projector,
      projectId: registration.project.project_id,
      repoRoot,
    });

    const reconcile = new ReconcileWorker({ db, projector, watcher });
    const firstRun = await reconcile.runOnce();
    expect(firstRun).toBe(0);

    const targetPath = join(repoRoot, "docs", "plans", "sample-plan", "PHASE-3.md");
    const beforeEvents = db.countEvents();
    const currentStat = await stat(targetPath);
    const bumped = new Date(currentStat.mtimeMs + 2_000);
    await utimes(targetPath, bumped, bumped);

    const secondRun = await reconcile.runOnce();
    expect(secondRun).toBeGreaterThanOrEqual(1);
    expect(db.countEvents()).toBeGreaterThan(beforeEvents);
  });

  it("returns ignored true for auto-register when .ccgmon-ignore exists", async () => {
    const runtime = await bootDaemon();
    const baseUrl = `http://127.0.0.1:${runtime.port}`;
    const repoRoot = await copyFixtureRepo();

    await writeFile(join(repoRoot, ".ccgmon-ignore"), "ignore\n", "utf8");

    const response = await fetch(`${baseUrl}/events`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(makePlanUpdatedEvent(repoRoot)),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ accepted: true, ignored: true });
    expect(runtime.db.countEvents()).toBe(0);
    expect(runtime.db.countTableRows("projects")).toBe(0);
  });
});

async function bootDaemon(): Promise<DaemonRuntime> {
  const homeDir = await mkdtemp(join(tmpdir(), "ccgmon-phase3-daemon-"));
  const runtime = await startDaemon({
    homeDir,
    installSignalHandlers: false,
    port: 0,
  });
  runtimes.push(runtime);
  return runtime;
}

async function copyFixtureRepo(): Promise<string> {
  const destination = await mkdtemp(join(tmpdir(), "ccgmon-phase3-repo-"));
  await cp(fixtureRepoRoot, destination, { recursive: true });
  return destination.replaceAll("\\", "/");
}

type SseEvent = {
  event_id: string;
};

type SseSubscription = {
  close: () => Promise<void>;
  events: SseEvent[];
  waitForCount: (count: number, timeoutMs?: number) => Promise<void>;
};

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
  const events: SseEvent[] = [];
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
    waitForCount: async (count: number, timeoutMs = 6_000) => {
      await waitForCondition(() => events.length >= count, timeoutMs);
    },
    close: async () => {
      done = true;
      await reader.cancel().catch(() => undefined);
      await loop.catch(() => undefined);
    },
  };
}

function collectEvents(buffer: string, output: SseEvent[]): string {
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
    const payload = JSON.parse(dataLine.slice("data: ".length)) as SseEvent;
    output.push(payload);
  }
  return nextBuffer;
}

function makePlanUpdatedEvent(repoRoot: string): Record<string, unknown> {
  const now = new Date();
  const projectId = projectIdFromRepoRoot(repoRoot);

  return {
    event_id: uuidV7Like(),
    event_type: "plan.updated",
    event_version: 1,
    ts: now.toISOString(),
    source: "openmcp",
    machine_id: "test-machine",
    project_id: projectId,
    repo_root: repoRoot,
    session_id: null,
    plan_slug: "sample-plan",
    payload: {
      slug: "sample-plan",
      diff_summary: "manual update",
    },
  };
}

function uuidV7Like(): string {
  const random = randomUUID().toLowerCase();
  return `${random.slice(0, 14)}7${random.slice(15)}`;
}

async function waitForCondition(condition: () => boolean, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`condition not met within ${timeoutMs}ms`);
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 20));
  }
}
