import { z } from "@hono/zod-openapi";

/** Body of every error response (400, 404 and 500). */
export const ErrorResponseSchema = z
	.object({
		/** Machine-readable details of the failure. */
		error: z.object({
			/** Stable error code, e.g. `validation`, `empty`, `not_found`, `internal`. */
			code: z.string().openapi({ example: "validation" }),
			/** Human-readable explanation, safe to show to clients. */
			message: z.string().openapi({ example: "text: Invalid input" }),
			/** OpenTelemetry trace id, present when a span was active. */
			traceId: z.string().optional().openapi({
				description: "OpenTelemetry trace id, present when a span was active",
			}),
		}),
	})
	.openapi("ErrorResponse");

/** An error response body as returned to clients. */
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
