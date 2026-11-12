// tests/global-setup.pg.ts — Vitest globalSetup (unit project): one Postgres for the whole run. Reuses TEST_PG_URL
// when scripts/with-pg.ts started one (Stryker, CI), otherwise starts a throwaway cluster from the Nix shell. It
// migrates a template database once (and installs pg-boss's schema into it), so every test file can clone a fresh,
// fully migrated database in milliseconds (tests/setup.db.ts).

import pg from "pg";
import { PgBoss } from "pg-boss";
import type { TestProject } from "vitest/node";
import { dbmate, startCluster } from "../scripts/lib/ephemeral-pg.js";

declare module "vitest" {
	export interface ProvidedContext {
		/** URL of the cluster's `postgres` database (for CREATE/DROP DATABASE). */
		pgServerUrl: string;
		/** Name of the migrated template database to clone. */
		pgTemplate: string;
	}
}

function withDatabase(url: string, database: string): string {
	const parsed = new URL(url);
	parsed.pathname = `/${database}`;
	return parsed.href;
}

export default async function setup(
	project: TestProject,
): Promise<() => Promise<void>> {
	const { TEST_PG_URL } = process.env;
	const cluster = TEST_PG_URL === undefined ? await startCluster() : undefined;
	const serverUrl = TEST_PG_URL ?? cluster?.url("postgres") ?? "";
	const template = `template_${String(process.pid)}`;
	const templateUrl = withDatabase(serverUrl, template);
	await dbmate(templateUrl, ["--wait", "--no-dump-schema", "up"]);
	const boss = new PgBoss({
		connectionString: templateUrl,
		schema: "pgboss",
		max: 1,
	});
	await boss.start();
	await boss.stop({ graceful: false, close: true });
	project.provide("pgServerUrl", serverUrl);
	project.provide("pgTemplate", template);
	return async () => {
		const admin = new pg.Client({ connectionString: serverUrl });
		await admin.connect();
		await admin.query(`DROP DATABASE IF EXISTS "${template}" WITH (FORCE)`);
		await admin.end();
		await cluster?.stop();
	};
}
