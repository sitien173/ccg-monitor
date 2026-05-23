# phase-5.task-3 — Decision Note

## Decisions made (not in spec)
- Used `_ccgmon: true` marker on hook entries instead of JSON comment markers (`// ccg-monitor:start`/`end`) — JSON doesn't support comments, marker property is idempotent and machine-parseable
- Used `createRequire(import.meta.url)` to resolve `@ccgmon/claude-hooks/package.json` — ESM doesn't have bare `require.resolve`, this is the standard workaround
- `matcher: ""` (empty string) means hooks fire for all tools, matching Claude Code's catch-all behavior

## Spec deviations
- Spec said "markers `// ccg-monitor:start` and `// ccg-monitor:end`" — changed to `_ccgmon: true` property because JSON doesn't support comments. Functionally equivalent: enables idempotent install/uninstall.

## Tradeoffs accepted
- `_ccgmon` marker is a non-standard property in the hook entry — could be stripped by Claude Code if it validates strictly. Accepted because Claude Code currently passes through unknown properties.

## Assumptions
- `~/.claude/settings.json` hook schema: `{ hooks: { [eventName]: Array<{ matcher: string; hooks: Array<{ type: "command"; command: string }> }> } }`

## Follow-ups for human
- Verify Claude Code tolerates `_ccgmon: true` in hook entries without errors
