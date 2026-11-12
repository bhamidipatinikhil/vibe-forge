import { register } from "node:module";
import { diag } from "@opentelemetry/api";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { PinoInstrumentation } from "@opentelemetry/instrumentation-pino";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
	contextLinesIntegration,
	dedupeIntegration,
	initWithoutDefaultIntegrations,
	linkedErrorsIntegration,
	nodeContextIntegration,
	onUncaughtExceptionIntegration,
	onUnhandledRejectionIntegration,
} from "@sentry/node";
import { env } from "./env.js";

// Loaded before the app with `node --import ./instrumentation.js`. ESM modules
// are only patched through the loader hook, so it is registered first.
// eslint-disable-next-line @typescript-eslint/no-deprecated -- reason: Node 26 deprecates module.register() in favour of registerHooks(), but @opentelemetry/instrumentation/hook.mjs is the only loader hook OpenTelemetry supports and it is asynchronous.
register("@opentelemetry/instrumentation/hook.mjs", import.meta.url, {
	// import-in-the-middle rewraps every module it sees, which breaks ESM import cycles (TanStack Router's router-core
	// has one: "Cannot access 'replaceRouteChunk' before initialization") and cannot parse TSX run through tsx in dev.
	// OpenTelemetry only patches third-party libraries, so TanStack and the project's own modules are left alone.
	data: {
		exclude: [
			/\/node_modules\/(\.pnpm\/)?@tanstack[+/]/,
			/\/dist\/(server|node)\//,
			/\/src\/.*\.tsx?$/,
		],
	},
});

// Exporters exist only when a collector is configured (OTEL_EXPORTER_OTLP_*
// env vars; the exporters read them when constructed without arguments).
// Without one, no span processor, metric reader or log record processor is
// configured, so no exporter exists: nothing is exported and shutdown does
// not wait on export retries (measured: ~30 ms instead of ~8 s against an
// unreachable collector).
const exporting = env.OTEL_EXPORTER_OTLP_ENDPOINT !== undefined;

const sdk = new NodeSDK({
	serviceName: env.OTEL_SERVICE_NAME,
	...(exporting
		? {
				traceExporter: new OTLPTraceExporter(),
				metricReaders: [
					new PeriodicExportingMetricReader({
						exporter: new OTLPMetricExporter(),
					}),
				],
			}
		: { spanProcessors: [], metricReaders: [], logRecordProcessors: [] }),
	instrumentations: [
		getNodeAutoInstrumentations({
			// Registered explicitly below so log sending can be disabled.
			"@opentelemetry/instrumentation-pino": { enabled: false },
		}),
		// Keep trace correlation; the OTel logs SDK is still "Development".
		new PinoInstrumentation({ disableLogSending: true }),
	],
});

sdk.start();

// Sentry receives errors only: traces stay on OTLP (Grafana), and with enableOpenTelemetrySetup left at its default
// (false) Sentry registers no tracer provider of its own, so nothing is instrumented twice. Without SENTRY_DSN nothing
// is initialized and src/infra/errors.ts reports into a no-op.
if (env.SENTRY_DSN !== undefined) {
	initWithoutDefaultIntegrations({
		dsn: env.SENTRY_DSN,
		environment: env.NODE_ENV,
		...(env.SENTRY_RELEASE === undefined
			? {}
			: { release: env.SENTRY_RELEASE }),
		integrations: [
			onUncaughtExceptionIntegration(),
			onUnhandledRejectionIntegration(),
			linkedErrorsIntegration(),
			dedupeIntegration(),
			contextLinesIntegration(),
			nodeContextIntegration(),
		],
	});
}

const flushTelemetry = (): void => {
	// The HTTP server (src/index.ts) owns the exit; this only flushes spans
	// and metrics so nothing is lost when the process ends.
	sdk.shutdown().catch((e: unknown) => {
		diag.error("OpenTelemetry SDK shutdown failed", e);
	});
};

process.once("SIGTERM", flushTelemetry);
process.once("SIGINT", flushTelemetry);
