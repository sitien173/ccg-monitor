import type { Hono } from "hono";

import type { CcgmonDatabase } from "../db.js";

export function registerPlansRoutes(
  app: Hono,
  dependencies: {
    db: CcgmonDatabase;
  },
): void {
  app.get("/api/plans/:projectId/:slug", (context) => {
    const projectId = context.req.param("projectId");
    const slug = context.req.param("slug");
    const planData = dependencies.db.getPlan(projectId, slug);

    if (!planData.plan) {
      return context.json({ error: "plan_not_found" }, 404);
    }

    return context.json({
      phases: planData.phases,
      plan: planData.plan,
      tasks: planData.tasks.map((task) => ({
        ...task,
        files: parseFilesJson(task.files_json),
      })),
    });
  });
}

function parseFilesJson(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((entry): entry is string => typeof entry === "string");
  } catch {
    return [];
  }
}
