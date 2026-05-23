# phase-6.task-2

## Decisions made (not in spec)
- Tailer startup is conditional on the log file already existing at daemon boot.
- Tailer shutdown path aborts first, then explicitly calls `stop()` to close any active watcher immediately.

## Spec deviations
- none

## Tradeoffs accepted
- Daemon currently does not auto-start tailing if the log file appears later after startup.

## Assumptions
- The openmcp log path resolution is stable during daemon lifetime.

## Follow-ups for human
- none
