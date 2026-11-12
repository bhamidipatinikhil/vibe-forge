// tests/setup.msw.ts — Vitest setupFile (see vitest.config.ts). MSW intercepts
// every outbound HTTP request made by unit tests; a request with no handler
// fails the test, so tests mock only at the process boundary.
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll } from "vitest";

/** Project-wide handlers. A test adds its own with `server.use(...)`; they are reset after each test. */
const handlers: Parameters<typeof setupServer> = [];

export const server = setupServer(...handlers);

beforeAll(() => {
	// MSW 3 renamed MSW 2's `onUnhandledRequest` to `onUnhandledFrame`.
	server.listen({ onUnhandledFrame: "error" });
});

afterEach(() => {
	server.resetHandlers();
});

afterAll(() => {
	server.close();
});
