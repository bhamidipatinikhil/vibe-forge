import { createApp } from "../src/app/app.js";
import { openApiConfig } from "../src/app/openapi.js";
import { invokedDirectly, writeOrCheck } from "./lib/write-or-check.js";

/** Location of the committed document: the project root. */
const OUTPUT_URL = new URL("../openapi.json", import.meta.url);

/** Biome's formatter defaults: 80-column lines with a tab counted as two. */
const LINE_WIDTH = 80;
const TAB_WIDTH = 2;

/** A line holding one scalar JSON array element (with its optional comma). */
const SCALAR_LINE =
	/^\t+(?:"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null),?$/;

/** Index of the line closing a scalar-only array opened at `start`, or -1. */
function scalarArrayEnd(lines: readonly string[], start: number): number {
	for (let index = start + 1; index < lines.length; index += 1) {
		const line = lines[index] ?? "";
		if (/^\t*\],?$/.test(line)) {
			return index;
		}
		if (!SCALAR_LINE.test(line)) {
			return -1;
		}
	}
	return -1;
}

/**
 * Collapses arrays of scalars onto one line when they fit, which is how
 * Biome formats JSON; keeps `biome ci` quiet on the committed document.
 */
function collapseShortArrays(json: string): string {
	const lines = json.split("\n");
	const output: string[] = [];
	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index] ?? "";
		const end = line.endsWith("[") ? scalarArrayEnd(lines, index) : -1;
		if (end === -1) {
			output.push(line);
			continue;
		}
		const items = lines
			.slice(index + 1, end)
			.map((item) => item.trim().replace(/,$/, ""));
		const closing = (lines[end] ?? "").trim();
		const collapsed = `${line}${items.join(", ")}${closing}`;
		const indent = /^\t*/.exec(collapsed)?.[0].length ?? 0;
		const width = indent * (TAB_WIDTH - 1) + collapsed.length;
		if (width > LINE_WIDTH) {
			output.push(line);
			continue;
		}
		output.push(collapsed);
		index = end;
	}
	return output.join("\n");
}

/**
 * Serializes the live OpenAPI 3.1 document as it is committed
 * (tab-indented, trailing newline).
 */
export function renderOpenApiDocument(): string {
	const document = createApp().getOpenAPI31Document(openApiConfig);
	return `${collapseShortArrays(JSON.stringify(document, null, "\t"))}\n`;
}

/** Re-serializes JSON text so formatting differences do not count as drift. */
function canonical(json: string): string {
	return `${JSON.stringify(JSON.parse(json), null, "\t")}\n`;
}

/**
 * CLI entry: `--check` verifies the committed document, otherwise it is
 * (re)written.
 * @param args - Command-line arguments without the runtime and script path.
 * @returns The process exit code.
 */
export function main(args: readonly string[]): Promise<number> {
	return writeOrCheck({
		file: OUTPUT_URL,
		generated: renderOpenApiDocument(),
		check: args.includes("--check"),
		regenerate: "pnpm run openapi",
		normalize: canonical,
	});
}

if (invokedDirectly(import.meta.url)) {
	process.exitCode = await main(process.argv.slice(2));
}
