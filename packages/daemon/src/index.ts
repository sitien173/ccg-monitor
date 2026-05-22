import { Hono } from "hono";
import { serve, type ServerType } from "@hono/node-server";

import { loadConfig } from "./config.js";
import { CcgmonDatabase } from "./db.js";

export type StartDaemonOptions = {
  port?: number;
  homeDir?: string;
  log?: (message: string) => void;
};

export type DaemonRuntime = {
  port: number;
  close: () => Promise<void>;
};

export async function startDaemon(options: StartDaemonOptions = {}): Promise<DaemonRuntime> {
  const config = await loadConfig(options.homeDir);
  const db = new CcgmonDatabase(config.dbPath);

  const app = new Hono();
  app.get("/healthz", (context) =>
    context.json({
      ok: true,
      version: "0.1.0",
      uptime_s: 0,
      event_count: db.countEvents(),
      db_size_bytes: db.getHealthSnapshot().dbSizeBytes,
    }),
  );

  const requestedPort = options.port ?? config.defaultPort;
  const server = await listen(app, requestedPort);

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("daemon failed to acquire a numeric port");
  }
  const selectedPort = address.port;

  options.log?.(`ccgmon daemon listening on 127.0.0.1:${selectedPort}`);

  return {
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
