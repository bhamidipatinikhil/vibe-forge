import { createRoute, z } from "@hono/zod-openapi";
import { streamSSE } from "hono/streaming";
import { ErrorResponseSchema } from "../../schemas/error.js";
import type { App, FlagsPort } from "../ports.js";

/** Flag gating the stream; off answers 404 as if the route did not exist. */
export const EVENTS_FLAG = "events-stream";

/** Events per stream; the example stream is finite so clients and fuzzers terminate. */
const EVENT_COUNT = 3;

const eventsRoute = createRoute({
	method: "get",
	path: "/api/v1/events",
	tags: ["events"],
	summary:
		"Server-Sent Events example: three `tick` events, then the stream ends",
	description:
		"The pattern for live updates (hono/streaming `streamSSE`): one `event: tick` per message with an `id` and a JSON `data` line. Gated by the `events-stream` feature flag.",
	responses: {
		200: {
			description: "An event stream",
			content: {
				"text/event-stream": {
					schema: z.string().openapi({
						example: 'id: 1\nevent: tick\ndata: {"n":1}\n\n',
					}),
				},
			},
		},
		404: {
			description: "The `events-stream` flag is off",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
	},
});

/**
 * Registers `GET /api/v1/events`.
 * @param app - The application.
 * @param flags - Source of the `events-stream` flag.
 */
export function registerEventRoutes(app: App, flags: FlagsPort): void {
	app.openapi(eventsRoute, async (c) => {
		if (!(await flags.isEnabled(EVENTS_FLAG, true))) {
			return c.json(
				{ error: { code: "not_found", message: "Event stream is disabled" } },
				404,
			);
		}
		return streamSSE(c, async (stream) => {
			for (let n = 1; n <= EVENT_COUNT; n += 1) {
				await stream.writeSSE({
					id: String(n),
					event: "tick",
					data: JSON.stringify({ n }),
				});
			}
		});
	});
}
