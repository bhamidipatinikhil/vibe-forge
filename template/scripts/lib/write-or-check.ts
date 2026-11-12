// scripts/lib/write-or-check.ts — the shared shape of every generated, committed file (openapi.json, .env.example,
// db/schema.sql, the database types): `--check` compares and fails with a short diff, otherwise the file is written.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

/** How many differing lines to print before truncating. */
const MAX_DIFF_LINES = 40;

/**
 * Lines only in the committed (`-`) or only in the generated (`+`) text.
 * @param committed - What is on disk.
 * @param generated - What the generator produced.
 */
export function diffLines(committed: string, generated: string): string {
	const committedLines = new Set(committed.split("\n"));
	const generatedLines = new Set(generated.split("\n"));
	const removed = [...committedLines]
		.filter((line) => !generatedLines.has(line))
		.map((line) => `- ${line}`);
	const added = [...generatedLines]
		.filter((line) => !committedLines.has(line))
		.map((line) => `+ ${line}`);
	const lines = [...removed, ...added];
	const shown = lines.slice(0, MAX_DIFF_LINES);
	if (lines.length > shown.length) {
		shown.push(`... ${String(lines.length - shown.length)} more`);
	}
	return shown.join("\n");
}

/** Options of {@link writeOrCheck}. */
export interface WriteOrCheckOptions {
	/** The committed file. */
	readonly file: URL;
	/** Its expected content. */
	readonly generated: string;
	/** `true` for `--check`. */
	readonly check: boolean;
	/** Command that regenerates the file, printed on drift. */
	readonly regenerate: string;
	/** Normalizes both sides before comparing (e.g. JSON re-serialization); identity by default. */
	readonly normalize?: (text: string) => string;
}

/**
 * Writes the file, or with `check` verifies it.
 * @param options - File, content, mode and the regenerate hint.
 * @returns The process exit code (1 on drift or a missing file).
 */
export async function writeOrCheck(
	options: WriteOrCheckOptions,
): Promise<number> {
	const name = fileURLToPath(options.file);
	if (!options.check) {
		await writeFile(options.file, options.generated, "utf8");
		process.stdout.write(`wrote ${name}\n`);
		return 0;
	}
	const normalize = options.normalize ?? ((text: string) => text);
	let committed: string;
	try {
		committed = normalize(await readFile(options.file, "utf8"));
	} catch (e: unknown) {
		const reason = e instanceof Error ? e.message : String(e);
		process.stderr.write(
			`${name} is missing or unreadable (${reason})\nRun: ${options.regenerate}\n`,
		);
		return 1;
	}
	const expected = normalize(options.generated);
	if (committed === expected) {
		process.stdout.write(`${name} is up to date\n`);
		return 0;
	}
	process.stderr.write(
		`${name} is out of date:\n${diffLines(committed, expected)}\nRun: ${options.regenerate}\n`,
	);
	return 1;
}

/** `true` when the module at `moduleUrl` is the script node was started with. */
export function invokedDirectly(moduleUrl: string): boolean {
	const entry = process.argv[1];
	return entry !== undefined && fileURLToPath(moduleUrl) === entry;
}
