// tests/smoke/readyz.spec.ts — post-deploy smoke test. deploy.yml runs it with
// BASE_URL set to the fresh deployment (playwright.config.ts then skips the
// local webServer); locally it runs against the app on 127.0.0.1:3000.
import { expect, test } from "@playwright/test";

test("GET /healthz answers 200 with status ok (liveness)", async ({
	request,
}) => {
	const response = await request.get("/healthz");
	expect(response.status()).toBe(200);
	const body: unknown = await response.json();
	expect(body).toMatchObject({ status: "ok" });
});

test("GET /readyz answers 200 with status ready (readiness)", async ({
	request,
}) => {
	const response = await request.get("/readyz");
	expect(response.status()).toBe(200);
	const body: unknown = await response.json();
	expect(body).toMatchObject({ status: "ready" });
});
