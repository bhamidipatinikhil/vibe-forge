---
paths:
  - "migrations/**"
---
- dbmate format: `-- migrate:up` then `-- migrate:down` (left empty: rollbacks are forward fixes). Create files with `just db-new <name>`, then run `just db-generate` so `db/schema.sql` and `src/infra/db/schema.gen.ts` follow (`just check` fails until they do).
- Expand-only SQL: add tables, nullable columns, defaults and `CREATE INDEX CONCURRENTLY` (with `-- migrate:up transaction:false`); never drop, rename or narrow a column, table or type in the same release. Squawk lints every changed file (`just lint`, lefthook, `.github/workflows/migrations.yml`).
- Contract steps (drops, renames, `NOT NULL` tightening) ship in a later release once no deployed code reads the old shape; rollback order is flag, app, data (`docs/runbooks/rollback.md`), and `Edit(migrations/**)` asks for confirmation.
