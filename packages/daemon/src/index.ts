import { rm, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { serve, type ServerType } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import {
  DAEMON_PORT_FALLBACK_END,
  DAEMON_PORT_FALLBACK_START,
} from "@ccgmon/shared/constants";
import { Hono } from "hono";

import { registerBackfillRoutes } from "./api/backfill.js";
import { registerEventRoutes } from "./api/events.js";
import { registerExportRoutes } from "./api/export.js";
import { registerHealthzRoutes } from "./api/healthz.js";
import { registerPlansRoutes } from "./api/plans.js";
import { registerProjectsRoutes } from "./api/projects.js";
import { registerStreamRoutes } from "./api/stream.js";
import { SseBus } from "./bus.js";
import { loadConfig } from "./config.js";
import { CcgmonDatabase } from "./db.js";
import { OpenmcpTailer, resolveOpenmcpLogPath } from "./openmcp-tail.js";
import { EventProjector } from "./projector.js";
import { emitSyntheticEventForFile, ReconcileWorker } from "./reconcile.js";
import { PlanWatcher, type WatchedFileChange } from "./watcher.js";

const DAEMON_VERSION = "0.1.0";
const DAEMON_HOST = "127.0.0.1";

export { loadConfig } from "./config.js";
export { CcgmonDatabase } from "./db.js";

export type StartDaemonOptions = {
  port?: number;
  homeDir?: string;
  installSignalHandlers?: boolean;
  log?: (message: string) => void;
};

export type DaemonRuntime = {
  db: CcgmonDatabase;
  getSubscriberCount: () => number;
  port: number;
  tailer: OpenmcpTailer | null;
  close: () => Promise<void>;
};

export async function startDaemon(options: StartDaemonOptions = {}): Promise<DaemonRuntime> {
  const config = await loadConfig(options.homeDir);
  const db = new CcgmonDatabase(config.dbPath);
  const bus = new SseBus();
  const projector = new EventProjector(db);
  const watcher = new PlanWatcher({
    db,
    onFileChange: (change) => {
      void handleWatchedFileChange(change, db, projector);
    },
  });
  await watcher.start();
  const reconcileWorker = new ReconcileWorker({
    db,
    projector,
    watcher,
  });
  reconcileWorker.start();
  projector.startPolling();
  const tailAbortController = new AbortController();
  let tailer: OpenmcpTailer | null = null;
  const logPath = resolveOpenmcpLogPath();
  const openmcpLogExists = await stat(logPath)
    .then((entry) => entry.isFile())
    .catch(() => false);
  if (openmcpLogExists) {
    tailer = new OpenmcpTailer({
      db,
      projector,
    });
    await tailer.start(tailAbortController.signal);
  }
  const startedAtMs = Date.now();

  const app = createApp({
    bus,
    db,
    projector,
    watcher,
    startedAtMs,
  });

  let server: ServerType | null = null;
  let selectedPort: number | null = null;
  let isClosing = false;

  try {
    const listenResult = await listenWithPortStrategy(app, options.port);
    server = listenResult.server;
    selectedPort = listenResult.port;
  } catch (error) {
    tailAbortController.abort();
    tailer?.stop();
    reconcileWorker.stop();
    await watcher.stop();
    projector.stopPolling();
    db.close();
    throw error;
  }

  await writeFile(config.portFilePath, `${selectedPort}\n`, "utf8");
  options.log?.(`ccgmon daemon listening on ${DAEMON_HOST}:${selectedPort}`);

  const removePortFile = async (): Promise<void> => {
    await rm(config.portFilePath, { force: true }).catch(() => {
      // Ignore remove failures during shutdown.
    });
  };

  const close = async (): Promise<void> => {
    if (isClosing) {
      return;
    }
    isClosing = true;
    tailAbortController.abort();
    tailer?.stop();

    await new Promise<void>((resolvePromise, rejectPromise) => {
      server!.close((error) => {
        if (error) {
          rejectPromise(error);
          return;
        }
        resolvePromise();
      });
    });

    reconcileWorker.stop();
    await watcher.stop();
    projector.stopPolling();
    db.close();
    await removePortFile();
  };

  const installSignalHandlers = options.installSignalHandlers ?? true;
  let signalHandler: ((signal: NodeJS.Signals) => void) | null = null;
  if (installSignalHandlers) {
    signalHandler = (signal: NodeJS.Signals) => {
      void close()
        .catch((error) => {
          const message = error instanceof Error ? error.message : String(error);
          process.stderr.write(`ccgmon shutdown failed: ${message}\n`);
        })
        .finally(() => {
          process.exit(signal === "SIGINT" ? 130 : 0);
        });
    };
    process.once("SIGINT", signalHandler);
    process.once("SIGTERM", signalHandler);
  }

  return {
    db,
    getSubscriberCount: () => bus.subscriberCount(),
    port: selectedPort,
    tailer,
    close: async () => {
      if (signalHandler) {
        process.off("SIGINT", signalHandler);
        process.off("SIGTERM", signalHandler);
      }
      await close();
    },
  };
}

export function createApp(dependencies: {
  bus: SseBus;
  db: CcgmonDatabase;
  projector: EventProjector;
  watcher?: PlanWatcher;
  startedAtMs: number;
}): Hono {
  const app = new Hono();

  registerEventRoutes(app, {
    bus: dependencies.bus,
    db: dependencies.db,
    projector: dependencies.projector,
    watcher: dependencies.watcher,
  });
  registerStreamRoutes(app, {
    bus: dependencies.bus,
  });
  registerProjectsRoutes(app, {
    db: dependencies.db,
  });
  registerBackfillRoutes(app, {
    db: dependencies.db,
    projector: dependencies.projector,
  });
  registerExportRoutes(app, {
    db: dependencies.db,
  });
  registerPlansRoutes(app, {
    db: dependencies.db,
  });
  registerHealthzRoutes(app, {
    db: dependencies.db,
    startedAtMs: dependencies.startedAtMs,
    version: DAEMON_VERSION,
  });

  const uiPath = resolve(fileURLToPath(import.meta.url), "../../../ui");
  app.use("/*", serveStatic({
    root: uiPath,
    rewriteRequestPath: (path) => {
      if (path === "/" || path === "") {
        return "/index.html";
      }
      return path;
    }
  }));

  app.notFound((context) =>
    context.json(
      {
        error: "not_found",
      },
      404,
    ),
  );

  return app;
}

async function handleWatchedFileChange(
  change: WatchedFileChange,
  db: CcgmonDatabase,
  projector: EventProjector,
): Promise<void> {
  if (change.event === "unlink" || change.event === "unlinkDir") {
    return;
  }

  const project = db.getProjectByRepoRoot(change.repoRoot);
  if (!project || project.status !== "ACTIVE") {
    return;
  }

  await emitSyntheticEventForFile({
    db,
    projector,
    projectId: project.project_id,
    repoRoot: change.repoRoot,
    filePath: change.filePath,
    source: "fs_watcher",
  });
}

async function listenWithPortStrategy(
  app: Hono,
  pinnedPort?: number,
): Promise<{ port: number; server: ServerType }> {
  if (pinnedPort !== undefined) {
    try {
      const server = await listen(app, pinnedPort);
      const port = readServerPort(server);
      return { port, server };
    } catch (error) {
      throw new Error(formatPinnedPortError(pinnedPort, error));
    }
  }

  for (
    let candidatePort = DAEMON_PORT_FALLBACK_START;
    candidatePort <= DAEMON_PORT_FALLBACK_END;
    candidatePort += 1
  ) {
    try {
      const server = await listen(app, candidatePort);
      const port = readServerPort(server);
      return { port, server };
    } catch (error) {
      if (!isRetryableListenError(error)) {
        throw error;
      }
    }
  }

  throw new Error(
    `Unable to bind any daemon port in ${DAEMON_PORT_FALLBACK_START}-${DAEMON_PORT_FALLBACK_END}. Try: ccgmon start --port <N>.`,
  );
}

async function listen(app: Hono, port: number): Promise<ServerType> {
  return await new Promise<ServerType>((resolvePromise, rejectPromise) => {
    const server = serve(
      {
        fetch: app.fetch,
        hostname: DAEMON_HOST,
        port,
      },
      () => {
        cleanup();
        resolvePromise(server);
      },
    );

    const onError = (error: Error) => {
      cleanup();
      void closeServer(server);
      rejectPromise(error);
    };

    const cleanup = (): void => {
      server.off("error", onError);
    };

    server.once("error", onError);
  });
}

function readServerPort(server: ServerType): number {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("daemon failed to acquire a numeric port");
  }
  return address.port;
}

