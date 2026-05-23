# Task 1 Note: Basic Shell and Routing Setup

## Decisions made (not in spec)
- Created a standard custom `useHashRoute` hook inside `router.js` which is highly responsive and triggers renders dynamically upon `hashchange` events in the browser.
- Included an index page Skip-Link to `#main-content` for improved accessibility (WCAG AA).

## Spec deviations
- none

## Tradeoffs accepted
- Simple hash-based router regex parsing was implemented manually without bringing in a large external router library. This maintains a zero-build ESM footprint and ensures extremely fast load times.

## Assumptions
- Assumed query parameters might be appended to the hash URL in future expansions, so the router automatically strips query parameters prior to matching route paths.

## Follow-ups for human
- none
