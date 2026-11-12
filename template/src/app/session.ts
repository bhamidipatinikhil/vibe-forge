// src/app/session.ts — the one way a route requires a signed-in caller.
import type { MiddlewareHandler } from "hono";
import type { AuthPort, Session } from "./ports.js";

/** Request variables set by {@link requireSession}: the handler reads `c.var.session`. */
export interface SessionEnv {
	/** Request-scoped values. */
	Variables: {
		/** The signed-in caller. */
		session: Session;
	};
}

/**
 * Route middleware for signed-in callers only. It runs before the request is
 * validated, so an anonymous caller always gets 401 (never a 400 that would
 * reveal the body shape; the access matrix relies on it), and it hands the
 * session to the handler as `c.var.session`, typed. Use it in the route
 * definition: `createRoute({ ..., middleware: [requireSession(auth)] as const })`,
 * and document the 401 response.
 * @param auth - The session lookup (`AuthPort`).
 * @returns The middleware.
 */
export function requireSession(auth: AuthPort): MiddlewareHandler<SessionEnv> {
	return async (c, next) => {
		const session = await auth.getSession(c.req.raw.headers);
		if (session === null) {
			return c.json(
				{ error: { code: "unauthenticated", message: "Sign in first" } },
				401,
			);
		}
		c.set("session", session);
		await next();
		return undefined;
	};
}
