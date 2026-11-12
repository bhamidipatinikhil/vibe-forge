import { TypedInMemoryProvider } from "@openfeature/server-sdk";
import { afterAll, describe, expect, it } from "vitest";
import { flagFileProvider, startFlags } from "./flags.js";

describe("startFlags", () => {
	afterAll(async () => {
		const flags = await startFlags(new TypedInMemoryProvider({}));
		await flags.close();
	});

	it("evaluates boolean flags and falls back for missing ones", async () => {
		const flags = await startFlags(
			new TypedInMemoryProvider({
				"kill-switch-writes": {
					variants: { on: true, off: false },
					defaultVariant: "on",
					disabled: false,
				},
			}),
		);
		expect(await flags.isEnabled("kill-switch-writes", false)).toBe(true);
		expect(await flags.isEnabled("no-such-flag", true)).toBe(true);
		expect(await flags.isEnabled("no-such-flag", false)).toBe(false);
	});

	it("reads the committed flag file through flagd's in-process resolver", async () => {
		const flags = await startFlags(flagFileProvider("flags/flags.json"));
		expect(await flags.isEnabled("kill-switch-writes", true)).toBe(false);
		expect(await flags.isEnabled("events-stream", false)).toBe(true);
		await flags.close();
	});
});
