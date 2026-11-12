#!/usr/bin/env node
// offload-context.mjs — read stdin; when it is large, write it to .scratch/context-dumps/ and print a
// compact summary plus the file path instead. Small outputs pass through unchanged.
// Usage: <verbose command> 2>&1 | node scripts/offload-context.mjs [label]
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const MAX_LINES = 100;
const MAX_BYTES = 5 * 1024;
const label =
	(process.argv[2] ?? "output").replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 60) ||
	"output";
const input = await new Promise((resolve) => {
	let data = "";
	process.stdin.setEncoding("utf8");
	process.stdin.on("data", (chunk) => (data += chunk));
	process.stdin.on("end", () => resolve(data));
});
const lines = input.split("\n");
if (lines.length <= MAX_LINES && Buffer.byteLength(input) <= MAX_BYTES) {
	process.stdout.write(input);
	process.exit(0);
}
const dir = join(process.cwd(), ".scratch", "context-dumps");
mkdirSync(dir, { recursive: true });
const file = join(
	dir,
	`${label}-${new Date().toISOString().replace(/[:.]/g, "-")}.log`,
);
writeFileSync(file, input);
const head = lines.slice(0, 5).join("\n");
const tail = lines.slice(-10).join("\n");
process.stdout.write(
	`[offloaded ${lines.length} lines / ${Buffer.byteLength(input)} bytes -> ${file}\n` +
		`--- first lines ---\n${head}\n--- last lines ---\n${tail}\n]`,
);
