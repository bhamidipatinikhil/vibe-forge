// Breaks ui-not-server (kind=web): browser code imports a server module.
import { b } from "../modules/b/index.js";

export const uiLeak = b;
