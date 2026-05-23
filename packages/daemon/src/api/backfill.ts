import type { Hono } from "hono";

import { backfillRepoPlans } from "../backfill.js";
import type { CcgmonDatabase } from "../db.js";
import type { EventProjector } from "../projector.js";

export function registerBackfillRoutes(
  app: Hono,
  dependencies: {
    db: CcgmonDatabase;
    projector: EventProjector;
  },
): void {
  app.post("/api/backfill", async (context) => {
    const body = await context.req.json().catch(() => null);
    const repoRoot = typeof body?.repo_root === "string" ? body.repo_root.trim() : "";
    if (repoRoot.length === 0) {
      return context.json({ error: "repo_root is required" }, 400);
    }

    const registration = dependencies.db.upsertProjectByRepoRoot(
      repoRoot,
      new Date().toISOString(),
    );
    const result = await backfillRepoPlans({
      db: dependencies.db,
      projector: dependencies.projector,
      projectId: registration.project.project_id,
      repoRoot: registration.project.repo_root,
    });

    return context.json({ emitted: result.emitted });
  });
}
