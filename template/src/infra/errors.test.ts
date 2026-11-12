import { describe, expect, it } from "vitest";
import { sentryReporter } from "./errors.js";

describe("sentryReporter", () => {
	it("is safe to call without SENTRY_DSN (the SDK is not initialized, so nothing is sent)", () => {
		expect(() => {
			sentryReporter.capture(new Error("boom"), { path: "/x", traceId: "abc" });
			sentryReporter.capture(new Error("boom"), { path: "/y" });
		}).not.toThrow();
	});
});
