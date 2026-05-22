CREATE TABLE IF NOT EXISTS events (
  row_id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  event_version INTEGER NOT NULL,
  ts TEXT NOT NULL,
  source TEXT NOT NULL,
  machine_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  repo_root TEXT NOT NULL,
  session_id TEXT,
  plan_slug TEXT,
  payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  project_id TEXT PRIMARY KEY,
  repo_root TEXT NOT NULL UNIQUE,
  remote_url TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plans (
  project_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  current_phase TEXT,
  handover_status TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (project_id, slug),
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS phases (
  project_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  phase_id TEXT NOT NULL,
  title TEXT,
  owner TEXT,
  gate_state TEXT,
  started_at TEXT,
  completed_at TEXT,
  PRIMARY KEY (project_id, slug, phase_id),
  FOREIGN KEY (project_id, slug) REFERENCES plans(project_id, slug) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tasks (
  project_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  phase_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  files_json TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (project_id, slug, phase_id, task_id),
  FOREIGN KEY (project_id, slug, phase_id) REFERENCES phases(project_id, slug, phase_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS routes (
  route_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  session_id TEXT,
  backend TEXT NOT NULL,
  cd TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  error TEXT
);

CREATE TABLE IF NOT EXISTS reviews (
  project_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  phase_id TEXT NOT NULL,
  spec_status TEXT NOT NULL,
  quality_findings_json TEXT NOT NULL DEFAULT '[]',
  final_status TEXT NOT NULL,
  ts TEXT NOT NULL,
  PRIMARY KEY (project_id, slug, phase_id)
);

CREATE TABLE IF NOT EXISTS sessions_cache (
  project_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  backend TEXT NOT NULL,
  mcp_session_id TEXT NOT NULL,
  last_used TEXT NOT NULL,
  PRIMARY KEY (project_id, slug, backend)
);

CREATE INDEX IF NOT EXISTS idx_events_project_ts ON events(project_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_plans_status_updated ON plans(status, updated_at DESC);
