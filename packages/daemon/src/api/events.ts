import type { Hono } from "hono";

import { EventSchema } from "@ccgmon/shared/events";

import type { SseBus } from "../bus.js";
import type { CcgmonDatabase } from "../db.js";

export function registerEventRoutes(
  app: Hono,
  dependencies: {
    bus: SseBus;
    db: CcgmonDatabase;
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

    dependencies.db.insertEvent(parsed.data);
    dependencies.bus.broadcast(parsed.data);

    return context.json({ accepted: true }, 202);
  });
}
