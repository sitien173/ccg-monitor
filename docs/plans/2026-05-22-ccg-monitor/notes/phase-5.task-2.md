# phase-5.task-2 — Decision Note

## Decisions made (not in spec)
- `input_preview` truncated to 200 chars of `JSON.stringify(tool_input)` — provides structured preview without leaking full content
- Tool filter regex `/^(Edit|Write|Bash|Task|mcp__)/` — matches spec exactly; Read/Glob/Grep excluded intentionally (read-only, high volume)

## Spec deviations
- none

## Tradeoffs accepted
- JSON.stringify for preview means nested objects are flattened — simpler than cherry-picking fields per tool type

## Assumptions
- none

## Follow-ups for human
- none
