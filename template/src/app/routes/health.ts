import { createRoute, z } from "@hono/zod-openapi";
import { logger } from "../../logger.js";
import type { App } from "../ports.js";

/** A named readiness check; `run` resolves `true` while the dependency is usable. */
export interface ReadinessCheck {
	/** Key under `checks` in the `/readyz` body. */
	readonly name: string;
	/** Probes the dependency; a rejection counts as a failure. */
	readonly run: () => Promise<boolean>;
}

type Outcome = "ok" | "fail";

const HealthResponseSchema = z
	.object({ status: z.literal("ok") })
	.openapi("HealthResponse");

const ReadyResponseSchema = z
	.object({
		status: z.enum(["ready", "not-ready"]),
		checks: z.record(z.string(), z.enum(["ok", "fail"])),
	})
	.openapi("ReadyResponse");

const healthRoute = createRoute({
	method: "get",
	path: "/healthz",
	tags: ["health"],
	summary: "Liveness probe",
	description: "Always 200 while the process is up.",
	responses: {
		200: {
			description: "The process is up",
			content: { "application/json": { schema: HealthResponseSchema } },
		},
	},
});

const readyRoute = createRoute({
	method: "get",
	path: "/readyz",
	tags: ["health"],
	summary: "Readiness probe",
	description: "200 when every readiness check passes, 503 otherwise.",
	responses: {
		200: {
			description: "Ready to serve traffic",
			content: { "application/json": { schema: ReadyResponseSchema } },
		},
		503: {
			description: "At least one readiness check failed",
			content: { "application/json": { schema: ReadyResponseSchema } },
		},
	},
});

async function runCheck(
	check: ReadinessCheck,
): Promise<readonly [string, Outcome]> {
	try {
		return [check.name, (await check.run()) ? "ok" : "fail"];
	} catch (e: unknown) {
		logger.warn({ err: e, check: check.name }, "readiness check threw");
		return [check.name, "fail"];
	}
}

/**
 * Registers `GET /healthz` (liveness) and `GET /readyz` (readiness).
 * @param app - The application to register the routes on.
 * @param checks - Dependencies probed by `/readyz`; all must pass for a 200.
 */
export function registerHealthRoutes(
	app: App,
	checks: readonly ReadinessCheck[],
): void {
	app.openapi(healthRoute, (c) => c.json({ status: "ok" as const }, 200));

	app.openapi(readyRoute, async (c) => {
		const entries = await Promise.all(checks.map(runCheck));
		const results = Object.fromEntries(entries);
		if (entries.every(([, outcome]) => outcome === "ok")) {
			return c.json({ status: "ready" as const, checks: results }, 200);
		}
		return c.json({ status: "not-ready" as const, checks: results }, 503);
	});
}
