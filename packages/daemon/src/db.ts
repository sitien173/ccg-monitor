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

type PlanRow = {
  project_id: string;
  slug: string;
  title: string | null;
  status: string;
  current_phase: string | null;
  handover_status: string | null;
  updated_at: string;
};

type PhaseRow = {
  project_id: string;
  slug: string;
  phase_id: string;
  title: string | null;
  owner: string | null;
  gate_state: string | null;
  started_at: string | null;
  completed_at: string | null;
};

type TaskRow = {
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
