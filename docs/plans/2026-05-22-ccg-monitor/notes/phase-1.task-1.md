# phase-1.task-1

## Decisions made
- Set root package version to `0.1.0` and made the workspace private.
- Root scripts are recursive (`build`, `test`, `typecheck`) so package-level scripts remain source of truth.
- Added strict TypeScript defaults in `tsconfig.base.json` with NodeNext module settings per phase requirements.

## Spec deviations
- none

## Tradeoffs
- Chose minimal root setup without extra tooling or root test runner to keep Phase 1 scope narrow.

## Assumptions
- Node `>=20` is sufficient for this phase and aligned with `.nvmrc` value `20`.

## Follow-ups
- none
