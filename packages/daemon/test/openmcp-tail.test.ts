import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { CcgmonDatabase } from "../src/db.js";
import { OpenmcpTailer } from "../src/openmcp-tail.js";
import { EventProjector } from "../src/projector.js";

const fixtureRoot = fileURLToPath(new URL("./fixtures/openmcp-log", import.meta.url));

const cleanupCallbacks: Array<() => Promise<void>> = [];

afterEach(async () => {
  delete process.env.OPENMCP_LOG_FILE;
  while (cleanupCallbacks.length > 0) {
    const callback = cleanupCallbacks.pop();
    if (!callback) {
      continue;
    }
    await callback();
  }
});

describe("OpenmcpTailer", () => {
  it("parses happy, retry, and failed log lines into route events", async () => {
    const logPath = await combineFixtures(["happy.log", "retry.log", "failed.log"]);
    const { db, closeDb } = await createDb();
    cleanupCallbacks.push(closeDb);

    process.env.OPENMCP_LOG_FILE = logPath;

    const projector = new EventProjector(db);
    const tailer = new OpenmcpTailer({
      db,
      projector,
      defaultRepoRoot: "F:/projects/demo",
      machineId: "test-machine",
    });

    const controller = new AbortController();
    await tailer.start(controller.signal);

    await waitFor(() => db.countEvents() >= 7, 3000);
    controller.abort();

    const events = db.getRecentEvents(32).map((row) => row.event_type);
    expect(events.filter((eventType) => eventType === "route.requested")).toHaveLength(3);
    expect(events.filter((eventType) => eventType === "route.dispatched")).toHaveLength(1);
    expect(events.filter((eventType) => eventType === "route.completed")).toHaveLength(2);
    expect(events.filter((eventType) => eventType === "route.failed")).toHaveLength(1);
  });

  it("persists byte offset bookmark and resumes without re-emitting", async () => {
    const logPath = await combineFixtures(["happy.log"]);
    const { db, closeDb } = await createDb();
    cleanupCallbacks.push(closeDb);

    process.env.OPENMCP_LOG_FILE = logPath;

    const projector = new EventProjector(db);
    const firstTailer = new OpenmcpTailer({ db, projector, defaultRepoRoot: "F:/projects/demo" });
    const firstController = new AbortController();
    await firstTailer.start(firstController.signal);
    await waitFor(() => db.countEvents() >= 2, 3000);
    firstController.abort();

    const firstCount = db.countEvents();
    const firstState = db.getTailState();
    expect(firstState).not.toBeNull();
    expect(firstState!.byte_offset).toBeGreaterThan(0);

    const secondTailer = new OpenmcpTailer({ db, projector, defaultRepoRoot: "F:/projects/demo" });
    const secondController = new AbortController();
    await secondTailer.start(secondController.signal);
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
    secondController.abort();

    expect(db.countEvents()).toBe(firstCount);
    const secondState = db.getTailState();
    expect(secondState?.byte_offset).toBe(firstState?.byte_offset);
  });

  it("is idempotent when replaying same offsets", async () => {
    const logPath = await combineFixtures(["retry.log"]);
    const { db, closeDb } = await createDb();
    cleanupCallbacks.push(closeDb);

    process.env.OPENMCP_LOG_FILE = logPath;

    const projector = new EventProjector(db);
    const tailer = new OpenmcpTailer({ db, projector, defaultRepoRoot: "F:/projects/demo" });
    const controller = new AbortController();
    await tailer.start(controller.signal);
    await waitFor(() => db.countEvents() >= 3, 3000);
    controller.abort();

    const countAfterFirstPass = db.countEvents();
    const fileStat = await stat(logPath);
    db.setTailState(logPath, 0, `${fileStat.dev}:${fileStat.ino}`);

    const replayTailer = new OpenmcpTailer({ db, projector, defaultRepoRoot: "F:/projects/demo" });
    const replayController = new AbortController();
    await replayTailer.start(replayController.signal);
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 400));
    replayController.abort();

    expect(db.countEvents()).toBe(countAfterFirstPass);
  });
});

async function createDb(): Promise<{ db: CcgmonDatabase; closeDb: () => Promise<void> }> {
  const dbDir = await mkdtemp(join(tmpdir(), "ccgmon-phase6-tail-db-"));
  const dbPath = join(dbDir, "ccgmon.db");
  const db = new CcgmonDatabase(dbPath);
  return {
    db,
    closeDb: async () => {
      db.close();
    },
  };
}

async function combineFixtures(fileNames: string[]): Promise<string> {
  const tempDir = await mkdtemp(join(tmpdir(), "ccgmon-phase6-log-"));
  const logPath = join(tempDir, "openmcp.log");

  let combined = "";
  for (const fileName of fileNames) {
    combined += await readFile(join(fixtureRoot, fileName), "utf8");
  }

  await writeFile(logPath, combined, "utf8");
  return logPath;
}

async function waitFor(condition: () => boolean, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`condition not met in ${timeoutMs}ms`);
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
  }
}
