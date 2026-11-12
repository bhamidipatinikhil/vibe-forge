import { browserTracingIntegration, init } from "@sentry/react";
import { type Metric, onCLS, onFCP, onINP, onLCP, onTTFB } from "web-vitals";
import { clientEnv } from "../public-env";

/** Sends one Core Web Vitals measurement to the server (POST /api/v1/vitals, an OTel histogram there). */
export function reportVital(
	metric: Pick<Metric, "name" | "value" | "rating">,
): void {
	const body = JSON.stringify({
		name: metric.name,
		value: metric.value,
		rating: metric.rating,
		path: window.location.pathname,
	});
	const blob = new Blob([body], { type: "application/json" });
	if (!navigator.sendBeacon("/api/v1/vitals", blob)) {
		void fetch("/api/v1/vitals", {
			method: "POST",
			body,
			keepalive: true,
			headers: { "content-type": "application/json" },
		});
	}
}

/** Starts browser error reporting (when VITE_SENTRY_DSN is set) and real-user web vitals. */
export function startMonitoring(): void {
	if (clientEnv.VITE_SENTRY_DSN !== undefined) {
		init({
			dsn: clientEnv.VITE_SENTRY_DSN,
			integrations: [browserTracingIntegration()],
			tracesSampleRate: 0.1,
		});
	}
	for (const listen of [onCLS, onFCP, onINP, onLCP, onTTFB]) {
		listen(reportVital);
	}
}
