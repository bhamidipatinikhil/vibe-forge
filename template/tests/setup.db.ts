// tests/setup.db.ts — Vitest setupFile (unit project): a fresh, migrated database for this test file, cloned from
// the template tests/global-setup.pg.ts prepared. DATABASE_URL points at it before any test imports src/env.ts, so
// the app, better-auth, pg-boss and the repositories all talk to a real Postgres (no in-repo mocks, AGENTS.md).
import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, inject } from "vitest";

const serverUrl = inject("pgServerUrl");
const template = inject("pgTemplate");
const database = `test_${randomUUID().replaceAll("-", "")}`;

async function admin(statement: string): Promise<void> {
	const client = new pg.Client({ connectionString: serverUrl });
	await client.connect();
	try {
		await client.query(statement);
	} finally {
		await client.end();
	}
}

await admin(`CREATE DATABASE "${database}" TEMPLATE "${template}"`);
const url = new URL(serverUrl);
url.pathname = `/${database}`;
process.env["DATABASE_URL"] = url.href;

afterAll(async () => {
	await admin(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
});
