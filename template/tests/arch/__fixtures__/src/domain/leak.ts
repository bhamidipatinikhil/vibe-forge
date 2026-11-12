// Breaks domain-independent: src/domain imports a module.
import { b } from "../modules/b/index.js";

export const leak = b;
