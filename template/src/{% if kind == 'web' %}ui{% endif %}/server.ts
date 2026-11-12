// src/ui/server.ts — TanStack Start's server entry. Locale negotiation (cookie, Accept-Language, base locale) runs
// before rendering; nothing else lives here: every endpoint is a Hono route (rules/no-start-server-endpoints.yml).
import handler from "@tanstack/react-start/server-entry";
import { paraglideMiddleware } from "./paraglide/server.js";

export default {
	fetch(request: Request): Promise<Response> {
		return paraglideMiddleware(request, () => handler.fetch(request));
	},
};
