# Phase 1 dispatch — ccg-monitor scaffold

You are executing **Phase 1** of plan `2026-05-22-ccg-monitor`.

## Authoritative references (read first)

- Plan: `F:/projects/ccg-monitor/docs/plans/2026-05-22-ccg-monitor/PLAN.md` (§ Phase 1)
- Phase doc: `F:/projects/ccg-monitor/docs/plans/2026-05-22-ccg-monitor/PHASE-1.md`
- Design: `F:/projects/ccg-monitor/docs/plans/2026-05-22-ccg-monitor/design.md` (§ 2 — event envelope + all 14 event types)

Working directory: `F:/projects/ccg-monitor` (brand-new repo, no commits yet — your first commit can include `.gitignore` etc.).

## Scope (one phase, this dispatch only)

Implement the full Phase 1 file set listed in `PLAN.md`. Do **not** start Phase 2 work (daemon, SQLite, SSE, watcher). Do **not** add deps beyond what the phase requires.

Key files (create):
- root: `package.json` (pnpm workspaces), `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`, `.editorconfig`, `.nvmrc`, `README.md` (placeholder)
- `packages/shared/`: `package.json`, `src/events.ts`, `src/types.ts`, `src/constants.ts`, `test/events.test.ts`, plus `tsconfig.json` extending base
- `packages/cli/`: `package.json` (bin: `ccgmon`), `src/bin.ts`, `src/commands/version.ts`, plus `tsconfig.json`

## Requirements

1. **Monorepo skeleton**
   - pnpm workspace covering `packages/*`.
   - Root `package.json` private, scripts: `build` (`pnpm -r build`), `test` (`pnpm -r test`), `typecheck`.
   - Node ≥ 20 in `.nvmrc` and `engines`.
   - `tsconfig.base.json`: strict mode, `target: ES2022`, `module: NodeNext`, `moduleResolution: NodeNext`, `declaration: true`, `sourceMap: true`, `noUncheckedIndexedAccess: true`.
   - `.gitignore` covers `node_modules/`, `dist/`, `.DS_Store`, `*.log`, plus `docs/plans/*/.sessions.json` (worker session cache is local-only).

2. **`@ccgmon/shared`**
   - Only runtime dep: `zod`.
   - `src/events.ts`: zod schemas for the **envelope** + every event type listed in `design.md` § 2. Export them as a discriminated union by `event_type` (e.g. `EventSchema`).
   - `src/types.ts`: derive TS types via `z.infer<...>` — no hand-written duplicate types.
   - `src/constants.ts`: default port `7878`, port-fallback range `7878..7888`, retention days `90`, paths (`~/.ccgmon/`, `daemon.port`, `daemon.pid`, `config.toml`, `ccgmon.db`, `openmcp.log` default).
   - Envelope shape exactly per design.md §2: `event_id` (uuid v7 string), `event_version` (int), `ts` (ISO 8601 string), `source` (enum), `machine_id`, `project_id`, `repo_root`, `session_id` (nullable), `plan_slug` (nullable), `payload` (event-specific).
   - No `any` in public exports.
   - Build output: `dist/` via `tsc`.

3. **`@ccgmon/cli`**
   - Dep on `@ccgmon/shared` via `workspace:*`.
   - `bin` field `ccgmon` → `dist/bin.js` with proper shebang (`#!/usr/bin/env node`).
   - `src/bin.ts`: argv parsing via `node:util.parseArgs`. Only `--version` and `--help` wired this phase. Unknown commands print help and exit 1.
   - `--version` reads the **root** workspace `package.json` version (single source of truth). Implement by reading `../../package.json` relative to `dist/bin.js` at runtime, not by bundling.

4. **Tests (vitest)**
   - `packages/shared/test/events.test.ts`: one round-trip test per event type — construct an example payload that satisfies the schema, `parse` it back, assert deep-equal. Cover **every** event type from design.md §2. Also one negative test: malformed envelope rejected with a useful zod error path.
   - Configure vitest at the package level (no root-level monorepo runner needed).

5. **Strict mode hygiene**
   - No `any` leaks in public surface of `@ccgmon/shared`. Inputs to `parse()` may be `unknown`.
   - Run `tsc --noEmit` clean across the workspace.

## Acceptance (Done When)

- `pnpm install` clean (no peer-dep warnings on `@ccgmon/*`).
- `pnpm -r build` succeeds; `dist/` exists for both packages.
- `pnpm -r test` passes — count includes one round-trip per event type from design.md §2.
- `node packages/cli/dist/bin.js --version` prints the root package version.
- `node packages/cli/dist/bin.js --help` prints usage and exits 0.

## Process requirements

- **One commit per task**, prefix `phase-1.task-<M>: <summary>`. Tasks per PLAN.md:
  1. monorepo skeleton (root configs + workspace)
  2. `@ccgmon/shared` (schemas + types + constants)
  3. `@ccgmon/cli` shell (--version / --help)
  4. vitest setup + round-trip tests
- After each task, write `F:/projects/ccg-monitor/docs/plans/2026-05-22-ccg-monitor/notes/phase-1.task-<M>.md` using the decision-note template (Decisions made, Spec deviations, Tradeoffs, Assumptions, Follow-ups — `- none` where empty).
- After all four tasks + integration checks green, write the full `# EXTERNAL RESPONSE` block to `F:/projects/ccg-monitor/docs/plans/2026-05-22-ccg-monitor/responses/phase-1.md` AND return it inline.
- End your reply with the single line:
  `Phase 1 completed. Response file: docs/plans/2026-05-22-ccg-monitor/responses/phase-1.md.`

## Important constraints

- Do NOT introduce build tooling beyond `tsc` + `vitest`. No bundlers, no tsup, no esbuild this phase.
- Do NOT add CI files (`.github/workflows/...`) this phase.
- Do NOT scaffold daemon / ui / hooks packages — those are later phases.
- Do NOT initialize git history beyond the per-task commits (the repo already has `master` checked out with no commits).
- Use forward slashes in any path you mention in docs/notes for cross-platform readability.
