// scripts/db.ts — database chores (`just db-*`):
//   up        start the local cluster (.data/pg, 127.0.0.1:54329), create the database, apply migrations
//   down      stop the local cluster (the data stays in .data/pg)
//   generate  apply migrations to a throwaway cluster, write db/schema.sql and src/infra/db/schema.gen.ts
//   check     the same, but fail when either committed file differs (`just check` runs this)
// generate/check never touch the local database: the committed files follow from migrations/ alone.
import { execFile } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { env } from "../src/env.js";
import { dbmate, localUrl, startCluster } from "./lib/ephemeral-pg.js";
import { invokedDirectly, writeOrCheck } from "./lib/write-or-check.js";

const run = promisify(execFile);

/** Port of the persistent local cluster; `src/env.ts` defaults DATABASE_URL to it. */
export const LOCAL_PORT = 54329;
const LOCAL_DATA = ".data/pg";
const SCHEMA_SQL = new URL("../db/schema.sql", import.meta.url);
const SCHEMA_TYPES = "src/infra/db/schema.gen.ts";

/** The database name in DATABASE_URL (by default the local cluster's, src/env.ts), e.g. `my_app`. */
function localDatabase(): string {
	return new URL(env.DATABASE_URL).pathname.slice(1) || "app";
}

async function codegen(url: string, verify: boolean): Promise<number> {
	const args = [
		"--dialect",
		"postgres",
		"--url",
		url,
		"--out-file",
		SCHEMA_TYPES,
		"--exclude-pattern",
		"public.schema_migrations",
		...(verify ? ["--verify"] : []),
	];
	try {
		await run("kysely-codegen", args);
		return 0;
	} catch (e: unknown) {
		process.stderr.write(
			`${SCHEMA_TYPES} is out of date (or kysely-codegen failed): ${String(e)}\nRun: just db-generate\n`,
		);
		return 1;
	}
}

async function generate(check: boolean): Promise<number> {
	const cluster = await startCluster();
	const dump = join(tmpdir(), `schema-${String(process.pid)}.sql`);
	try {
		const url = cluster.url("app");
		await dbmate(url, ["--wait", "--no-dump-schema", "up"]);
		await run("dbmate", ["--url", url, "--schema-file", dump, "dump"]);
		const schema = await readFile(dump, "utf8");
		const sql = await writeOrCheck({
			file: SCHEMA_SQL,
			generated: schema,
			check,
			regenerate: "just db-generate",
		});
		const types = await codegen(url, check);
		return Math.max(sql, types);
	} finally {
		await rm(dump, { force: true });
		await cluster.stop();
	}
}

/**
 * CLI entry.
 * @param args - `up`, `down`, `generate` or `check`.
 * @returns The process exit code.
 */
export async function main(args: readonly string[]): Promise<number> {
	switch (args[0]) {
		case "up": {
			const cluster = await startCluster({
				dataDir: LOCAL_DATA,
				port: LOCAL_PORT,
			});
			await dbmate(cluster.url(localDatabase()), ["--wait", "up"]);
			process.stdout.write(
				`local Postgres on ${localUrl(LOCAL_PORT, localDatabase())}\n`,
			);
			return 0;
		}
		case "down":
			await run("pg_ctl", [
				"stop",
				"-D",
				`${LOCAL_DATA}/data`,
				"-m",
				"fast",
				"-w",
			]);
			return 0;
		case "generate":
			return generate(false);
		case "check":
			return generate(true);
		case undefined:
		default:
			process.stderr.write("usage: tsx scripts/db.ts up|down|generate|check\n");
			return 2;
	}
}

if (invokedDirectly(import.meta.url)) {
	process.exitCode = await main(process.argv.slice(2));
}
