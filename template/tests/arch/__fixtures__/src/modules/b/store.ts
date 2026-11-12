// Allowed: a type-only import of the generated database types. Breaks module-not-infra: a runtime import from src/infra.
import { createDatabase } from "../../infra/db.js";
import type { DB } from "../../infra/db/schema.gen.js";

const row: DB = { id: createDatabase() };

export const stored = row.id;
