import { z } from "@hono/zod-openapi";
import { SLUG_PATTERN } from "../domain/slug.js";

/** Query parameters of `GET /api/v1/slug`. */
export const SlugQuerySchema = z.object({
	/** Free text to slugify; 1 to 200 characters. */
	text: z
		.string()
		.min(1)
		.max(200)
		.openapi({
			param: { name: "text", in: "query" },
			example: "Hello, World!",
		}),
});

/** Successful body of `GET /api/v1/slug`. */
export const SlugResponseSchema = z
	.object({
		/** The slug; lowercase ASCII letters, digits and single hyphens. */
		slug: z.string().regex(SLUG_PATTERN).openapi({ example: "hello-world" }),
	})
	.openapi("SlugResponse");
