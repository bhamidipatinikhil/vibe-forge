import { z } from "@hono/zod-openapi";

// The documented contract of the better-auth endpoints the app enables (src/app/routes/auth.ts). better-auth
// validates the requests itself; these schemas describe them in openapi.json for clients, Schemathesis and the
// access matrix. Fields better-auth accepts but the app does not use are left out on purpose.

const email = z.email().openapi({ example: "ada@example.com" });
const password = z
	.string()
	.min(8)
	.max(128)
	.openapi({ example: "correct-horse-battery" });
const callbackURL = z
	.string()
	.optional()
	.openapi({ description: "Same-origin path to redirect to afterwards" });

/** Error body of every better-auth endpoint (not the app's `ErrorResponse`). */
export const AuthErrorSchema = z
	.object({
		message: z.string().openapi({ example: "Invalid email or password" }),
		code: z
			.string()
			.optional()
			.openapi({ example: "INVALID_EMAIL_OR_PASSWORD" }),
	})
	.openapi("AuthError");

/** A user as better-auth returns it. */
export const AuthUserSchema = z
	.object({
		id: z.string(),
		name: z.string(),
		email: z.string(),
		emailVerified: z.boolean(),
		image: z.string().nullable().optional(),
		createdAt: z.string(),
		updatedAt: z.string(),
	})
	.openapi("AuthUser");

/** Body of `POST /api/auth/sign-up/email`. */
export const SignUpBodySchema = z
	.object({
		name: z.string().min(1).max(100).openapi({ example: "Ada Lovelace" }),
		email,
		password,
		callbackURL,
	})
	.openapi("SignUpBody");

/** Body of `POST /api/auth/sign-in/email`. */
export const SignInBodySchema = z
	.object({ email, password, callbackURL, rememberMe: z.boolean().optional() })
	.openapi("SignInBody");

/** Body of a successful sign-up or sign-in (the session cookie is set as well). */
export const SignedInSchema = z
	.object({ token: z.string().nullable(), user: AuthUserSchema })
	.openapi("SignedIn");

/** Body of `GET /api/auth/get-session`: the session and its user, or `null`. */
export const SessionResponseSchema = z
	.object({
		session: z.object({
			id: z.string(),
			userId: z.string(),
			expiresAt: z.string(),
		}),
		user: AuthUserSchema,
	})
	.nullable()
	.openapi("SessionResponse");

/** Body of `POST /api/auth/request-password-reset`. */
export const PasswordResetRequestSchema = z
	.object({ email, redirectTo: callbackURL })
	.openapi("PasswordResetRequest");

/** Body of `POST /api/auth/reset-password`. */
export const ResetPasswordBodySchema = z
	.object({ newPassword: password, token: z.string().min(1) })
	.openapi("ResetPasswordBody");

/** Body of `POST /api/auth/send-verification-email`. */
export const SendVerificationBodySchema = z
	.object({ email, callbackURL })
	.openapi("SendVerificationBody");

/** Body of `POST /api/auth/change-password`. */
export const ChangePasswordBodySchema = z
	.object({
		currentPassword: password,
		newPassword: password,
		revokeOtherSessions: z.boolean().optional(),
	})
	.openapi("ChangePasswordBody");

/** Query of `GET /api/auth/verify-email` (the link in the verification email). */
export const VerifyEmailQuerySchema = z.object({
	token: z
		.string()
		.min(1)
		.openapi({ param: { name: "token", in: "query" } }),
	callbackURL: z
		.string()
		.optional()
		.openapi({ param: { name: "callbackURL", in: "query" } }),
});

/** `{ status: true }` style acknowledgement. */
export const AuthStatusSchema = z
	.object({ status: z.boolean().optional(), success: z.boolean().optional() })
	.openapi("AuthStatus");

/** Body of `GET /api/v1/me`. */
export const MeResponseSchema = z
	.object({ userId: z.string(), email: z.string(), name: z.string() })
	.openapi("Me");
