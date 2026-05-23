import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { hostname } from "node:os";
import { basename, join } from "node:path";

import type { Event } from "@ccgmon/shared/types";

import { type CcgmonDatabase, normalizeRepoRoot } from "./db.js";
import { parseHandoverFile } from "./parsers/handover.js";
import { parsePhaseFile } from "./parsers/phase.js";
import { parseSessionsFile } from "./parsers/sessions.js";
import type { EventProjector } from "./projector.js";
import type { PlanWatcher } from "./watcher.js";

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export class ReconcileWorker {
  private readonly db: CcgmonDatabase;
  private readonly projector: EventProjector;
  private readonly watcher: PlanWatcher;
  private readonly knownMtimes = new Map<string, number>();
  private timer: NodeJS.Timeout | null = null;

  public constructor(options: {
    db: CcgmonDatabase;
    projector: EventProjector;
    watcher: PlanWatcher;
  }) {
    this.db = options.db;
    this.projector = options.projector;
    this.watcher = options.watcher;
  }

  public start(): void {
    if (this.timer) {
      return;
    }
    this.timer = setInterval(() => {
      void this.runOnce();
    }, FIVE_MINUTES_MS);
  }

  public stop(): void {
    if (!this.timer) {
      return;
    }
    clearInterval(this.timer);
    this.timer = null;
  }

  public async runOnce(): Promise<number> {
    const nowIso = new Date().toISOString();
    const projects = this.db.listProjects();

    for (const project of projects) {
      const ignorePath = join(project.repo_root, ".ccgmon-ignore");
      if (existsSync(ignorePath)) {
        if (project.status !== "IGNORED") {
          this.db.setProjectStatusByRepoRoot(project.repo_root, "IGNORED", nowIso);
        }
        await this.watcher.removeRoot(project.repo_root);
        continue;
      }
      if (project.status === "ACTIVE") {
        await this.watcher.addRoot(project.repo_root);
      }
    }

    const trackedPaths = new Set<string>();
    let emitted = 0;

    for (const project of projects) {
      if (project.status !== "ACTIVE") {
        continue;
      }

      for (const slug of this.db.listPlanSlugsByProject(project.project_id)) {
        const baseDir = join(project.repo_root, "docs", "plans", slug);
        const candidates = [
          join(baseDir, "PLAN.md"),
          join(baseDir, ".handover.md"),
          join(baseDir, ".sessions.json"),
          ...this.db
            .listPhaseIdsByPlan(project.project_id, slug)
            .map((phaseId) => join(baseDir, `PHASE-${phaseId}.md`)),
        ];

        for (const candidate of candidates) {
          const normalizedCandidate = normalizeRepoRoot(candidate);
          trackedPaths.add(normalizedCandidate);

          let currentMtime = 0;
          try {
            const fileStat = await stat(candidate);
            currentMtime = fileStat.mtimeMs;
          } catch {
            continue;
          }

          const previous = this.knownMtimes.get(normalizedCandidate);
          this.knownMtimes.set(normalizedCandidate, currentMtime);

          if (previous === undefined || previous === currentMtime) {
            continue;
          }

          const emittedChange = await emitSyntheticEventForFile({
            db: this.db,
            projector: this.projector,
            projectId: project.project_id,
            repoRoot: project.repo_root,
            filePath: candidate,
            source: "fs_watcher",
          });
          if (emittedChange) {
            emitted += 1;
          }
        }
      }
    }

    for (const knownPath of this.knownMtimes.keys()) {
      if (trackedPaths.has(knownPath)) {
        continue;
      }
      this.knownMtimes.delete(knownPath);
    }

    return emitted;
  }
}

export async function emitSyntheticEventForFile(options: {
  db: CcgmonDatabase;
  projector: EventProjector;
  projectId: string;
  repoRoot: string;
  filePath: string;
  source: "fs_watcher" | "backfill";
}): Promise<boolean> {
  const normalizedFilePath = normalizeRepoRoot(options.filePath);
  const normalizedRepoRoot = normalizeRepoRoot(options.repoRoot);

  const marker = "/docs/plans/";
  const markerIndex = normalizedFilePath.indexOf(marker);
  if (markerIndex === -1) {
    return false;
  }

  const afterMarker = normalizedFilePath.slice(markerIndex + marker.length);
  const parts = afterMarker.split("/").filter((entry) => entry.length > 0);
  if (parts.length < 2) {
    return false;
  }

  const slug = parts[0] ?? "";
  const fileName = parts[1] ?? "";
  if (!slug || !fileName) {
    return false;
  }

  const baseEvent = {
    event_id: generateUuidV7Like(),
    event_version: 1,
    ts: new Date().toISOString(),
    source: options.source,
    machine_id: hostname(),
    project_id: options.projectId,
    repo_root: normalizedRepoRoot,
    session_id: null,
    plan_slug: slug,
  } as const;

  if (fileName === "PLAN.md") {
    await storeProjectedEvent(options, {
      ...baseEvent,
      event_type: "plan.updated",
      payload: {
        slug,
        diff_summary: `synthetic update from ${basename(normalizedFilePath)}`,
      },
    });
    return true;
  }

  if (fileName === ".handover.md") {
    const handover = await parseHandoverFile(normalizedFilePath);
    await storeProjectedEvent(options, {
      ...baseEvent,
      event_type: "handover.updated",
      payload: {
        slug,
        status: handover?.status.toUpperCase() === "COMPLETED" ? "COMPLETED" : "ACTIVE",
        current_phase: handover?.current_phase ?? null,
      },
    });
    return true;
  }

  if (fileName === ".sessions.json") {
    const sessions = await parseSessionsFile(normalizedFilePath);
    const normalizedSessions = Object.entries(sessions)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string")
      .filter((entry): entry is ["codex" | "agy", string] => {
        const backend = entry[0];
        return backend === "codex" || backend === "agy";
      })
      .map(([backend, sessionId]) => ({
        backend,
        mcp_session_id: sessionId,
      }));

    await storeProjectedEvent(options, {
      ...baseEvent,
      event_type: "sessions.updated",
      payload: {
        slug,
        sessions: normalizedSessions,
      },
    });
    return true;
  }

  const phaseMatch = fileName.match(/^PHASE-([0-9]+)\.md$/i);
  if (!phaseMatch) {
    return false;
  }

  const phase = await parsePhaseFile(normalizedFilePath);
  if (!phase) {
    return false;
  }

  await storeProjectedEvent(options, {
    ...baseEvent,
    event_type: "phase.updated",
    payload: {
      slug,
      phase_id: phase.phase_id,
      status: phase.status,
      owner: normalizeOwner(phase.owner),
    },
  });

  return true;
}

async function storeProjectedEvent(
  options: {
    db: CcgmonDatabase;
    projector: EventProjector;
  },
  event: Event,
): Promise<void> {
  options.db.insertEvent(event);
  await options.projector.projectEvent(event);
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

function generateUuidV7Like(): string {
  const random = randomUUID().toLowerCase();
  return `${random.slice(0, 14)}7${random.slice(15)}`;
}
