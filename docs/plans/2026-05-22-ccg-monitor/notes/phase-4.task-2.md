# Task 2 Note: Port Primitives, API & SSE Clients

## Decisions made (not in spec)
- Enhanced `WFProjectCard` to be a clickable link targeting `#/p/:projectId/plan/:slug` when an active plan exists. This makes navigation smooth and intuitive.
- Added sidebar filter clicks in `WFWorkspaceSidebar` to trigger filtering by status or owner.

## Spec deviations
- none

## Tradeoffs accepted
- Native Preact `style` object binding (`style=${{ ... }}`) was utilized inside ported primitives to preserve clean CSS styles. This ensures optimal rendering without requiring a custom CSS utility generator.

## Assumptions
- Assumed standard EventSource is fully supported by modern browsers targeted by ccg-monitor.

## Follow-ups for human
- none
