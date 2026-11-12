import { pino } from "pino";
import { env } from "./env.js";

/**
 * Structured JSON logger for the whole service. Sensitive paths are redacted
 * before serialization, and the OpenTelemetry Pino instrumentation adds
 * `trace_id` and `span_id` to every record written inside a span.
 */
export const logger = pino({
	level: env.LOG_LEVEL,
	redact: {
		paths: [
			"req.headers.authorization",
			"req.headers.cookie",
			"*.password",
			"*.token",
		],
		censor: "[REDACTED]",
	},
});
