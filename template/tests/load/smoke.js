// tests/load/smoke.js — k6 smoke test. The thresholds make k6 exit non-zero
// (and fail CI) when more than 1% of requests fail or p(95) latency exceeds
// 200 ms.
//
// k6 comes from the Nix dev shell (it is not an npm package: knip, Biome and
// ESLint do not resolve `k6/*`; that is expected). Run it with `just load`
// (a local production build on a throwaway Postgres) or against a deployment:
//   k6 run -e BASE_URL=https://staging.example tests/load/smoke.js
// In CI: grafana/setup-k6-action then grafana/run-k6-action with
// `path: tests/load/smoke.js` (fail-fast). For the weekly soak, override the
// profile on the command line: `k6 run --vus 20 --duration 3h tests/load/smoke.js`.
import { check } from "k6";
import http from "k6/http";

const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:3000";

export const options = {
	vus: 10,
	duration: "1m",
	thresholds: {
		http_req_failed: ["rate<0.01"],
		http_req_duration: ["p(95)<200"],
	},
};

export default function () {
	const response = http.get(`${BASE_URL}/readyz`);
	check(response, { "readyz is 200": (r) => r.status === 200 });
}
