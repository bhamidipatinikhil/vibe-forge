#!/usr/bin/env node
// sync-tasks.mjs — read every plans/**/*.md, extract the task list ("- [ ] T001 ..." lines with
// optional "dep: T001,T002" suffixes), and print a dependency-ordered queue. Cycles are errors.
// With --bd (and the bd CLI installed) the same tasks are mirrored into Beads; without it, the
// script skips cleanly — markdown stays the canonical store either way.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const useBd = process.argv.includes("--bd");
const plansDir = join(process.cwd(), "plans");
if (!existsSync(plansDir)) {
	console.log("sync-tasks: no plans/ directory yet");
	process.exit(0);
}

const files = [];
const walk = (dir) => {
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, e.name);
		if (e.isDirectory()) walk(p);
		else if (e.name.endsWith(".md")) files.push(p);
	}
};
walk(plansDir);

const tasks = new Map();
for (const file of files) {
	const text = readFileSync(file, "utf8");
	for (const m of text.matchAll(/^- \[([ xX])\] (T\d+):?(.*)$/gm)) {
		const [, done, id, rest] = m;
		const deps = [
			...rest.matchAll(/(?:dep|depends)[: ]+((?:T\d+)(?:\s*,\s*T\d+)*)/gi),
		].flatMap((d) => d[1].split(/\s*,\s*/));
		tasks.set(id, {
			id,
			done: done !== " ",
			deps,
			file: file.replace(`${process.cwd()}/`, ""),
		});
	}
}

if (tasks.size === 0) {
	console.log(
		"sync-tasks: no tasks found under plans/ (expected '- [ ] T001: title' lines)",
	);
	process.exit(0);
}

// Kahn topological order; cycles are reported, not silently dropped.
const open = [...tasks.values()].filter((t) => !t.done);
const ordered = [];
const state = new Map();
const visit = (t) => {
	if (state.get(t.id) === "done") return;
	if (state.get(t.id) === "visiting") {
		console.error(`sync-tasks: dependency cycle involving ${t.id}`);
		process.exit(1);
	}
	state.set(t.id, "visiting");
	for (const dep of t.deps) {
		const d = tasks.get(dep);
		if (d && !d.done) visit(d);
	}
	state.set(t.id, "done");
	ordered.push(t);
};
for (const t of open) visit(t);

console.log(
	`sync-tasks: ${open.length} open of ${tasks.size} tasks (dependency order; the first with no open deps is ready)`,
);
for (const [i, t] of ordered.entries()) {
	const deps = t.deps.length ? `, dep: ${t.deps.join(",")}` : "";
	console.log(`  ${i + 1}. ${t.id}${deps} (${t.file})`);
}

if (!useBd) process.exit(0);
// Optional mirror into Beads: only when --bd was passed and the bd CLI is available.
const bd = existsSync(join(process.cwd(), "node_modules", ".bin", "bd"))
	? "node_modules/.bin/bd"
	: "bd";
let hasBd = true;
try {
	execFileSync(bd, ["--version"], { stdio: "ignore" });
} catch {
	hasBd = false;
}
if (!hasBd) {
	console.log(
		"sync-tasks: bd not installed; markdown remains the canonical store (npm i -g @beads/bd to enable)",
	);
	process.exit(0);
}
for (const t of ordered) {
	try {
		execFileSync(bd, ["create", t.id, "--title", t.id, "--quiet"], {
			stdio: "ignore",
		});
	} catch {
		/* already exists */
	}
	for (const dep of t.deps) {
		if (tasks.has(dep)) {
			try {
				execFileSync(bd, ["dep", "add", t.id, dep], { stdio: "ignore" });
			} catch {
				/* already wired */
			}
		}
	}
}
console.log("sync-tasks: mirrored to bd");
