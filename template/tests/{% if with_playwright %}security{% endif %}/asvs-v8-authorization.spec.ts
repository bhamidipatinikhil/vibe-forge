// tests/security/asvs-v8-authorization.spec.ts — OWASP ASVS 5.0 chapter V8
// (Authorization) as executable checks against the running app. Convention:
// one spec per ASVS chapter, so the checklist is the file list.
//
// Covered: (a) every operation documented in openapi.json is declared in the
// access matrix; (b) anonymous callers get exactly the declared status on
// every route; (c) every "authenticated" route rejects anonymous callers with
// 401/403. When per-user resources and roles exist, add the IDOR and
// role-matrix cases here: request another principal's resource id with each
// role's storageState and expect 403/404 (V8.2); test denied access as
// carefully as granted access, and never prove authorization through the UI.
import { expect, test } from "@playwright/test";
import { z } from "zod";
import {
	ACCESS_MATRIX,
	HTTP_METHODS,
	type HttpMethod,
	type RouteAccess,
} from "./access-matrix.js";

const OpenApiDocument = z.object({
	paths: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
});

const isHttpMethod = (value: string): value is HttpMethod =>
	(HTTP_METHODS as readonly string[]).includes(value);

const isRejection = (status: number): boolean =>
	status === 401 || status === 403;

const operation = (method: string, path: string): string =>
	`${method.toUpperCase()} ${path}`;

const target = (route: RouteAccess): string => route.request ?? route.path;

// Writes come from the app's own origin with an empty JSON object, as a browser sends them: a bodiless or
// cross-origin POST would be refused by the CSRF and origin checks (403) and hide what the route itself answers.
const call = (route: RouteAccess) => {
	if (route.method === "GET" || route.method === "HEAD") {
		return { method: route.method };
	}
	const origin = new URL(
		test.info().project.use.baseURL ?? "http://127.0.0.1:3000",
	).origin;
	return { method: route.method, data: {}, headers: { origin } };
};

test("V8: every operation in openapi.json is declared in the access matrix", async ({
	request,
}) => {
	const response = await request.get("/openapi.json");
	expect(response.status()).toBe(200);
	const body: unknown = await response.json();
	const document = OpenApiDocument.parse(body);

	const documented = Object.entries(document.paths ?? {}).flatMap(
		([path, item]) =>
			Object.keys(item)
				.map((key) => key.toUpperCase())
				.filter(isHttpMethod)
				.map((method) => operation(method, path)),
	);
	expect(documented.length).toBeGreaterThan(0);

	const declared = new Set(
		ACCESS_MATRIX.map((route) => operation(route.method, route.path)),
	);
	const missing = documented.filter((entry) => !declared.has(entry));
	expect(missing).toEqual([]);
});

for (const route of ACCESS_MATRIX) {
	test(`V8: anonymous ${route.method} ${target(route)} answers ${String(route.expectedAnonymousStatus)}`, async ({
		request,
	}) => {
		const response = await request.fetch(target(route), call(route));
		expect(response.status()).toBe(route.expectedAnonymousStatus);
	});
}

test("V8: every authenticated route rejects anonymous callers with 401/403", async ({
	request,
}) => {
	// Declared consistency: a route is "authenticated" exactly when the matrix
	// expects anonymous callers to be rejected, and never otherwise.
	const inconsistent = ACCESS_MATRIX.filter(
		(route) =>
			isRejection(route.expectedAnonymousStatus) !==
			(route.auth === "authenticated"),
	).map(
		(route) =>
			`${operation(route.method, route.path)} is ${route.auth} but expects ${String(route.expectedAnonymousStatus)}`,
	);
	expect(inconsistent).toEqual([]);

	// Live check. The matrix declares no authenticated routes yet, so this list
	// is empty today; it starts failing the moment a route is declared
	// authenticated without middleware that actually rejects anonymous callers.
	const protectedRoutes = ACCESS_MATRIX.filter(
		(route) => route.auth === "authenticated",
	);
	const results = await Promise.all(
		protectedRoutes.map(async (route) => {
			const response = await request.fetch(target(route), call(route));
			return { route, status: response.status() };
		}),
	);
	const accepted = results
		.filter(({ status }) => !isRejection(status))
		.map(
			({ route, status }) =>
				`${operation(route.method, route.path)} answered ${String(status)}`,
		);
	expect(accepted).toEqual([]);
});
