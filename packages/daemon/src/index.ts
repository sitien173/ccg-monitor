import { Hono } from "hono";
import { serve, type ServerType } from "@hono/node-server";

import { registerEventRoutes } from "./api/events.js";
import { registerHealthzRoutes } from "./api/healthz.js";
import { registerPlansRoutes } from "./api/plans.js";
import { registerProjectsRoutes } from "./api/projects.js";
import { registerStreamRoutes } from "./api/stream.js";
import { SseBus } from "./bus.js";
import { loadConfig } from "./config.js";
import { CcgmonDatabase } from "./db.js";

const DAEMON_VERSION = "0.1.0";

export type StartDaemonOptions = {
  port?: number;
  homeDir?: string;
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
  const startedAtMs = Date.now();

  const app = createApp({
    bus,
    db,
    startedAtMs,
  });

  const requestedPort = options.port ?? config.defaultPort;
  const server = await listen(app, requestedPort);

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("daemon failed to acquire a numeric port");
  }
  const selectedPort = address.port;

  options.log?.(`ccgmon daemon listening on 127.0.0.1:${selectedPort}`);

  return {
    db,
    getSubscriberCount: () => bus.subscriberCount(),
    port: selectedPort,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
      db.close();
    },
  };
}

export function createApp(dependencies: {
  bus: SseBus;
  db: CcgmonDatabase;
  startedAtMs: number;
}): Hono {
  const app = new Hono();

  registerEventRoutes(app, {
    bus: dependencies.bus,
    db: dependencies.db,
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

async function listen(app: Hono, port: number): Promise<ServerType> {
  let serverRef: ServerType;
  await new Promise<void>((resolve, reject) => {
    serverRef = serve(
      {
        fetch: app.fetch,
        hostname: "127.0.0.1",
        port,
      },
      () => resolve(),
    );
    serverRef.once("error", reject);
  });
  return serverRef!;
}
