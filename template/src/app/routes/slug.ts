import { createRoute } from "@hono/zod-openapi";
import { slugify } from "../../domain/slug.js";
import { ErrorResponseSchema } from "../../schemas/error.js";
import { SlugQuerySchema, SlugResponseSchema } from "../../schemas/slug.js";
import type { App } from "../ports.js";

const slugRoute = createRoute({
	method: "get",
	path: "/api/v1/slug",
	tags: ["slug"],
	summary: "Turn free text into a URL slug",
	request: { query: SlugQuerySchema },
	responses: {
		200: {
			description: "The slug derived from `text`",
			content: { "application/json": { schema: SlugResponseSchema } },
		},
		400: {
			description: "`text` is missing, too long, or has no letters or digits",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
	},
});

/**
 * Registers `GET /api/v1/slug?text=...`.
 * @param app - The application to register the route on.
 */
export function registerSlugRoutes(app: App): void {
	app.openapi(slugRoute, (c) => {
		const { text } = c.req.valid("query");
		return slugify(text).match(
			(slug) => c.json({ slug }, 200),
			(error) =>
				c.json({ error: { code: error.kind, message: error.message } }, 400),
		);
	});
}
