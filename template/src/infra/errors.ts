import { captureException } from "@sentry/node";
import type { ErrorReporter } from "../app/ports.js";

/**
 * Reports unexpected errors to Sentry. `src/instrumentation.ts` initializes
 * the SDK only when `SENTRY_DSN` is set; before that (or without a DSN)
 * `captureException` is a no-op, so this reporter is always safe to use.
 */
export const sentryReporter: ErrorReporter = {
	capture: (error, context) => {
		captureException(error, {
			tags: {
				"http.route": context.path,
				...(context.traceId === undefined ? {} : { trace_id: context.traceId }),
			},
		});
	},
};
