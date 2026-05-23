import { rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { serve, type ServerType } from "@hono/node-server";
import {
  DAEMON_PORT_FALLBACK_END,
  DAEMON_PORT_FALLBACK_START,
} from "@ccgmon/shared/constants";
import { Hono } from "hono";

import { registerEventRoutes } from "./api/events.js";
import { registerHealthzRoutes } from "./api/healthz.js";
import { registerPlansRoutes } from "./api/plans.js";
import { registerProjectsRoutes } from "./api/projects.js";
import { registerStreamRoutes } from "./api/stream.js";
import { SseBus } from "./bus.js";
import { loadConfig } from "./config.js";
import { CcgmonDatabase } from "./db.js";
import { EventProjector } from "./projector.js";

const DAEMON_VERSION = "0.1.0";
const DAEMON_HOST = "127.0.0.1";

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
  close: () => Promise<void>;
};

export async function startDaemon(options: StartDaemonOptions = {}): Promise<DaemonRuntime> {
  const config = await loadConfig(options.homeDir);
  const db = new CcgmonDatabase(config.dbPath);
  const bus = new SseBus();
  const projector = new EventProjector(db);
  projector.startPolling();
  const startedAtMs = Date.now();

  const app = createApp({
    bus,
    db,
    projector,
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

    await new Promise<void>((resolvePromise, rejectPromise) => {
      server!.close((error) => {
        if (error) {
          rejectPromise(error);
          return;
        }
        resolvePromise();
      });
    });

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
  startedAtMs: number;
}): Hono {
  const app = new Hono();

  registerEventRoutes(app, {
    bus: dependencies.bus,
    db: dependencies.db,
    projector: dependencies.projector,
  });
  registerStreamRoutes(app, {
    bus: dependencies.bus,
  });
  registerProjectsRoutes(app, {
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
