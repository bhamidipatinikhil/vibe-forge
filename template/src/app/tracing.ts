import { SpanKind, SpanStatusCode, trace } from "@opentelemetry/api";
import type { MiddlewareHandler } from "hono";
import { routePath } from "hono/route";

/** Instrumentation scope the request spans are recorded under. */
const tracer = trace.getTracer("app.http");

/** A Hono path parameter, `:id` or `:id{[0-9]+}`. */
const HONO_PARAM = /:([^/{}?]+)(?:\{[^}]*\})?/g;

/**
 * Hono's route syntax in the OpenAPI form that `openapi.json`, the access matrix and dashboards use:
 * `/api/v1/notes/:id` becomes `/api/v1/notes/{id}` (@hono/zod-openapi registers `{id}` routes as `:id`).
 * @param route - A route path as Hono reports it.
 * @returns The same path with every parameter written `{name}`.
 */
export function openApiPath(route: string): string {
	return route.replaceAll(HONO_PARAM, "{$1}");
}

/**
 * The route wrapper: every request runs inside one `SERVER` span named
 * `METHOD /route` that carries the stable HTTP semantic-convention attributes
 * (`http.request.method`, `url.path`, `http.route`, `http.response.status_code`).
 * An error thrown by a handler is recorded on the span as an `exception`
 * event; a 5xx response (which is what an unhandled error becomes, see
 * `createApp`) sets the span status to ERROR. A 4xx leaves the status unset
 * even when it was thrown as an `HTTPException`: for a server span the HTTP
 * semantic conventions reserve ERROR for 5xx. The span exists whether the
 * request arrives over HTTP or through `app.request()`, which is what the
 * telemetry coverage test (`telemetry.test.ts`) relies on; without a
 * registered tracer provider (no collector configured, see
 * `src/instrumentation.ts`) it is a no-op.
 * @returns The middleware; `createApp` registers it before every route.
 */
export function tracing(): MiddlewareHandler {
	return (c, next) =>
		tracer.startActiveSpan(
			c.req.method,
			{
				kind: SpanKind.SERVER,
				attributes: {
					"http.request.method": c.req.method,
					"url.path": c.req.path,
				},
			},
			async (span) => {
				try {
					await next();
				} finally {
					// The route of the handler that answered (routeIndex stops there; "/*" when only middleware ran, i.e. a
					// 404). Not the last *matched* route: catch-alls registered later (the /api/* 404 of the web kind) match too.
					const route = openApiPath(routePath(c));
					span.updateName(`${c.req.method} ${route}`);
					span.setAttributes({
						"http.route": route,
						"http.response.status_code": c.res.status,
					});
					if (c.error !== undefined) {
						span.recordException(c.error);
					}
					if (c.res.status >= 500) {
						span.setStatus({ code: SpanStatusCode.ERROR });
					}
					span.end();
				}
			},
		);
}
