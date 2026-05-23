import { readdir } from "node:fs/promises";
import { hostname } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import type { Event } from "@ccgmon/shared/types";

import { type CcgmonDatabase, normalizeRepoRoot } from "./db.js";
import { type EventProjector } from "./projector.js";
import { parseHandoverFile } from "./parsers/handover.js";
import { parsePhaseFile } from "./parsers/phase.js";
import { parseSessionsFile } from "./parsers/sessions.js";

type BackfillResult = {
  emitted: number;
};

export async function backfillRepoPlans(options: {
  db: CcgmonDatabase;
  projector: EventProjector;
  projectId: string;
  repoRoot: string;
}): Promise<BackfillResult> {
  const normalizedRepoRoot = normalizeRepoRoot(options.repoRoot);
  const plansRoot = join(normalizedRepoRoot, "docs", "plans");

  let planDirectories: string[];
  try {
    const entries = await readdir(plansRoot, { withFileTypes: true });
    planDirectories = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return { emitted: 0 };
  }

  let emitted = 0;

  for (const slug of planDirectories) {
    emitted += await emitPlanBundle({
      db: options.db,
      projector: options.projector,
      projectId: options.projectId,
      repoRoot: normalizedRepoRoot,
      slug,
    });
  }

  return { emitted };
}

async function emitPlanBundle(options: {
  db: CcgmonDatabase;
  projector: EventProjector;
  projectId: string;
  repoRoot: string;
  slug: string;
}): Promise<number> {
  let emitted = 0;
  const planDir = join(options.repoRoot, "docs", "plans", options.slug);

  emitted += await emitBackfillEvent(options, {
    event_type: "plan.updated",
    payload: {
      slug: options.slug,
      diff_summary: "backfill scan",
    },
  });

  const handover = await parseHandoverFile(join(planDir, ".handover.md"));
  if (handover) {
    emitted += await emitBackfillEvent(options, {
      event_type: "handover.updated",
      payload: {
        slug: options.slug,
        status: handover.status.toUpperCase() === "COMPLETED" ? "COMPLETED" : "ACTIVE",
        current_phase: handover.current_phase,
      },
    });
  }

  const sessions = await parseSessionsFile(join(planDir, ".sessions.json"));
  const sessionEntries = Object.entries(sessions)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    .filter((entry): entry is ["codex" | "agy", string] => {
      const backend = entry[0];
      return backend === "codex" || backend === "agy";
    })
    .map(([backend, sessionId]) => ({
      backend,
      mcp_session_id: sessionId,
    }));
  emitted += await emitBackfillEvent(options, {
    event_type: "sessions.updated",
    payload: {
      slug: options.slug,
      sessions: sessionEntries,
    },
  });

  let phaseFiles: string[];
  try {
    const entries = await readdir(planDir, { withFileTypes: true });
    phaseFiles = entries
      .filter((entry) => entry.isFile() && /^PHASE-[0-9]+\.md$/i.test(entry.name))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  } catch {
    return emitted;
  }

  for (const phaseFile of phaseFiles) {
    const phase = await parsePhaseFile(join(planDir, phaseFile));
    if (!phase) {
      continue;
    }

    const normalizedOwner = normalizeOwner(phase.owner);
    emitted += await emitBackfillEvent(options, {
      event_type: "phase.updated",
      payload: {
        slug: options.slug,
        phase_id: phase.phase_id,
        status: phase.status,
        owner: normalizedOwner,
      },
    });
  }

  return emitted;
}

async function emitBackfillEvent(
  options: {
    db: CcgmonDatabase;
    projector: EventProjector;
    projectId: string;
    repoRoot: string;
    slug: string;
  },
  eventInput:
    | {
        event_type: "plan.updated";
        payload: Event["payload"];
      }
    | {
        event_type: "handover.updated";
        payload: Event["payload"];
      }
    | {
        event_type: "sessions.updated";
        payload: Event["payload"];
      }
    | {
        event_type: "phase.updated";
        payload: Event["payload"];
      },
): Promise<number> {
  const event = {
    event_id: generateUuidV7Like(),
    event_type: eventInput.event_type,
    event_version: 1,
    ts: new Date().toISOString(),
    source: "backfill",
    machine_id: hostname(),
    project_id: options.projectId,
    repo_root: options.repoRoot,
    session_id: null,
    plan_slug: options.slug,
    payload: eventInput.payload,
  } as Event;

  options.db.insertEvent(event);
  await options.projector.projectEvent(event);
  return 1;
}

function generateUuidV7Like(): string {
  const random = randomUUID().toLowerCase();
  return `${random.slice(0, 14)}7${random.slice(15)}`;
}

function normalizeOwner(value: string): "claude" | "codex" | "gemini" {
  const lowered = value.toLowerCase();
  if (lowered === "claude") {
    return "claude";
  }
  if (lowered === "gemini") {
    return "gemini";
  }
  return "codex";
}
