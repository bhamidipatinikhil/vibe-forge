// scripts/with-pg.ts — `tsx scripts/with-pg.ts -- <command...>`: runs one command against a throwaway Postgres with
// the migrations applied. It sets DATABASE_URL (a migrated database) and TEST_PG_URL (the cluster's `postgres`
// database, which tests/global-setup.pg.ts reuses instead of starting its own). Used by Playwright's webServer,
// `just mutation` (one cluster for every Stryker worker) and the secpass workflow.
import { spawn } from "node:child_process";
import { dbmate, startCluster } from "./lib/ephemeral-pg.js";

const separator = process.argv.indexOf("--");
const [command, ...args] =
	separator === -1 ? [] : process.argv.slice(separator + 1);
if (command === undefined) {
	process.stderr.write(
		"usage: tsx scripts/with-pg.ts -- <command> [args...]\n",
	);
	process.exit(2);
}

const cluster = await startCluster();
const databaseUrl = cluster.url("app");
await dbmate(databaseUrl, ["--wait", "--no-dump-schema", "up"]);

const child = spawn(command, args, {
	stdio: "inherit",
	env: {
		...process.env,
		DATABASE_URL: databaseUrl,
		TEST_PG_URL: cluster.url("postgres"),
	},
});
for (const signal of ["SIGINT", "SIGTERM"] as const) {
	process.on(signal, () => {
		child.kill(signal);
	});
}
const code = await new Promise<number>((resolve) => {
	child.on("exit", (status, signal) => {
		resolve(status ?? (signal === null ? 1 : 128));
	});
});
await cluster.stop();
process.exitCode = code;
