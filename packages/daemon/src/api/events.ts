import type { Hono } from "hono";

import { EventSchema } from "@ccgmon/shared/events";

import type { SseBus } from "../bus.js";
import type { CcgmonDatabase } from "../db.js";
import type { EventProjector } from "../projector.js";
import type { PlanWatcher } from "../watcher.js";

export function registerEventRoutes(
  app: Hono,
  dependencies: {
    bus: SseBus;
    db: CcgmonDatabase;
    projector: EventProjector;
    watcher?: PlanWatcher;
  },
): void {
  app.post("/events", async (context) => {
    const payload = await context.req.json().catch(() => undefined);
    const parsed = EventSchema.safeParse(payload);
    if (!parsed.success) {
      return context.json(
        {
          error: "invalid_event",
          issues: parsed.error.issues.map((issue) => ({
            code: issue.code,
            message: issue.message,
            path: issue.path.join("."),
          })),
        },
        400,
      );
    }

    const ensured = await dependencies.watcher?.ensureProjectForRepoRoot(parsed.data.repo_root);
    if (ensured?.ignored) {
      return context.json({ accepted: true, ignored: true }, 200);
    }

    dependencies.db.insertEvent(parsed.data);
    await dependencies.projector.projectEvent(parsed.data);
    dependencies.bus.broadcast(parsed.data);

    return context.json({ accepted: true }, 202);
  });
}
