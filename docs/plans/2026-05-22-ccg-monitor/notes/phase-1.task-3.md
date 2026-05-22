# phase-1.task-3

## Decisions made
- Added a minimal `@ccgmon/cli` package with `ccgmon` bin output at `dist/bin.js`.
- Implemented argument handling with `node:util.parseArgs` and only `--help`/`--version` in this phase.
- Unknown positionals print help and set non-zero exit code.
- Version command reads workspace package metadata from disk at runtime instead of embedding version during build.

## Spec deviations
- none

## Tradeoffs
- Version lookup tries both `../../package.json` and `../../../package.json` from runtime location to keep behavior robust across transpiled path layouts.

## Assumptions
- Phase 1 CLI does not require command subcommands yet; positionals are treated as unknown commands.

## Follow-ups
- none
