import { betterAuth } from "better-auth";
import type { Logger } from "pino";
import type { AuthPort } from "../app/ports.js";
import { AUTH_BASE_PATH } from "../app/routes/auth.js";
import type { Database } from "./db.js";
import type { EmailJob } from "./jobs.js";

/**
 * better-auth endpoints the app does not use. Disabled paths answer 404, so
 * the reachable surface is exactly `AUTH_ROUTES` (src/app/routes/auth.ts);
 * the parity test fails when an upgrade adds a path that is in neither list.
 */
export const DISABLED_AUTH_PATHS = [
	"/account-info",
	"/callback/:id",
	"/change-email",
	"/delete-user",
	"/delete-user/callback",
	"/error",
	"/get-access-token",
	"/link-social",
	"/list-accounts",
	"/list-sessions",
	"/ok",
	"/refresh-token",
	"/reset-password/:token",
	"/revoke-other-sessions",
	"/revoke-session",
	"/revoke-sessions",
	"/sign-in/social",
	"/unlink-account",
	"/update-session",
	"/update-user",
	"/verify-password",
] as const;

/** Options of {@link createAuth}. */
export interface AuthOptions {
	/** The shared query builder (better-auth runs its queries through it). */
	readonly db: Database;
	/** Signing secret (BETTER_AUTH_SECRET). */
	readonly secret: string;
	/** Public origin (APP_URL): links in emails, the trusted origin. */
	readonly appUrl: string;
	/** Queues an account email. */
	readonly sendEmail: (job: EmailJob) => Promise<void>;
	/** Where better-auth's own log lines go. */
	readonly logger: Pick<Logger, "debug" | "info" | "warn" | "error">;
}

// better-auth's camelCase fields mapped onto the snake_case columns of migrations/*_auth.sql.
const timestamps = {
	createdAt: "created_at",
	updatedAt: "updated_at",
} as const;
const schema = {
	user: {
		modelName: "users",
		fields: { emailVerified: "email_verified", ...timestamps },
	},
	session: {
		modelName: "sessions",
		fields: {
			userId: "user_id",
			expiresAt: "expires_at",
			ipAddress: "ip_address",
			userAgent: "user_agent",
			...timestamps,
		},
	},
	account: {
		modelName: "accounts",
		fields: {
			userId: "user_id",
			accountId: "account_id",
			providerId: "provider_id",
			accessToken: "access_token",
			refreshToken: "refresh_token",
			idToken: "id_token",
			accessTokenExpiresAt: "access_token_expires_at",
			refreshTokenExpiresAt: "refresh_token_expires_at",
			...timestamps,
		},
	},
	verification: {
		modelName: "verifications",
		fields: { expiresAt: "expires_at", ...timestamps },
	},
} as const;

/** better-auth behind the port the HTTP layer uses. */
export interface Auth extends AuthPort {
	/** Every endpoint path better-auth defines (enabled or not), for the parity test. */
	readonly endpointPaths: readonly string[];
}

/**
 * Configures better-auth: email and password, email verification and
 * password reset (sent through the job queue), telemetry off, the unused
 * endpoints disabled, logs routed into Pino.
 * @param options - Database, secret, origin, email queue and logger.
 * @returns The request handler, the session lookup and the endpoint list.
 */
export function createAuth(options: AuthOptions): Auth {
	const origin = new URL(options.appUrl).origin;
	const auth = betterAuth({
		appName: "app",
		secret: options.secret,
		baseURL: origin,
		basePath: AUTH_BASE_PATH,
		trustedOrigins: [origin],
		database: { db: options.db, type: "postgres" },
		telemetry: { enabled: false },
		// better-auth turns its origin check off when NODE_ENV is "test"; pinning it on means the test suite and the
		// e2e run exercise exactly the production CSRF behaviour.
		advanced: { disableOriginCheck: false },
		disabledPaths: [...DISABLED_AUTH_PATHS],
		logger: {
			log: (level, message) => {
				options.logger[level]({ component: "better-auth" }, message);
			},
		},
		emailAndPassword: {
			enabled: true,
			minPasswordLength: 8,
			sendResetPassword: async ({ user, token }) => {
				const url = new URL("/reset-password", origin);
				url.searchParams.set("token", token);
				await options.sendEmail({
					template: "reset-password",
					to: user.email,
					url: url.href,
				});
			},
		},
		emailVerification: {
			sendOnSignUp: true,
			sendVerificationEmail: async ({ user, url }) => {
				await options.sendEmail({
					template: "verify-email",
					to: user.email,
					url,
				});
			},
		},
		...schema,
	});
	const endpointPaths = Object.values(auth.api).flatMap((endpoint) =>
		"path" in endpoint && typeof endpoint.path === "string"
			? [endpoint.path]
			: [],
	);
	return {
		handler: (request) => auth.handler(request),
		getSession: async (headers) => {
			const found = await auth.api.getSession({ headers });
			return found === null
				? null
				: {
						userId: found.user.id,
						email: found.user.email,
						name: found.user.name,
					};
		},
		endpointPaths,
	};
}
