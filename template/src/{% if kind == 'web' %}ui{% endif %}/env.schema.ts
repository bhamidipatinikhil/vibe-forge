import { z } from "zod";

/**
 * Browser-side configuration: `VITE_*` variables, baked into the client bundle
 * at build time (so never a secret). `scripts/env-example.ts` documents them in
 * `.env.example` next to the server keys.
 */
export const clientSchema = {
	VITE_SENTRY_DSN: z.url().optional().meta({
		description:
			"Sentry DSN for browser errors (public by design); unset disables @sentry/react",
		example: "",
	}),
	VITE_UMAMI_SCRIPT_URL: z.url().optional().meta({
		description:
			"Umami tracker script, e.g. https://analytics.example.com/script.js (add its origin to CSP_CONNECT_SRC)",
		example: "",
	}),
	VITE_UMAMI_WEBSITE_ID: z.string().min(1).optional().meta({
		description: "Umami website id",
		example: "",
	}),
};
