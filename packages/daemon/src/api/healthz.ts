import type { Hono } from "hono";

import type { CcgmonDatabase } from "../db.js";

export function registerHealthzRoutes(
  app: Hono,
  dependencies: {
    db: CcgmonDatabase;
    startedAtMs: number;
    version: string;
  },
): void {
  app.get("/healthz", (context) => {
    const snapshot = dependencies.db.getHealthSnapshot();
    return context.json({
      ok: true,
      version: dependencies.version,
      uptime_s: Math.floor((Date.now() - dependencies.startedAtMs) / 1000),
      event_count: snapshot.eventCount,
      db_size_bytes: snapshot.dbSizeBytes,
    });
  });
}
