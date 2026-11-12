import { createRoute, type RouteConfig, type z } from "@hono/zod-openapi";
import {
	AuthErrorSchema,
	AuthStatusSchema,
	ChangePasswordBodySchema,
	MeResponseSchema,
	PasswordResetRequestSchema,
	ResetPasswordBodySchema,
	SendVerificationBodySchema,
	SessionResponseSchema,
	SignedInSchema,
	SignInBodySchema,
	SignUpBodySchema,
	VerifyEmailQuerySchema,
} from "../../schemas/auth.js";
import { ErrorResponseSchema } from "../../schemas/error.js";
import type { App, AuthPort } from "../ports.js";
import { requireSession } from "../session.js";

/** Where better-auth is mounted. */
export const AUTH_BASE_PATH = "/api/auth";

type Body = z.ZodType;

interface AuthRoute {
	readonly method: "get" | "post";
	/** Path under {@link AUTH_BASE_PATH}, exactly as better-auth names it. */
	readonly path: string;
	readonly summary: string;
	readonly body?: Body;
	readonly query?: typeof VerifyEmailQuerySchema;
	/** Documented statuses besides 400 (validation) and their bodies. */
	readonly responses: Readonly<Record<number, readonly [string, Body]>>;
}

const json = (schema: Body) => ({ "application/json": { schema } });
const rejected = (description: string) =>
	[description, AuthErrorSchema] as const;

/**
 * The better-auth endpoints the app enables; every other better-auth path is
 * disabled (src/infra/auth.ts) and answers 404. The parity test in
 * src/infra/auth.test.ts fails when a better-auth upgrade adds an endpoint
 * that is neither listed here nor disabled.
 */
export const AUTH_ROUTES: readonly AuthRoute[] = [
	{
		method: "post",
		path: "/sign-up/email",
		summary:
			"Create an account with email and password (signs in, sends a verification email)",
		body: SignUpBodySchema,
		responses: {
			200: ["Account created; session cookie set", SignedInSchema],
			403: rejected("Request origin is not trusted"),
			422: rejected("An account with this email exists"),
		},
	},
	{
		method: "post",
		path: "/sign-in/email",
		summary: "Sign in with email and password",
		body: SignInBodySchema,
		responses: {
			200: ["Signed in; session cookie set", SignedInSchema],
			401: rejected("Wrong email or password"),
			403: rejected(
				"Request origin is not trusted, or the email is not verified",
			),
		},
	},
	{
		method: "post",
		path: "/sign-out",
		summary: "Sign out (clears the session cookie)",
		responses: { 200: ["Signed out", AuthStatusSchema] },
	},
	{
		method: "get",
		path: "/get-session",
		summary: "The current session, or null when anonymous",
		responses: {
			200: ["The session and its user, or null", SessionResponseSchema],
		},
	},
	{
		method: "post",
		path: "/request-password-reset",
		summary:
			"Email a password-reset link (answers the same whether or not the account exists)",
		body: PasswordResetRequestSchema,
		responses: { 200: ["Accepted", AuthStatusSchema] },
	},
	{
		method: "post",
		path: "/reset-password",
		summary: "Set a new password with the token from the reset email",
		body: ResetPasswordBodySchema,
		responses: { 200: ["Password changed", AuthStatusSchema] },
	},
	{
		method: "get",
		path: "/verify-email",
		summary: "Confirm an email address (the link in the verification email)",
		query: VerifyEmailQuerySchema,
		responses: {
			200: ["Email confirmed", AuthStatusSchema],
			302: ["Email confirmed; redirects to callbackURL", AuthStatusSchema],
			401: rejected("Invalid or expired token"),
		},
	},
	{
		method: "post",
		path: "/send-verification-email",
		summary: "Send the verification email again",
		body: SendVerificationBodySchema,
		responses: { 200: ["Sent", AuthStatusSchema] },
	},
	{
		method: "post",
		path: "/change-password",
		summary: "Change the password of the signed-in user",
		body: ChangePasswordBodySchema,
		responses: {
			200: ["Password changed", AuthStatusSchema],
			401: rejected("Not signed in"),
		},
	},
];

function documented(route: AuthRoute): RouteConfig {
	const responses: RouteConfig["responses"] = {
		400: { description: "Invalid request", content: json(AuthErrorSchema) },
		// better-auth checks the Origin of every state-changing request against trustedOrigins (src/infra/auth.ts).
		...(route.method === "post"
			? {
					403: {
						description: "Request origin is not trusted",
						content: json(AuthErrorSchema),
					},
				}
			: {}),
	};
	for (const [status, [description, schema]] of Object.entries(
		route.responses,
	)) {
		responses[status] = { description, content: json(schema) };
	}
	return {
		method: route.method,
		path: `${AUTH_BASE_PATH}${route.path}`,
		tags: ["auth"],
		summary: route.summary,
		request: {
			...(route.body === undefined
				? {}
				: { body: { content: json(route.body), required: true } }),
			...(route.query === undefined ? {} : { query: route.query }),
		},
		responses,
	};
}

/**
 * `GET /api/v1/me`, the pattern for every signed-in route: `requireSession` answers 401 first.
 * @param auth - The session lookup.
 */
function meRoute(auth: AuthPort) {
	return createRoute({
		method: "get",
		path: "/api/v1/me",
		tags: ["auth"],
		summary: "The signed-in user",
		middleware: [requireSession(auth)] as const,
		responses: {
			200: {
				description: "The signed-in user",
				content: json(MeResponseSchema),
			},
			401: { description: "Not signed in", content: json(ErrorResponseSchema) },
		},
	});
}

/**
 * Mounts the enabled better-auth endpoints (one Hono route each, so traces
 * and the access matrix see the real path), documents them in openapi.json,
 * and adds `GET /api/v1/me`.
 * @param app - The application.
 * @param auth - better-auth (src/infra/auth.ts) or a test double.
 */
export function registerAuthRoutes(app: App, auth: AuthPort): void {
	for (const route of AUTH_ROUTES) {
		const config = documented(route);
		app.openAPIRegistry.registerPath(config);
		app.on(route.method.toUpperCase(), config.path, (c) =>
			auth.handler(c.req.raw),
		);
	}
	app.openapi(meRoute(auth), (c) => {
		const { session } = c.var;
		return c.json(
			{ userId: session.userId, email: session.email, name: session.name },
			200,
		);
	});
}

/** Used when no auth backend is wired (tests of unrelated routes, the OpenAPI emitter). */
export const unavailableAuth: AuthPort = {
	handler: () =>
		Promise.resolve(
			Response.json(
				{ message: "Authentication is not configured", code: "UNAVAILABLE" },
				{ status: 503 },
			),
		),
	getSession: () => Promise.resolve(null),
};
