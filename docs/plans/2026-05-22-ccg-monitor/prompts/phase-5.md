You own one implementation phase with 4 tasks for ccg-monitor Phase 5 — Claude Code hook scripts.

## Original User Request
Local-first monitoring dashboard for `superpowers-ccg` + `openmcp`. Hook scripts POST events to the daemon from inside Claude Code sessions. `ccgmon install-hooks` wires them into `~/.claude/settings.json`.

## Phase
Implement 4 Claude Code hook scripts (session-start, tool-pre, tool-post, session-stop) that POST events to the daemon. Implement `ccgmon install-hooks` to idempotently merge hook config into `~/.claude/settings.json`. All hooks fail-silent with 50ms AbortController budget.

## Tasks
- task-1: Create the `@ccgmon/claude-hooks` package at `F:/projects/ccg-monitor/packages/integrations/claude-hooks/`. Set up `package.json` with deps on `@ccgmon/shared`. Implement the shared POST helper at `F:/projects/ccg-monitor/packages/integrations/claude-hooks/src/lib/post.ts`: fail-silent fetch with 50ms AbortController budget. Resolves daemon URL from `CCGMON_URL` env → else reads `~/.ccgmon/daemon.port` file → else default `http://127.0.0.1:7878`. If `CCGMON_URL=off`, exit 0 immediately with no network call. Implement 4 hook scripts: `session-start.ts`, `tool-pre.ts`, `tool-post.ts`, `session-stop.ts`. Each reads stdin (JSON hook context from Claude Code), constructs the correct event payload per the zod schemas below, and POSTs to `<daemon_url>/events`. Tool filter on `tool-pre`/`tool-post`: only fire for tools matching `Edit|Write|Bash|Task|mcp__`. Other tools → exit 0 silently. Never include full prompt body in any payload.
- task-2: Implement payload construction for each hook. `session-start.ts` emits `session.started` with `{ cwd, transcript_path }` from stdin context. `tool-pre.ts` emits `tool.pre` with `{ tool_name, input_preview }` where `input_preview` is first 200 chars of the tool input (truncated). `tool-post.ts` emits `tool.post` with `{ tool_name, duration_ms, error? }`. `session-stop.ts` emits `session.stopped` with `{ reason, duration_ms }`. Each hook must generate a valid event envelope: `event_id` (UUIDv7-like via `crypto.randomUUID`), `event_version: 1`, `ts` (ISO), `source: "claude_hook"`, `machine_id` (hostname), `project_id` (sha1 of normalized cwd), `repo_root` (cwd), `session_id` (from stdin context if available, else null), `plan_slug: null`.
- task-3: Implement `ccgmon install-hooks` at `F:/projects/ccg-monitor/packages/cli/src/commands/install-hooks.ts`. It idempotently merges a hook configuration block into `~/.claude/settings.json`. The block should be placed between JSON comment markers `// ccg-monitor:start` and `// ccg-monitor:end` (NOTE: since JSON doesn't support comments, use a different strategy — add a `"_ccgmon_marker": true` key to each hook entry for identification, or use a dedicated `ccgmon` key in the settings). Resolve hook script absolute paths from the installed `@ccgmon/claude-hooks/dist/` directory via `require.resolve` or import.meta resolution. Support `--uninstall` flag to cleanly remove the hooks. Implement the settings merge logic at `F:/projects/ccg-monitor/packages/cli/src/lib/settings-merge.ts`. Wire the `install-hooks` command into `F:/projects/ccg-monitor/packages/cli/src/bin.ts`. The merge must: preserve existing user hooks, be idempotent (running twice produces identical output), abort with clear error if `~/.claude/settings.json` is malformed JSON.
- task-4: Write tests. Hook tests at `F:/projects/ccg-monitor/packages/integrations/claude-hooks/test/hooks.test.ts`: test that each hook script constructs the correct event payload from mock stdin; test that daemon-offline scenario exits 0 within timeout; test that `CCGMON_URL=off` short-circuits; test that no payload contains full prompt body (regex assertion). Install-hooks tests at `F:/projects/ccg-monitor/packages/cli/test/install-hooks.test.ts`: test idempotency (install twice → identical output); test `--uninstall` restores original; test malformed JSON aborts cleanly.

## Context

### Event schemas (from `@ccgmon/shared`)
The shared package at `F:/projects/ccg-monitor/packages/shared/src/events.ts` defines these hook-relevant event schemas:

```typescript
// session.started payload: { cwd: string, transcript_path: string }
// tool.pre payload: { tool_name: string, input_preview: string }
// tool.post payload: { tool_name: string, duration_ms: number, error?: string }
// session.stopped payload: { reason: string, duration_ms: number }

// Envelope: event_id (UUIDv7), event_version: 1, ts (ISO), source: "claude_hook",
//           machine_id, project_id, repo_root, session_id (nullable), plan_slug (nullable)
```

Source enum includes `"claude_hook"` — hooks must use this value.

### Constants (from `@ccgmon/shared`)
```typescript
export const DEFAULT_DAEMON_PORT = 7878;
export const CCGMON_HOME_DIR = "~/.ccgmon/";
export const DAEMON_PORT_FILENAME = "daemon.port";
```

### CLI structure
The CLI is at `F:/projects/ccg-monitor/packages/cli/`. Entry point: `F:/projects/ccg-monitor/packages/cli/src/bin.ts`. Commands are in `F:/projects/ccg-monitor/packages/cli/src/commands/`. Current commands: `start`, `version`. You need to add `install-hooks` and wire it into `bin.ts`.

The CLI `bin.ts` dispatches commands like:
```typescript
if (args[0] === "start") {
  await runStartCommand(args.slice(1));
  return;
}
// Add: if (args[0] === "install-hooks") { ... }
```

### Monorepo workspace
Root workspace: `F:/projects/ccg-monitor/pnpm-workspace.yaml`. You need to add the new package path `packages/integrations/claude-hooks` to the workspace. The package should be named `@ccgmon/claude-hooks`.

### Claude Code hook stdin format
Claude Code hooks receive JSON on stdin. The format varies by hook type:
- SessionStart: `{ "session_id": "...", "cwd": "...", "transcript_path": "..." }`
- PreToolUse: `{ "session_id": "...", "tool_name": "...", "tool_input": { ... } }`
- PostToolUse: `{ "session_id": "...", "tool_name": "...", "tool_input": { ... }, "tool_output": "...", "duration_ms": 123, "error": "..." }`
- Stop: `{ "session_id": "...", "cwd": "...", "duration_ms": 123, "reason": "user_exit" }`

### project_id generation
Use `createHash("sha1").update(normalizedPath).digest("hex")` where normalizedPath has backslashes replaced with forward slashes. This matches the daemon's `projectIdFromRepoRoot` function.

### Claude Code settings.json hook format
Hooks in `~/.claude/settings.json` look like:
```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node /absolute/path/to/session-start.js"
          }
        ]
      }
    ],
    "PreToolUse": [...],
    "PostToolUse": [...],
    "Stop": [...]
  }
}
```

## Files

Create:
- `F:/projects/ccg-monitor/packages/integrations/claude-hooks/package.json`
- `F:/projects/ccg-monitor/packages/integrations/claude-hooks/tsconfig.json`
- `F:/projects/ccg-monitor/packages/integrations/claude-hooks/src/lib/post.ts`
- `F:/projects/ccg-monitor/packages/integrations/claude-hooks/src/session-start.ts`
- `F:/projects/ccg-monitor/packages/integrations/claude-hooks/src/tool-pre.ts`
- `F:/projects/ccg-monitor/packages/integrations/claude-hooks/src/tool-post.ts`
- `F:/projects/ccg-monitor/packages/integrations/claude-hooks/src/session-stop.ts`
- `F:/projects/ccg-monitor/packages/integrations/claude-hooks/test/hooks.test.ts`
- `F:/projects/ccg-monitor/packages/cli/src/commands/install-hooks.ts`
- `F:/projects/ccg-monitor/packages/cli/src/lib/settings-merge.ts`
- `F:/projects/ccg-monitor/packages/cli/test/install-hooks.test.ts`

Modify:
- `F:/projects/ccg-monitor/packages/cli/src/bin.ts` (add install-hooks command)
- `F:/projects/ccg-monitor/pnpm-workspace.yaml` (add integrations path)

## Done When
- `pnpm install` resolves clean
- `pnpm -r build` passes (all packages including new claude-hooks)
- `pnpm --filter @ccgmon/claude-hooks test` passes
- `pnpm --filter @ccgmon/cli test` passes
- `ccgmon install-hooks` is idempotent — running twice produces identical `settings.json`
- `ccgmon install-hooks --uninstall` removes hooks cleanly
- Daemon offline → each hook exits 0 within 50ms
- `CCGMON_URL=off` short-circuits before any network call
- No event payload contains full prompt body or full file contents
- Tool filter: only Edit/Write/Bash/Task/mcp__* tools trigger events

## Rules
- Edit files directly with your write tools; on-disk files are the source of truth.
- Do not duplicate file content in the response.
- Do not redesign the phase or produce a reference prototype.
- If anything is unclear, list it under CLARIFICATIONS NEEDED and stop.
- Hooks must NEVER throw on bad stdin — return exit 0 with stderr warning.
- AbortController must actually fire at 50ms (not 100ms, not unbounded).
- `settings-merge.ts` must preserve user's existing hooks order and unrelated keys.
- Install-hooks must fail clearly if `~/.claude/settings.json` is malformed JSON (don't overwrite — abort).
- No dependency on the daemon being up at install time.
- Run `pnpm install` after modifying workspace config or adding new packages.

## Per-Task Workflow (required)
For each task in order:
  1. Implement the task.
  2. `git add` only files you touched for this task and commit with message
     `phase-5.task-<M>: <one-line subject>`. Capture the commit hash.
  3. Write `F:/projects/ccg-monitor/docs/plans/2026-05-22-ccg-monitor/notes/phase-5.task-<M>.md` (decision note)
     with sections: Decisions made (not in spec), Spec deviations, Tradeoffs
     accepted, Assumptions, Follow-ups for human. Use `- none` for empty sections.
  4. Append this task's row to `## COMMITS` in your response.

## After All Tasks
- Write `F:/projects/ccg-monitor/docs/plans/2026-05-22-ccg-monitor/responses/phase-5.md` containing the full
  `# EXTERNAL RESPONSE` block (same content you return inline).
- Emit the completion line as the final line of your reply:
  `Phase 5 completed. Response file: F:/projects/ccg-monitor/docs/plans/2026-05-22-ccg-monitor/responses/phase-5.md.`

## Report Format
Return the `# EXTERNAL RESPONSE` block with sections: META, SUMMARY, FILES MODIFIED, COMMITS, NOTES, SPEC COMPLIANCE, CLARIFICATIONS NEEDED, NEXT.
