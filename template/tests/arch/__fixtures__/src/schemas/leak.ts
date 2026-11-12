// Breaks schemas-only-domain: src/schemas imports a module.
import { b } from "../modules/b/index.js";

export const schemaLeak = b;
