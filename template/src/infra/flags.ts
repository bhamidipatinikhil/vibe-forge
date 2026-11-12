import { FlagdProvider } from "@openfeature/flagd-provider";
import { OpenFeature, type Provider } from "@openfeature/server-sdk";
import type { FlagsPort } from "../app/ports.js";

/** The running flag client. */
export interface Flags extends FlagsPort {
	/** Shuts the provider down (stops watching the flag file). */
	readonly close: () => Promise<void>;
}

/**
 * The production provider: flagd's in-process resolver over a JSON file of
 * flag definitions (`flags/flags.json`, flagd schema). The file is watched,
 * so a mounted file (volume, ConfigMap) flips a kill switch without a deploy.
 * @param path - Flag definition file.
 * @returns An OpenFeature provider.
 */
export function flagFileProvider(path: string): Provider {
	return new FlagdProvider({
		resolverType: "in-process",
		offlineFlagSourcePath: path,
	});
}

/**
 * Registers `provider` as the process-wide OpenFeature provider and waits
 * until it is ready. A flag that is missing or fails to evaluate returns the
 * caller's fallback, so a broken flag source degrades to the coded defaults.
 * @param provider - Usually {@link flagFileProvider}; tests pass an `InMemoryProvider`.
 * @returns The boolean flag client.
 */
export async function startFlags(provider: Provider): Promise<Flags> {
	await OpenFeature.setProviderAndWait(provider);
	const client = OpenFeature.getClient();
	return {
		isEnabled: (key, fallback) => client.getBooleanValue(key, fallback),
		close: () => OpenFeature.close(),
	};
}
