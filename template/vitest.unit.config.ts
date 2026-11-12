// vitest.unit.config.ts — the `unit` project, run in Node: src/**/*.test.ts, tests/**/*.test.ts and the Claude hook
// tests. MSW fails any unmocked outbound HTTP, and every test file gets a fresh, migrated Postgres database
// (tests/setup.db.ts, cloned from the template database tests/global-setup.pg.ts prepares). Stryker runs this config
// directly (stryker.config.json): its Vitest runner does not support `test.projects`.
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		name: "unit",
		include: [
			"src/**/*.{test,spec}.ts",
			"tests/**/*.{test,spec}.ts",
			".claude/hooks/tests/**/*.test.ts",
		],
		exclude: [
			"tests/e2e/**",
			"tests/security/**",
			"tests/smoke/**",
			"tests/load/**",
			"node_modules/**",
		],
		includeSource: ["src/**/*.ts"],
		globalSetup: ["tests/global-setup.pg.ts"],
		setupFiles: ["tests/setup.db.ts", "tests/setup.msw.ts"],
		typecheck: { enabled: true, ignoreSourceErrors: false },
		// Vitest's 5 s default is too tight while the whole gate runs in parallel on a cold cache (a fresh project's first
		// `just check`): tests/lint/jsx-a11y.test.ts loads every ESLint plugin (1-2 s idle, over 5 s under load) and the
		// jobs/auth tests start pg-boss and better-auth. A hung test still fails, just later.
		testTimeout: 30_000,
	},
	define: { "import.meta.vitest": "undefined" },
});
