# phase-6.task-5

## Decisions made (not in spec)
- `start --detach` waits briefly for `daemon.port` before printing, so output includes concrete port when available.
- Detached daemon startup resolves daemon entrypoint from installed `@ccgmon/daemon/dist/index.js` using `createRequire`.

## Spec deviations
- none

## Tradeoffs accepted
- If daemon takes longer than the polling window to write `daemon.port`, detached start reports PID and may omit discovered port.

## Assumptions
- Detached daemon should inherit current environment (including `CCGMON_HOME`).

## Follow-ups for human
- none
