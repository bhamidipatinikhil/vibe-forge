import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { routeTree } from "./routeTree.gen";

/** Header Hono sets to the per-request CSP nonce (src/infra/web.ts, scripts/dev.ts). */
const NONCE_HEADER = "x-csp-nonce";

const requestNonce = createIsomorphicFn()
	.server(() => getRequestHeader(NONCE_HEADER))
	.client(() => undefined);

/**
 * One router per request on the server (and one in the browser): React Query
 * is wired through the router context and dehydrated into the SSR stream, and
 * every script the server renders carries the request's CSP nonce.
 */
export function getRouter() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { staleTime: 30_000 } },
	});
	const nonce = requestNonce();
	const router = createRouter({
		routeTree,
		context: { queryClient },
		scrollRestoration: true,
		defaultPreload: "intent",
		...(nonce === undefined || nonce === "" ? {} : { ssr: { nonce } }),
	});
	setupRouterSsrQueryIntegration({ router, queryClient });
	return router;
}
