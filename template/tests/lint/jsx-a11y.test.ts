// tests/lint/jsx-a11y.test.ts — eslint-plugin-jsx-a11y 6.10.2 declares ESLint <=9 and runs on ESLint 10 through
// @eslint/compat (eslint.config.js). This lints a deliberately broken fixture with the project's own TSX block (the
// shimmed jsx-a11y and react-hooks rules, read from eslint.config.js) and fails the moment the shim or a plugin
// upgrade stops the rules from reporting. Type information is not needed for these rules, so the fixture is parsed
// without the project service (a full typed program would make this test take a minute).
import { pathToFileURL } from "node:url";
import { ESLint, type Linter } from "eslint";
import tseslint from "typescript-eslint";
import { describe, expect, it } from "vitest";

const CONFIG_URL = pathToFileURL(`${process.cwd()}/eslint.config.js`).href;

function isConfigBlock(value: unknown): value is Linter.Config {
	return typeof value === "object" && value !== null;
}

/** The block of eslint.config.js that configures the jsx-a11y plugin. */
async function tsxBlock(): Promise<Linter.Config> {
	const module: unknown = await import(CONFIG_URL);
	const config: unknown =
		typeof module === "object" && module !== null && "default" in module
			? module.default
			: undefined;
	const blocks = Array.isArray(config) ? config.filter(isConfigBlock) : [];
	const block = blocks.find(
		(candidate) => candidate.plugins?.["jsx-a11y"] !== undefined,
	);
	if (block === undefined) {
		throw new Error("eslint.config.js has no jsx-a11y block");
	}
	return block;
}

describe("eslint.config.js on TSX", () => {
	it("reports jsx-a11y and react-hooks violations", async () => {
		const eslint = new ESLint({
			ignore: false,
			overrideConfigFile: true,
			overrideConfig: [
				{
					files: ["**/*.tsx"],
					languageOptions: {
						parser: tseslint.parser,
						parserOptions: { ecmaFeatures: { jsx: true } },
					},
				},
				await tsxBlock(),
			],
		});
		const [result] = await eslint.lintFiles([
			"tests/lint/__fixtures__/a11y-violations.tsx",
		]);
		const rules = new Set(result?.messages.map((message) => message.ruleId));
		expect([...rules]).toEqual(
			expect.arrayContaining([
				"jsx-a11y/alt-text",
				"jsx-a11y/anchor-is-valid",
				"jsx-a11y/click-events-have-key-events",
				"react-hooks/rules-of-hooks",
			]),
		);
	});
});
