// Breaks server-not-ui: server code imports the web app.
import { uiLeak } from "../ui/leak.js";

export const rendered = uiLeak;
