// Allowed: its own domain and module a's index.ts. Breaks no-cross-module-internals: module a's internal file.
import { secret as viaIndex } from "../a/index.js";
import { secret } from "../a/internal.js";
import { pure } from "./domain.js";

export const b = pure + secret + viaIndex;
