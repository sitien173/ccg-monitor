import type { Hono } from "hono";

import { EventSchema } from "@ccgmon/shared/events";

import { backfillRepoPlans } from "../backfill.js";
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
    if (ensured?.created) {
      await backfillRepoPlans({
        db: dependencies.db,
        projector: dependencies.projector,
        projectId: ensured.projectId,
        repoRoot: ensured.repoRoot,
      });
    }

    dependencies.db.insertEvent(parsed.data);
    await dependencies.projector.projectEvent(parsed.data);
    dependencies.bus.broadcast(parsed.data);

    return context.json({ accepted: true }, 202);
  });

  app.get("/api/events", (context) => {
    const rawEvents = dependencies.db.getRecentEvents(100);
    const parsedEvents = rawEvents.map((row) => {
      let payload: unknown = {};
      try {
        payload = JSON.parse(row.payload_json);
      } catch (err) {
        // ignore
      }
      return {
        event_id: row.event_id,
        event_type: row.event_type,
        event_version: row.event_version,
        ts: row.ts,
        source: row.source,
        machine_id: row.machine_id,
        project_id: row.project_id,
        repo_root: row.repo_root,
        session_id: row.session_id,
        plan_slug: row.plan_slug,
        payload,
      };
    });
    return context.json(parsedEvents);
  });
}
