import { afterEach, expect, test, vi } from "vitest";
import { fetchMe, postAuth } from "./api";
import { reportVital, startMonitoring } from "./monitoring";
import { cn } from "./utils";

// The browser's HTTP boundary is fetch/sendBeacon; spying on them is mocking the process boundary (AGENTS.md).
afterEach(() => {
	vi.restoreAllMocks();
});

test("cn merges class names and resolves Tailwind conflicts", () => {
	expect(cn("px-2", false, "px-4", "font-semibold")).toBe("px-4 font-semibold");
});

test("fetchMe returns the user, null when anonymous, and throws on other failures", async () => {
	const fetchSpy = vi.spyOn(globalThis, "fetch");
	fetchSpy.mockResolvedValueOnce(
		Response.json({ userId: "u1", email: "a@example.com", name: "Ada" }),
	);
	expect(await fetchMe()).toEqual({
		userId: "u1",
		email: "a@example.com",
		name: "Ada",
	});
	fetchSpy.mockResolvedValueOnce(new Response(null, { status: 401 }));
	expect(await fetchMe()).toBeNull();
	fetchSpy.mockResolvedValueOnce(new Response(null, { status: 500 }));
	await expect(fetchMe()).rejects.toThrow("HTTP 500");
});

test("postAuth resolves on success and throws better-auth's message otherwise", async () => {
	const fetchSpy = vi.spyOn(globalThis, "fetch");
	fetchSpy.mockResolvedValueOnce(Response.json({ ok: true }));
	await expect(postAuth("/sign-out", {})).resolves.toBeUndefined();
	fetchSpy.mockResolvedValueOnce(
		Response.json({ message: "Invalid email or password" }, { status: 401 }),
	);
	await expect(postAuth("/sign-in/email", {})).rejects.toThrow(
		"Invalid email or password",
	);
	fetchSpy.mockResolvedValueOnce(new Response("oops", { status: 502 }));
	await expect(postAuth("/sign-in/email", {})).rejects.toThrow("HTTP 502");
});

test("reportVital beacons the measurement, falling back to fetch when the beacon is refused", () => {
	const beacon = vi
		.spyOn(navigator, "sendBeacon")
		.mockReturnValueOnce(true)
		.mockReturnValueOnce(false);
	const fetchSpy = vi
		.spyOn(globalThis, "fetch")
		.mockResolvedValue(new Response(null, { status: 204 }));
	reportVital({ name: "LCP", value: 1200, rating: "good" });
	reportVital({ name: "CLS", value: 0.01, rating: "good" });
	expect(beacon).toHaveBeenCalledTimes(2);
	expect(fetchSpy).toHaveBeenCalledTimes(1);
	expect(fetchSpy).toHaveBeenCalledWith(
		"/api/v1/vitals",
		expect.objectContaining({ method: "POST", keepalive: true }),
	);
});

test("startMonitoring registers the web-vitals listeners without a Sentry DSN", () => {
	vi.spyOn(navigator, "sendBeacon").mockReturnValue(true);
	expect(() => {
		startMonitoring();
	}).not.toThrow();
});
