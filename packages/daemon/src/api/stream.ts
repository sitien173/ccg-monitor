import type { Hono } from "hono";

import type { SseBus } from "../bus.js";

export function registerStreamRoutes(
  app: Hono,
  dependencies: {
    bus: SseBus;
  },
): void {
  app.get("/stream", (context) => {
    const subscription = dependencies.bus.subscribe();
    const signal = context.req.raw.signal;

    if (signal.aborted) {
      subscription.close();
      return new Response(null, { status: 204 });
    }

    signal.addEventListener("abort", () => subscription.close(), { once: true });
    return subscription.response;
  });
}
