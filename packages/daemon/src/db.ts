import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";

import type { Event } from "@ccgmon/shared/types";

const CURRENT_SCHEMA_VERSION = 1;

type EventRow = {
  event_id: string;
  event_type: string;
  event_version: number;
  ts: string;
  source: string;
  machine_id: string;
  project_id: string;
  repo_root: string;
  session_id: string | null;
  plan_slug: string | null;
  payload_json: string;
};

export type StoredEventRow = EventRow & {
  row_id: number;
};

export type PlanRow = {
  project_id: string;
  slug: string;
  title: string | null;
  status: string;
  current_phase: string | null;
  handover_status: string | null;
  updated_at: string;
};

export type PhaseRow = {
  project_id: string;
  slug: string;
  phase_id: string;
  title: string | null;
  owner: string | null;
  gate_state: string | null;
  started_at: string | null;
  completed_at: string | null;
};

export type TaskRow = {
  project_id: string;
  slug: string;
  phase_id: string;
  task_id: string;
  title: string;
  status: string;
  files_json: string;
};

export type ProjectRow = {
  project_id: string;
  repo_root: string;
  remote_url: string | null;
  status: string;
  first_seen: string;
  last_seen: string;
};

type InsertResult = {
  changes: number;
};

/**
 * P2 keeps a single synchronous writer via one better-sqlite3 connection.
 * P3 projector relies on this single-writer pattern for deterministic ordering.
 */
export class CcgmonDatabase {
  private readonly db: Database.Database;
  private readonly insertEventStatement: Database.Statement;

  public constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.runMigrations();

