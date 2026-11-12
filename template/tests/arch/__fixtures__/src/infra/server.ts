// Allowed: the composition root enters modules through their index.ts.
import { secret } from "../modules/a/index.js";
import { b } from "../modules/b/index.js";

export const wired = b + secret;