function isRetryableListenError(error: unknown): boolean {
  if (!isNodeError(error)) {
    return false;
  }
  return error.code === "EADDRINUSE" || error.code === "EACCES";
}

function formatPinnedPortError(port: number, error: unknown): string {
  if (!isNodeError(error)) {
    return `Unable to bind daemon port ${port}.`;
  }

  if (error.code === "EADDRINUSE") {
    return `Unable to bind daemon port ${port}: already in use.`;
  }
  if (error.code === "EACCES") {
    return `Unable to bind daemon port ${port}: permission denied.`;
  }
  return `Unable to bind daemon port ${port}: ${error.message}`;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error;
}

async function closeServer(server: ServerType): Promise<void> {
  await new Promise<void>((resolvePromise) => {
    server.close(() => resolvePromise());
  });
}

function isMainModule(): boolean {
  if (!process.argv[1]) {
    return false;
  }
  return resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
}

async function runCli(): Promise<void> {
  const parsed = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: false,
    options: {
      port: {
        type: "string",
      },
    },
  });

  let port: number | undefined;
  if (parsed.values.port !== undefined) {
    const candidate = Number(parsed.values.port);
    if (!Number.isInteger(candidate) || candidate < 0 || candidate > 65535) {
      throw new Error("--port must be an integer between 0 and 65535");
    }
    port = candidate;
  }

  await startDaemon({
    homeDir: process.env.CCGMON_HOME,
    port,
    log: (message) => process.stdout.write(`${message}\n`),
  });
}

if (isMainModule()) {
  void runCli().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  });
}
