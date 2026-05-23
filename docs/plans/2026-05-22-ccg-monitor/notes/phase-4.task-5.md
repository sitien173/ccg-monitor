# Task 5 Note: Static Serving & API Additions

## Decisions made (not in spec)
- Resolved the absolute path to `packages/ui` using `resolve(fileURLToPath(import.meta.url), "../../../ui")`. This ensures absolute robust routing under both ts-node/tsx (source) and compiled node (dist/dist/index.js) execution modes.
- Utilized `rewriteRequestPath` on `serveStatic` to seamlessly route requests to root `/` to `/index.html`.

## Spec deviations
- none

## Tradeoffs accepted
- We mounted the static-serve handler directly inside `createApp` ahead of the fallback 404 handler, but after all registered API routes. This ensures standard Hono router performance and prevents overlap.

## Assumptions
- Assumed standard `@hono/node-server/serve-static` package handles and streams file objects reliably on all targeted OS environments.

## Follow-ups for human
- none
