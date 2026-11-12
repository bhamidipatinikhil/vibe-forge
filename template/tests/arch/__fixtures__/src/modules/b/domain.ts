// Allowed: src/domain. Breaks module-domain-pure: the module's own store (IO).
import { shared } from "../../domain/shared.js";
import { stored } from "./store.js";

export const pure = shared + stored;
