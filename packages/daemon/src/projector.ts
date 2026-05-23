import { join } from "node:path";

import { EventSchema } from "@ccgmon/shared/events";
import type { Event, PhaseUpdatedEvent } from "@ccgmon/shared/types";

import { type CcgmonDatabase, type StoredEventRow } from "./db.js";
import { parseHandoverFile } from "./parsers/handover.js";
import { parsePhaseFile } from "./parsers/phase.js";
import { parsePlanFile } from "./parsers/plan.js";

const PROJECTOR_BATCH_SIZE = 100;

export class EventProjector {
  private readonly db: CcgmonDatabase;
  private pollingTimer: NodeJS.Timeout | null = null;
  private lastRowId = 0;
  private polling = false;

  public constructor(db: CcgmonDatabase) {
    this.db = db;
  }

  public startPolling(intervalMs = 200): void {
    if (this.pollingTimer) {
      return;
    }
    this.pollingTimer = setInterval(() => {
      void this.pollOnce();
    }, intervalMs);
  }

  public stopPolling(): void {
    if (!this.pollingTimer) {
      return;
    }
    clearInterval(this.pollingTimer);
    this.pollingTimer = null;
  }

  public async pollOnce(): Promise<number> {
    if (this.polling) {
      return 0;
    }
    this.polling = true;

    try {
      let processedCount = 0;

      for (;;) {
        const rows = this.db.listEventsAfterRowId(this.lastRowId, PROJECTOR_BATCH_SIZE);
        if (rows.length === 0) {
          break;
        }

        for (const row of rows) {
          this.lastRowId = Math.max(this.lastRowId, row.row_id);
          const parsed = parseEventRow(row);
          if (!parsed) {
            continue;
          }
          await this.projectEvent(parsed);
          processedCount += 1;
        }

        if (rows.length < PROJECTOR_BATCH_SIZE) {
          break;
        }
      }

      return processedCount;
    } finally {
      this.polling = false;
    }
  }

  public async projectEvent(event: Event): Promise<void> {
    const registration = this.db.upsertProjectByRepoRoot(event.repo_root, event.ts);
    if (registration.project.status !== "ACTIVE") {
      return;
    }

    const slug = event.plan_slug;
    if (!slug) {
      return;
    }
    const projectId = registration.project.project_id;

    switch (event.event_type) {
      case "plan.discovered":
      case "plan.updated":
        await this.projectPlanEvent(event, projectId, slug);
        break;
      case "phase.updated":
        await this.projectPhaseEvent(event, projectId, slug);
        break;
      case "handover.updated":
        await this.projectHandoverEvent(event, projectId, slug);
        break;
      case "sessions.updated":
        this.projectSessionsEvent(event, projectId, slug);
        break;
      default:
        break;
    }
  }

  private async projectPlanEvent(
    event: Event,
    projectId: string,
    slug: string,
  ): Promise<void> {
    if (event.event_type !== "plan.updated" && event.event_type !== "plan.discovered") {
      return;
    }

    const planPath = join(event.repo_root, "docs", "plans", slug, "PLAN.md");
    const parsedPlan = await parsePlanFile(planPath);
    const existingPlan = this.db.getPlan(projectId, slug).plan;

    this.db.upsertPlanProjection({
      projectId,
      slug,
      title: existingPlan?.title ?? slug,
      status: existingPlan?.status ?? "ACTIVE",
      currentPhase: existingPlan?.current_phase ?? null,
      handoverStatus: existingPlan?.handover_status ?? null,
      updatedAt: event.ts,
    });

    if (!parsedPlan) {
      return;
    }

    for (const phase of parsedPlan.phases) {
      this.db.upsertPhaseProjection({
        projectId,
        slug,
        phaseId: phase.phase_id,
        title: phase.title,
        owner: phase.owner,
        gateState: null,
        startedAt: null,
        completedAt: null,
      });
    }
  }

  private async projectPhaseEvent(
    event: Event,
    projectId: string,
    slug: string,
  ): Promise<void> {
    if (event.event_type !== "phase.updated") {
      return;
    }

    const payload = event.payload as PhaseUpdatedEvent["payload"];
    const phasePath = join(
      event.repo_root,
      "docs",
      "plans",
      slug,
      `PHASE-${payload.phase_id}.md`,
    );
    const parsedPhase = await parsePhaseFile(phasePath);
    if (!parsedPhase) {
      return;
    }

    const existingPlan = this.db.getPlan(projectId, slug).plan;
    this.db.upsertPlanProjection({
      projectId,
      slug,
      title: existingPlan?.title ?? slug,
      status: existingPlan?.status ?? "ACTIVE",
      currentPhase: existingPlan?.current_phase ?? null,
      handoverStatus: existingPlan?.handover_status ?? null,
      updatedAt: event.ts,
    });

    const statusUpper = parsedPhase.status.toUpperCase();
    this.db.upsertPhaseProjection({
      projectId,
      slug,
      phaseId: parsedPhase.phase_id,
      title: parsedPhase.title,
      owner: parsedPhase.owner,
      gateState: statusUpper,
      startedAt: statusUpper === "PENDING" ? null : event.ts,
      completedAt: statusUpper === "DONE" || statusUpper === "COMPLETED" ? event.ts : null,
    });

    this.db.syncPhaseTasks({
      projectId,
      slug,
      phaseId: parsedPhase.phase_id,
      tasks: parsedPhase.tasks.map((task) => ({
        taskId: task.task_id,
        title: task.title,
        status: task.done ? "DONE" : "PENDING",
        filesJson: JSON.stringify(parsedPhase.files_modified),
      })),
    });
  }

  private async projectHandoverEvent(
    event: Event,
    projectId: string,
    slug: string,
  ): Promise<void> {
    if (event.event_type !== "handover.updated") {
      return;
    }

    const handoverPath = join(event.repo_root, "docs", "plans", slug, ".handover.md");
    const parsedHandover = await parseHandoverFile(handoverPath);
    const existingPlan = this.db.getPlan(projectId, slug).plan;

    this.db.upsertPlanProjection({
      projectId,
      slug,
      title: existingPlan?.title ?? slug,
      status: parsedHandover?.status ?? existingPlan?.status ?? "ACTIVE",
      currentPhase: parsedHandover?.current_phase ?? existingPlan?.current_phase ?? null,
      handoverStatus: event.payload.status,
      updatedAt: event.ts,
    });
  }

  private projectSessionsEvent(event: Event, projectId: string, slug: string): void {
    if (event.event_type !== "sessions.updated") {
      return;
    }

    this.db.syncSessionsCache({
      projectId,
      slug,
      entries: event.payload.sessions.map((entry) => ({
        backend: entry.backend,
        sessionId: entry.mcp_session_id,
        lastUsed: event.ts,
      })),
    });
  }
}

function parseEventRow(row: StoredEventRow): Event | null {
  let payload: unknown;
  try {
    payload = JSON.parse(row.payload_json) as unknown;
  } catch {
    console.warn(`[ccgmon/projector] malformed payload JSON for event ${row.event_id}`);
    return null;
  }

  const parsed = EventSchema.safeParse({
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
  });

  if (!parsed.success) {
    console.warn(`[ccgmon/projector] invalid event row skipped: ${row.event_id}`);
    return null;
  }

  return parsed.data;
}
