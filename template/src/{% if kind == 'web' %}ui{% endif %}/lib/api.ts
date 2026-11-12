// The browser's view of the HTTP API. The UI talks to the documented Hono routes only (openapi.json); there are no
// TanStack Start server functions (rules/no-start-server-endpoints.yml).
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";

const MeSchema = z.object({
	userId: z.string(),
	email: z.string(),
	name: z.string(),
});
const AuthErrorSchema = z.object({ message: z.string() });

/** The signed-in user. */
export type Me = z.infer<typeof MeSchema>;

/** `GET /api/v1/me`: the signed-in user, or `null` when anonymous. */
export async function fetchMe(): Promise<Me | null> {
	const response = await fetch("/api/v1/me", { credentials: "same-origin" });
	if (response.status === 401) {
		return null;
	}
	if (!response.ok) {
		throw new Error(
			`GET /api/v1/me failed with HTTP ${String(response.status)}`,
		);
	}
	return MeSchema.parse(await response.json());
}

/** React Query options for the current user (client-side; the server never fetches its own API). */
export const meQuery = queryOptions({ queryKey: ["me"], queryFn: fetchMe });

/**
 * POSTs JSON to a better-auth endpoint and throws its message on failure.
 * @param path - Path under /api/auth, e.g. `/sign-in/email`.
 * @param body - The JSON body.
 */
export async function postAuth(
	path: string,
	body: Readonly<Record<string, unknown>>,
): Promise<void> {
	const response = await fetch(`/api/auth${path}`, {
		method: "POST",
		credentials: "same-origin",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
	});
	if (response.ok) {
		return;
	}
	const parsed = AuthErrorSchema.safeParse(
		await response.json().catch(() => null),
	);
	throw new Error(
		parsed.success ? parsed.data.message : `HTTP ${String(response.status)}`,
	);
}
