import { describe, expect, it } from "vitest";
import { openApiPath } from "./tracing.js";

// Span names and `http.route` must match the paths in openapi.json, which the telemetry coverage test
// (telemetry.test.ts) and dashboards compare them with; @hono/zod-openapi registers `{id}` as Hono's `:id`.
describe("openApiPath", () => {
	it("writes Hono path parameters in OpenAPI form", () => {
		expect(openApiPath("/api/v1/notes/:id")).toBe("/api/v1/notes/{id}");
		expect(openApiPath("/codes/:code{[0-9]+}/items/:item")).toBe(
			"/codes/{code}/items/{item}",
		);
	});

	it("leaves paths without parameters alone", () => {
		expect(openApiPath("/api/v1/slug")).toBe("/api/v1/slug");
		expect(openApiPath("/*")).toBe("/*");
	});
});
