import type { Hono } from "hono";

import type { CcgmonDatabase } from "../db.js";

export function registerExportRoutes(
  app: Hono,
  dependencies: {
    db: CcgmonDatabase;
  },
): void {
  app.get("/api/projections/export", (context) => {
    return context.json(dependencies.db.exportProjectionTables());
  });
}
