// Breaks app-not-infra-or-ui: src/app reaches src/infra directly instead of through a port.
import { createDatabase } from "../infra/db.js";

export const route = createDatabase();
