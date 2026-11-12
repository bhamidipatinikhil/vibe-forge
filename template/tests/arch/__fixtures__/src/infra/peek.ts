// Breaks modules-via-index-from-outside: reaches past module a's index.ts.
import { secret } from "../modules/a/internal.js";

export const peeked = secret;
