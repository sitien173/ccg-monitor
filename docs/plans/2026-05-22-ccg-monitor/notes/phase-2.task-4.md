# phase-2.task-4

## Decisions made
- Implemented D1 bind strategy in daemon startup:
  - no `--port` => sequential probe `7878..7888`, first free wins
  - `--port <N>` => pinned single-port bind, no fallback
- Added explicit retry handling for `EADDRINUSE` and `EACCES` across fallback ports, with a fatal hint when the full range is exhausted.
- Wrote selected bind port to `~/.ccgmon/daemon.port` immediately after bind and removed it on clean shutdown.
- Added `SIGINT`/`SIGTERM` handlers in daemon runtime for clean exit: close server, checkpoint/close DB, remove port file.
- Added `ccgmon start` command in CLI with `--port` support and foreground daemon wiring.

## Spec deviations
- none

## Tradeoffs
- Kept daemon and CLI startup in-process (`@ccgmon/cli` imports `@ccgmon/daemon`) to avoid an additional launcher/shim process in Phase 2.

## Assumptions
- `CCGMON_HOME` is the intended override mechanism for tests and local multi-instance runs.

## Follow-ups
- Add full integration coverage (100-event concurrency + SSE + leak + WAL assertions) in task 5.
