# Task 3 Note: Build Views & State Overlays

## Decisions made (not in spec)
- Created dynamic sparklines based on real-time event distribution by mapping historical event timestamps to their minute buckets modulo 30.
- Implemented category counts dynamically inside the Activity log header, ensuring users get exact metrics for `route.*`, `tool.*`, etc.
- Added a full-featured toast system inside Plan Detail to confirm success when "Resume Handover" copies a command to the clipboard.

## Spec deviations
- none

## Tradeoffs accepted
- Instead of keeping completely static templates, we mapped dynamically computed event details inside the log views. This provides a vastly superior user experience at zero extra code cost.

## Assumptions
- Assumed standard clipboard API `navigator.clipboard.writeText` is available on the browser executing the ccg-monitor frontend dashboard.

## Follow-ups for human
- none
