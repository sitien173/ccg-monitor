import type { Hono } from "hono";

import type { CcgmonDatabase } from "../db.js";

export function registerProjectsRoutes(
  app: Hono,
  dependencies: {
    db: CcgmonDatabase;
  },
): void {
  app.get("/api/projects", (context) => {
    const projects = dependencies.db.listProjects();
    return context.json(projects);
  });
}
