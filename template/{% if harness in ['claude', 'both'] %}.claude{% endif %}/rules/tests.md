---
paths:
  - "src/**/*.test.ts"
  - "src/**/*.test.tsx"
  - "tests/**"
---
- Assert behaviour, not implementation: mock only process boundaries (HTTP via MSW in `tests/setup.msw.ts`, time via fake timers); never `vi.mock` an in-repo module. Pass small real implementations of the ports in `src/app/ports.ts` instead.
- The database is real: every test file gets its own migrated Postgres database (`process.env.DATABASE_URL`, from `tests/setup.db.ts`); create rows with Kysely, never mock a query.
- No `.only`/`.skip`; a new route gets an `app.request()` test next to `src/app/app.test.ts`, and the telemetry coverage test (`src/app/telemetry.test.ts`) must stay green.
