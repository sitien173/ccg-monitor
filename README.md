# ccg-monitor

Local-first monitoring workspace for CCG planning, routing, and projection data.

## Quickstart

```bash
npm i -g @ccgmon/cli
ccgmon start --detach
ccgmon install-hooks
ccgmon open
```

## Commands

| Command | Purpose |
|---|---|
| `ccgmon doctor` | Run daemon, hooks, log-file, and event-recency checks. |
| `ccgmon scan <path>` | Backfill a repository's `docs/plans` history into projections. |
| `ccgmon prune --older-than 90d` | Remove old events while preserving latest active-plan events. |
| `ccgmon export <out.json>` | Export all projection tables as JSON from the daemon. |
| `ccgmon status` | Print daemon uptime, project count, and event count. |
| `ccgmon stop` | Stop detached daemon and remove pid/port files. |
