// scripts/lib/ephemeral-pg.ts — a throwaway Postgres cluster from the Nix shell's postgresql_18 (initdb + pg_ctl).
// TCP on 127.0.0.1 with a free port and no unix socket (`-k ''`): that works inside the Claude Code sandbox (private
// network namespace, unix sockets blocked by seccomp) and in project paths with spaces, which socket paths do not
// allow. fsync and friends are off: the data is disposable.
import { execFile, execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

/** A running cluster; `url()` builds a connection URL for one database in it. */
export interface PgCluster {
	/** TCP port on 127.0.0.1. */
	readonly port: number;
	/**
	 * Connection URL of a database in this cluster (the database need not exist yet).
	 * @param database - Database name.
	 */
	readonly url: (database: string) => string;
	/** Stops the server and deletes its data directory. */
	readonly stop: () => Promise<void>;
}

/** A free TCP port on 127.0.0.1 (released before Postgres binds it; the race is acceptable for tests). */
export function freePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const server = createServer();
		server.once("error", reject);
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			server.close(() => {
				if (address === null || typeof address === "string") {
					reject(new Error("no TCP address"));
				} else {
					resolve(address.port);
				}
			});
		});
	});
}

/**
 * Connection URL for `database` on a local cluster as user `postgres` (trust auth).
 * @param port - TCP port.
 * @param database - Database name.
 */
export function localUrl(port: number, database: string): string {
	return `postgres://postgres@127.0.0.1:${String(port)}/${database}?sslmode=disable`;
}

/** Options of {@link startCluster}. */
export interface ClusterOptions {
	/** Keep the data here instead of a temporary directory (`just db-up`); it survives `stop()`. */
	readonly dataDir?: string;
	/** Port to bind; a free one by default. */
	readonly port?: number;
}

/**
 * Initializes (when needed) and starts a cluster, waiting until it accepts connections.
 * @param options - Persistent data directory and port, both optional.
 * @returns The running cluster.
 */
export async function startCluster(
	options: ClusterOptions = {},
): Promise<PgCluster> {
	const persistent = options.dataDir !== undefined;
	const root = options.dataDir ?? (await mkdtemp(join(tmpdir(), "pg-")));
	const data = join(root, "data");
	const port = options.port ?? (await freePort());
	if (!existsSync(join(data, "PG_VERSION"))) {
		await run("initdb", [
			"-D",
			data,
			"-U",
			"postgres",
			"-A",
			"trust",
			"--no-sync",
			"-E",
			"UTF8",
			"--no-instructions",
		]);
	}
	const running = await run("pg_ctl", ["status", "-D", data]).then(
		() => true,
		() => false,
	);
	if (!running) {
		const settings = `-k '' -c listen_addresses=127.0.0.1 -p ${String(port)} -c fsync=off -c synchronous_commit=off -c full_page_writes=off`;
		await run("pg_ctl", [
			"start",
			"-D",
			data,
			"-w",
			"-l",
			join(root, "postgres.log"),
			"-o",
			settings,
		]);
	}
	// pg_ctl detaches the server into its own session, so it outlives an owner that exits without calling stop() (an
	// exception, process.exit). A throwaway cluster is therefore also stopped, synchronously, when its owner exits.
	// Only SIGKILL gets past this, which is why playwright.config.ts stops its webServer with SIGTERM.
	const stopOnExit = (): void => {
		try {
			execFileSync("pg_ctl", ["stop", "-D", data, "-m", "immediate", "-w"], {
				stdio: "ignore",
			});
		} catch {
			// Already stopped.
		}
		rmSync(root, { recursive: true, force: true });
	};
	if (!persistent) {
		process.once("exit", stopOnExit);
	}
	return {
		port,
		url: (database) => localUrl(port, database),
		stop: async () => {
			process.removeListener("exit", stopOnExit);
			await run("pg_ctl", ["stop", "-D", data, "-m", "fast", "-w"]);
			if (!persistent) {
				await rm(root, { recursive: true, force: true });
			}
		},
	};
}

/**
 * Runs dbmate against `url` (migrations in migrations/, schema dump in db/schema.sql).
 * @param url - Database URL.
 * @param args - dbmate arguments, e.g. `["--no-dump-schema", "up"]`.
 */
export async function dbmate(
	url: string,
	args: readonly string[],
): Promise<void> {
	await run("dbmate", [
		"--url",
		url,
		"--migrations-dir",
		"migrations",
		"--schema-file",
		"db/schema.sql",
		...args,
	]);
}
