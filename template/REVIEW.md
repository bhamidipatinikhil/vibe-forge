# Review instructions

## What Important means here

Reserve Important for findings that would break behavior, leak data,
or block a rollback: incorrect logic, unscoped database queries, PII
in logs or error messages, and migrations that aren't backward
compatible. Style, naming, and refactoring suggestions are Nit at
most.

## Cap the nits

Report at most five Nits per review.

## Do not report

- Anything CI already enforces: lint, formatting, type errors
- Generated files (`dist/`, `build/`, `*.generated.*`, the committed `openapi.json`) and any lock file (`pnpm-lock.yaml`, `flake.lock`)
- Test-only code that intentionally violates production rules

## Always check

- New API routes have an integration test
- Log lines don't include email addresses, user IDs, or request bodies
- Every data access is scoped by the authenticated principal (see `.claude/rules/api.md`)

## Evidence

- Behavior claims need a `file:line` citation in the source, not an inference from naming