    this.insertEventStatement = this.db.prepare(
      `
      INSERT INTO events (
        event_id,
        event_type,
        event_version,
        ts,
        source,
        machine_id,
        project_id,
        repo_root,
        session_id,
        plan_slug,
        payload_json
      ) VALUES (
        @event_id,
        @event_type,
        @event_version,
        @ts,
        @source,
        @machine_id,
        @project_id,
        @repo_root,
        @session_id,
        @plan_slug,
        @payload_json
      );
      `,
    );
  }

  public close(): void {
    this.db.pragma("wal_checkpoint(FULL)");
    this.db.close();
  }

  public getJournalMode(): string {
    const row = this.db.prepare("PRAGMA journal_mode;").get() as {
      journal_mode: string;
    };
    return row.journal_mode;
  }

  public insertEvent(event: Event): void {
    const row: EventRow = {
      event_id: event.event_id,
      event_type: event.event_type,
      event_version: event.event_version,
      ts: event.ts,
      source: event.source,
      machine_id: event.machine_id,
      project_id: event.project_id,
      repo_root: event.repo_root,
      session_id: event.session_id,
      plan_slug: event.plan_slug,
      payload_json: JSON.stringify(event.payload),
    };
    this.insertEventStatement.run(row);
  }

  public listProjects(): ProjectRow[] {
    return this.db
      .prepare(
        `
        SELECT project_id, repo_root, remote_url, status, first_seen, last_seen
        FROM projects
        ORDER BY last_seen DESC, project_id ASC;
        `,
      )
      .all() as ProjectRow[];
  }

  public listWatchableRepoRoots(): string[] {
    const rows = this.db
      .prepare(
        `
        SELECT repo_root
        FROM projects
        WHERE status = 'ACTIVE'
        ORDER BY repo_root ASC;
        `,
      )
      .all() as Array<{ repo_root: string }>;
    return rows.map((row) => row.repo_root);
  }

  public getProjectByRepoRoot(repoRoot: string): ProjectRow | null {
    const normalizedRepoRoot = normalizeRepoRoot(repoRoot);
    const row = this.db
      .prepare(
        `
        SELECT project_id, repo_root, remote_url, status, first_seen, last_seen
        FROM projects
        WHERE repo_root = ?;
        `,
      )
      .get(normalizedRepoRoot) as ProjectRow | undefined;

    return row ?? null;
  }

  public upsertProjectByRepoRoot(repoRoot: string, nowIso: string): {
    created: boolean;
    project: ProjectRow;
  } {
    const normalizedRepoRoot = normalizeRepoRoot(repoRoot);
    const existing = this.getProjectByRepoRoot(normalizedRepoRoot);

    if (existing) {
      this.db
        .prepare(
          `
          UPDATE projects
          SET last_seen = ?
          WHERE repo_root = ?;
          `,
        )
        .run(nowIso, normalizedRepoRoot);
      const updated = this.getProjectByRepoRoot(normalizedRepoRoot);
      if (!updated) {
        throw new Error(`project row disappeared for ${normalizedRepoRoot}`);
      }
      return {
        created: false,
        project: updated,
      };
    }

    const projectId = projectIdFromRepoRoot(normalizedRepoRoot);
    this.db
      .prepare(
        `
        INSERT INTO projects (project_id, repo_root, status, first_seen, last_seen)
        VALUES (?, ?, 'ACTIVE', ?, ?);
        `,
      )
      .run(projectId, normalizedRepoRoot, nowIso, nowIso);

    const created = this.getProjectByRepoRoot(normalizedRepoRoot);
    if (!created) {
      throw new Error(`failed to insert project for ${normalizedRepoRoot}`);
    }

    return {
      created: true,
      project: created,
    };
  }

  public setProjectStatusByRepoRoot(repoRoot: string, status: string, nowIso: string): void {
    const normalizedRepoRoot = normalizeRepoRoot(repoRoot);
    this.db
      .prepare(
        `
        UPDATE projects
        SET status = ?, last_seen = ?
        WHERE repo_root = ?;
        `,
      )
      .run(status, nowIso, normalizedRepoRoot);
  }

  public getPlan(projectId: string, slug: string): {
    plan: PlanRow | null;
    phases: PhaseRow[];
    tasks: TaskRow[];
  } {
    const plan = this.db
      .prepare(
        `
        SELECT project_id, slug, title, status, current_phase, handover_status, updated_at
        FROM plans
        WHERE project_id = ? AND slug = ?;
        `,
      )
      .get(projectId, slug) as PlanRow | undefined;

    if (!plan) {
      return { plan: null, phases: [], tasks: [] };
    }

    const phases = this.db
      .prepare(
        `
        SELECT project_id, slug, phase_id, title, owner, gate_state, started_at, completed_at
        FROM phases
        WHERE project_id = ? AND slug = ?
        ORDER BY phase_id ASC;
        `,
      )
      .all(projectId, slug) as PhaseRow[];

    const tasks = this.db
      .prepare(
        `
        SELECT project_id, slug, phase_id, task_id, title, status, files_json
        FROM tasks
        WHERE project_id = ? AND slug = ?
        ORDER BY phase_id ASC, task_id ASC;
        `,
      )
      .all(projectId, slug) as TaskRow[];

    return { plan, phases, tasks };
  }

  public getHealthSnapshot(): {
    eventCount: number;
    dbSizeBytes: number;
  } {
    const row = this.db.prepare("SELECT COUNT(*) AS count FROM events;").get() as {
      count: number;
    };
    const sizeRow = this.db
      .prepare(
        `
        SELECT
          (SELECT page_count FROM pragma_page_count) *
          (SELECT page_size FROM pragma_page_size) AS size_bytes;
        `,
      )
      .get() as { size_bytes: number };

    return {
      eventCount: row.count,
      dbSizeBytes: sizeRow.size_bytes,
    };
  }

  public countEvents(): number {
    const row = this.db.prepare("SELECT COUNT(*) AS count FROM events;").get() as {
      count: number;
    };
    return row.count;
  }

  public listEventsByRowOrder(): Array<{ event_id: string; event_type: string }> {
    return this.db
      .prepare(
        `
        SELECT event_id, event_type
        FROM events
        ORDER BY row_id ASC;
        `,
      )
      .all() as Array<{ event_id: string; event_type: string }>;
  }

  public listEventsAfterRowId(afterRowId: number, limit = 100): StoredEventRow[] {
    return this.db
      .prepare(
        `
        SELECT
          row_id,
          event_id,
          event_type,
          event_version,
          ts,
          source,
          machine_id,
          project_id,
          repo_root,
          session_id,
          plan_slug,
          payload_json
        FROM events
        WHERE row_id > ?
        ORDER BY row_id ASC
        LIMIT ?;
        `,
      )
      .all(afterRowId, limit) as StoredEventRow[];
  }

  public upsertPlanProjection(input: {
    projectId: string;
    slug: string;
    title: string | null;
    status: string;
    currentPhase: string | null;
    handoverStatus: string | null;
    updatedAt: string;
  }): boolean {
    const existing = this.db
      .prepare(
        `
        SELECT title, status, current_phase, handover_status, updated_at
        FROM plans
        WHERE project_id = ? AND slug = ?;
        `,
      )
      .get(input.projectId, input.slug) as
      | {
          title: string | null;
          status: string;
          current_phase: string | null;
          handover_status: string | null;
          updated_at: string;
        }
      | undefined;

    if (!existing) {
      this.db
        .prepare(
          `
          INSERT INTO plans (project_id, slug, title, status, current_phase, handover_status, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?);
          `,
        )
        .run(
          input.projectId,
          input.slug,
          input.title,
          input.status,
          input.currentPhase,
          input.handoverStatus,
          input.updatedAt,
        );
      return true;
    }

    const changedColumns: string[] = [];
    const params: Array<string | null> = [];

    if (existing.title !== input.title) {
      changedColumns.push("title = ?");
      params.push(input.title);
    }
    if (existing.status !== input.status) {
      changedColumns.push("status = ?");
      params.push(input.status);
    }
    if (existing.current_phase !== input.currentPhase) {
      changedColumns.push("current_phase = ?");
      params.push(input.currentPhase);
    }
    if (existing.handover_status !== input.handoverStatus) {
      changedColumns.push("handover_status = ?");
      params.push(input.handoverStatus);
    }
    if (existing.updated_at !== input.updatedAt) {
      changedColumns.push("updated_at = ?");
      params.push(input.updatedAt);
    }

    if (changedColumns.length === 0) {
      return false;
    }

    params.push(input.projectId, input.slug);
    this.db
      .prepare(
        `
        UPDATE plans
        SET ${changedColumns.join(", ")}
        WHERE project_id = ? AND slug = ?;
        `,
      )
      .run(...params);
    return true;
  }

  public upsertPhaseProjection(input: {
    projectId: string;
    slug: string;
    phaseId: string;
    title: string | null;
    owner: string | null;
    gateState: string | null;
    startedAt: string | null;
    completedAt: string | null;
  }): boolean {
    const existing = this.db
      .prepare(
        `
        SELECT title, owner, gate_state, started_at, completed_at
        FROM phases
        WHERE project_id = ? AND slug = ? AND phase_id = ?;
        `,
      )
      .get(input.projectId, input.slug, input.phaseId) as
      | {
          title: string | null;
          owner: string | null;
          gate_state: string | null;
          started_at: string | null;
          completed_at: string | null;
        }
      | undefined;

    if (!existing) {
      this.db
        .prepare(
          `
          INSERT INTO phases (
            project_id,
            slug,
            phase_id,
            title,
            owner,
            gate_state,
            started_at,
            completed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
          `,
        )
        .run(
          input.projectId,
          input.slug,
          input.phaseId,
          input.title,
          input.owner,
          input.gateState,
          input.startedAt,
          input.completedAt,
        );
      return true;
    }

    const changedColumns: string[] = [];
    const params: Array<string | null> = [];
    if (existing.title !== input.title) {
      changedColumns.push("title = ?");
      params.push(input.title);
    }
    if (existing.owner !== input.owner) {
      changedColumns.push("owner = ?");
      params.push(input.owner);
    }
    if (existing.gate_state !== input.gateState) {
      changedColumns.push("gate_state = ?");
      params.push(input.gateState);
    }
    if (existing.started_at !== input.startedAt) {
      changedColumns.push("started_at = ?");
      params.push(input.startedAt);
    }
    if (existing.completed_at !== input.completedAt) {
      changedColumns.push("completed_at = ?");
      params.push(input.completedAt);
    }

    if (changedColumns.length === 0) {
      return false;
    }

    params.push(input.projectId, input.slug, input.phaseId);
    this.db
      .prepare(
        `
        UPDATE phases
        SET ${changedColumns.join(", ")}
        WHERE project_id = ? AND slug = ? AND phase_id = ?;
        `,
      )
      .run(...params);
    return true;
  }

  public syncPhaseTasks(input: {
    projectId: string;
    slug: string;
    phaseId: string;
    tasks: Array<{
      taskId: string;
      title: string;
      status: string;
      filesJson: string;
    }>;
  }): boolean {
    const tx = this.db.transaction(() => {
      const existingRows = this.db
        .prepare(
          `
          SELECT task_id, title, status, files_json
          FROM tasks
          WHERE project_id = ? AND slug = ? AND phase_id = ?;
          `,
        )
        .all(input.projectId, input.slug, input.phaseId) as Array<{
        task_id: string;
        title: string;
        status: string;
        files_json: string;
      }>;

      const existingByTaskId = new Map(existingRows.map((row) => [row.task_id, row]));
      const incomingTaskIds = new Set<string>();
      let changed = false;

      for (const task of input.tasks) {
        incomingTaskIds.add(task.taskId);
        const existing = existingByTaskId.get(task.taskId);
        if (!existing) {
          this.db
            .prepare(
              `
              INSERT INTO tasks (project_id, slug, phase_id, task_id, title, status, files_json)
              VALUES (?, ?, ?, ?, ?, ?, ?);
              `,
            )
            .run(
              input.projectId,
              input.slug,
              input.phaseId,
              task.taskId,
              task.title,
              task.status,
              task.filesJson,
            );
          changed = true;
          continue;
        }

        const changedColumns: string[] = [];
        const params: string[] = [];
        if (existing.title !== task.title) {
          changedColumns.push("title = ?");
          params.push(task.title);
        }
        if (existing.status !== task.status) {
          changedColumns.push("status = ?");
          params.push(task.status);
        }
        if (existing.files_json !== task.filesJson) {
          changedColumns.push("files_json = ?");
          params.push(task.filesJson);
        }

        if (changedColumns.length > 0) {
          params.push(input.projectId, input.slug, input.phaseId, task.taskId);
          this.db
            .prepare(
              `
              UPDATE tasks
              SET ${changedColumns.join(", ")}
              WHERE project_id = ? AND slug = ? AND phase_id = ? AND task_id = ?;
              `,
            )
            .run(...params);
          changed = true;
        }
      }

      for (const existingRow of existingRows) {
        if (incomingTaskIds.has(existingRow.task_id)) {
          continue;
        }
        this.db
          .prepare(
            `
            DELETE FROM tasks
            WHERE project_id = ? AND slug = ? AND phase_id = ? AND task_id = ?;
            `,
          )
          .run(input.projectId, input.slug, input.phaseId, existingRow.task_id);
        changed = true;
      }

      return changed;
    });

    return tx();
  }

  public syncSessionsCache(input: {
    projectId: string;
    slug: string;
    entries: Array<{ backend: string; sessionId: string; lastUsed: string }>;
  }): boolean {
    const tx = this.db.transaction(() => {
      const existingRows = this.db
        .prepare(
          `
          SELECT backend, mcp_session_id, last_used
          FROM sessions_cache
          WHERE project_id = ? AND slug = ?;
          `,
        )
        .all(input.projectId, input.slug) as Array<{
        backend: string;
        mcp_session_id: string;
        last_used: string;
      }>;
      const existingByBackend = new Map(existingRows.map((row) => [row.backend, row]));
      const incomingBackends = new Set<string>();
      let changed = false;

      for (const entry of input.entries) {
        incomingBackends.add(entry.backend);
        const existing = existingByBackend.get(entry.backend);
        if (!existing) {
          this.db
            .prepare(
              `
              INSERT INTO sessions_cache (project_id, slug, backend, mcp_session_id, last_used)
              VALUES (?, ?, ?, ?, ?);
              `,
            )
            .run(
              input.projectId,
              input.slug,
              entry.backend,
              entry.sessionId,
              entry.lastUsed,
            );
          changed = true;
          continue;
        }

        const changedColumns: string[] = [];
        const params: string[] = [];
        if (existing.mcp_session_id !== entry.sessionId) {
          changedColumns.push("mcp_session_id = ?");
          params.push(entry.sessionId);
        }
        if (existing.last_used !== entry.lastUsed) {
          changedColumns.push("last_used = ?");
          params.push(entry.lastUsed);
        }

        if (changedColumns.length > 0) {
          params.push(input.projectId, input.slug, entry.backend);
          this.db
            .prepare(
              `
              UPDATE sessions_cache
              SET ${changedColumns.join(", ")}
              WHERE project_id = ? AND slug = ? AND backend = ?;
              `,
            )
            .run(...params);
          changed = true;
        }
      }

      for (const existing of existingRows) {
        if (incomingBackends.has(existing.backend)) {
          continue;
        }
        this.db
          .prepare(
            `
            DELETE FROM sessions_cache
            WHERE project_id = ? AND slug = ? AND backend = ?;
            `,
          )
          .run(input.projectId, input.slug, existing.backend);
        changed = true;
      }
      return changed;
    });
    return tx();
  }

  private runMigrations(): void {
    const versionRow = this.db
      .prepare("PRAGMA user_version;")
      .get() as { user_version: number };

    if (versionRow.user_version >= CURRENT_SCHEMA_VERSION) {
      return;
    }

    const schemaPath = resolveSchemaPath();
    const schemaSql = readFileSync(schemaPath, "utf8");
    const applyMigration = this.db.transaction(() => {
      this.db.exec(schemaSql);
      this.db.pragma(`user_version = ${CURRENT_SCHEMA_VERSION}`);
    });
    applyMigration();
  }
}

function resolveSchemaPath(): string {
  const distPath = fileURLToPath(new URL("./schema.sql", import.meta.url));
  if (existsSync(distPath)) {
    return distPath;
  }
  return fileURLToPath(new URL("../src/schema.sql", import.meta.url));
}

export function normalizeRepoRoot(repoRoot: string): string {
  const forward = repoRoot.replaceAll("\\", "/").replace(/\/+$/, "");
  if (forward.length === 2 && /^[A-Za-z]:$/.test(forward)) {
    return `${forward}/`;
  }
  return forward;
}

export function projectIdFromRepoRoot(repoRoot: string): string {
  const normalized = normalizeRepoRoot(repoRoot);
  const digest = createHash("sha256").update(normalized).digest("hex");
  return `proj_${digest.slice(0, 16)}`;
}
