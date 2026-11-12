import { afterAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../app/app.js";
import { AUTH_BASE_PATH, AUTH_ROUTES } from "../app/routes/auth.js";
import { env } from "../env.js";
import { logger } from "../logger.js";
import { createAuth, DISABLED_AUTH_PATHS } from "./auth.js";
import { createDatabase } from "./db.js";
import type { EmailJob } from "./jobs.js";

vi.hoisted(() => {
	vi.stubEnv("LOG_LEVEL", "silent");
});

const db = createDatabase({ url: env.DATABASE_URL, poolMax: 2 });
const sent: EmailJob[] = [];
const auth = createAuth({
	db,
	secret: env.BETTER_AUTH_SECRET,
	appUrl: "http://127.0.0.1:3000",
	sendEmail: (job) => {
		sent.push(job);
		return Promise.resolve();
	},
	logger,
});
const app = createApp({ auth, appUrl: "http://127.0.0.1:3000" });
const origin = { origin: "http://127.0.0.1:3000" };

afterAll(async () => {
	await db.destroy();
	vi.unstubAllEnvs();
});

function post(
	path: string,
	body: unknown,
	headers: Record<string, string> = {},
): Promise<Response> {
	return Promise.resolve(
		app.request(`${AUTH_BASE_PATH}${path}`, {
			method: "POST",
			headers: { "content-type": "application/json", ...origin, ...headers },
			body: JSON.stringify(body),
		}),
	);
}

function cookieOf(response: Response): string {
	return response.headers
		.getSetCookie()
		.map((cookie) => cookie.split(";")[0] ?? "")
		.join("; ");
}

describe("better-auth surface", () => {
	it("enables exactly the documented endpoints: every other better-auth path is disabled", () => {
		const enabled = auth.endpointPaths.filter(
			(path) => !(DISABLED_AUTH_PATHS as readonly string[]).includes(path),
		);
		expect([...enabled].sort()).toEqual(
			AUTH_ROUTES.map((route) => route.path).sort(),
		);
	});

	it("answers a disabled endpoint with 404", async () => {
		const response = await app.request(`${AUTH_BASE_PATH}/list-sessions`);
		expect(response.status).toBe(404);
	});
});

describe("sign-up, session, /api/v1/me, sign-out", () => {
	it("creates an account, queues the verification email and signs the user in", async () => {
		const signUp = await post("/sign-up/email", {
			name: "Ada Lovelace",
			email: "ada@example.com",
			password: "correct-horse-battery",
		});
		expect(signUp.status).toBe(200);
		expect(sent).toEqual([
			expect.objectContaining({
				template: "verify-email",
				to: "ada@example.com",
			}),
		]);
		const cookie = cookieOf(signUp);

		const me = await app.request("/api/v1/me", { headers: { cookie } });
		expect(me.status).toBe(200);
		expect(await me.json()).toMatchObject({
			email: "ada@example.com",
			name: "Ada Lovelace",
		});

		const signOut = await post("/sign-out", {}, { cookie });
		expect(signOut.status).toBe(200);
		const after = await app.request("/api/v1/me", { headers: { cookie } });
		expect(after.status).toBe(401);
	});

	it("rejects a wrong password with 401 and an untrusted origin with 403", async () => {
		const wrong = await post("/sign-in/email", {
			email: "ada@example.com",
			password: "wrong-password-1",
		});
		expect(wrong.status).toBe(401);
		const foreign = await post(
			"/sign-in/email",
			{ email: "ada@example.com", password: "correct-horse-battery" },
			{ origin: "https://evil.example" },
		);
		expect(foreign.status).toBe(403);
	});

	it("queues a password-reset link to the app's reset page", async () => {
		const response = await post("/request-password-reset", {
			email: "ada@example.com",
		});
		expect(response.status).toBe(200);
		const reset = sent.find((job) => job.template === "reset-password");
		expect(reset?.url).toMatch(
			/^http:\/\/127\.0\.0\.1:3000\/reset-password\?token=/,
		);
	});
});
