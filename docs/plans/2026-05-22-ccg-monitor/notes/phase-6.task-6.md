# phase-6.task-6

## Decisions made (not in spec)
- Added three dedicated log fixtures under `openmcp-log/` and covered parser behavior through real tailer execution against SQLite.
- Updated README with a concise quickstart and command reference centered on CLI workflows.

## Spec deviations
- none

## Tradeoffs accepted
- Fixture files use `.log` extension and are force-added because workspace `.gitignore` ignores `*.log` globally.

## Assumptions
- Tailer tests should validate end-to-end behavior via inserted event rows, not private method calls.

## Follow-ups for human
- none
