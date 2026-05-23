# phase-6.task-1

## Decisions made (not in spec)
- Added `openmcp_tail` to shared source enum so tail events can be typed and validated.
- Bumped daemon schema user version from 1 to 2 so existing installations apply new table/index DDL.
- Used byte-offset newline scanning (`0x0A`) so bookmark offsets are stable and partial trailing lines are not emitted.

## Spec deviations
- none

## Tradeoffs accepted
- Route payloads include additional metadata fields (for example `log_offset`, parsed backend hints) beyond strict schema fields to support idempotence and troubleshooting.

## Assumptions
- openmcp log lines are UTF-8 text with newline-delimited records.

## Follow-ups for human
- none
