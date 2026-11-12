import { afterAll, describe, expect, it, vi } from "vitest";
import { createApp } from "./app.js";
import type { FlagsPort } from "./ports.js";
import { EVENTS_FLAG } from "./routes/events.js";
import { KILL_SWITCH_WRITES } from "./security.js";

vi.hoisted(() => {
	vi.stubEnv("LOG_LEVEL", "silent");
});

afterAll(() => {
	vi.unstubAllEnvs();
});

/** Flags with fixed values; anything else takes the caller's fallback. */
function flags(values: Readonly<Record<string, boolean>>): FlagsPort {
	return {
		isEnabled: (key, fallback) => Promise.resolve(values[key] ?? fallback),
	};
}

describe("security headers", () => {
	it("sends an enforcing CSP with a fresh nonce per request and the usual hardening headers", async () => {
		const app = createApp();
		const [first, second] = await Promise.all([
			app.request("/healthz"),
			app.request("/healthz"),
		]);
		const policy = first.headers.get("content-security-policy") ?? "";
		const nonce = /'nonce-([^']+)'/.exec(policy)?.[1];
		expect(nonce).toBeDefined();
		expect(second.headers.get("content-security-policy")).not.toContain(nonce);
		expect(policy).toContain("frame-ancestors 'none'");
		expect(policy).toContain("base-uri 'none'");
		expect(first.headers.get("x-content-type-options")).toBe("nosniff");
		expect(first.headers.get("strict-transport-security")).toContain(
			"max-age=",
		);
	});

	it("sends the CSP report-only when asked (the Vite dev server) and adds connect-src origins", async () => {
		const app = createApp({
			cspReportOnly: true,
			connectSrc: ["https://o1.ingest.sentry.io"],
		});
		const response = await app.request("/healthz");
		expect(response.headers.get("content-security-policy")).toBeNull();
		expect(
			response.headers.get("content-security-policy-report-only"),
		).toContain("connect-src 'self' https://o1.ingest.sentry.io");
	});
});

describe("/api/* guards", () => {
	it("refuses bodies over the limit with 413", async () => {
		const app = createApp({ bodyLimitBytes: 16 });
		const response = await app.request("/api/v1/slug", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ text: "x".repeat(64) }),
		});
		expect(response.status).toBe(413);
		expect(await response.json()).toMatchObject({
			error: { code: "payload_too_large" },
		});
	});

	it("refuses a cross-site form post with 403 and accepts one from the app's origin", async () => {
		const app = createApp({ appUrl: "https://app.example" });
		const post = (origin: string) =>
			app.request("/api/auth/sign-out", {
				method: "POST",
				headers: {
					origin,
					"content-type": "application/x-www-form-urlencoded",
				},
				body: "a=1",
			});
		expect((await post("https://evil.example")).status).toBe(403);
		// Passes the CSRF check and reaches the (unconfigured) auth backend.
		expect((await post("https://app.example")).status).toBe(503);
	});

	it("turns writes on /api/v1/* into 503 while the kill switch is on, and leaves reads alone", async () => {
		const app = createApp({ flags: flags({ [KILL_SWITCH_WRITES]: true }) });
		const write = await app.request("/api/v1/slug", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: "{}",
		});
		expect(write.status).toBe(503);
		expect(await write.json()).toMatchObject({
			error: { code: "maintenance" },
		});
		expect((await app.request("/api/v1/slug?text=ok")).status).toBe(200);
		// /api/auth/* is not behind the switch: the request reaches the (unconfigured) auth backend, not "maintenance".
		const auth = await app.request("/api/auth/sign-out", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: "{}",
		});
		expect(await auth.json()).toMatchObject({ code: "UNAVAILABLE" });
	});
});

describe("GET /api/v1/events", () => {
	it("streams three tick events and ends", async () => {
		const response = await createApp().request("/api/v1/events");
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/event-stream");
		const body = await response.text();
		expect(body.match(/^event: tick$/gm)).toHaveLength(3);
		expect(body).toContain('data: {"n":3}');
	});

	it("answers 404 while the events-stream flag is off", async () => {
		const app = createApp({ flags: flags({ [EVENTS_FLAG]: false }) });
		const response = await app.request("/api/v1/events");
		expect(response.status).toBe(404);
	});
});
