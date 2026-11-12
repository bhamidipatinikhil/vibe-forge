import { once } from "node:events";
import { afterAll, describe, expect, it, vi } from "vitest";
import { server, shutdown, stopped } from "./index.js";

vi.hoisted(() => {
	vi.stubEnv("PORT", "0");
	vi.stubEnv("LOG_LEVEL", "silent");
});

afterAll(() => {
	process.removeListener("SIGTERM", shutdown);
	process.removeListener("SIGINT", shutdown);
	vi.unstubAllEnvs();
});

// The listen, drain and deadline paths are covered by src/infra/server.test.ts;
// this checks only the wiring the entrypoint adds on top of startServer().
describe("src/index.ts", () => {
	it("starts the service on the loopback interface and arms the signal handlers", async () => {
		if (!server.listening) {
			await once(server, "listening");
		}
		expect(server.address()).toMatchObject({ address: "127.0.0.1" });
		expect(process.listeners("SIGTERM")).toContain(shutdown);
		expect(process.listeners("SIGINT")).toContain(shutdown);
		shutdown("SIGTERM");
		await once(server, "close");
		expect(server.listening).toBe(false);
		await stopped;
	});
});
