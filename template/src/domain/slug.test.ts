import { test } from "@fast-check/vitest";
import * as fc from "fast-check";
import { ok } from "neverthrow";
import { describe, expect, it } from "vitest";
import { SLUG_PATTERN, slugify } from "./slug.js";

const validSlug = fc
	.array(fc.stringMatching(/^[a-z0-9]{1,8}$/), { minLength: 1, maxLength: 6 })
	.map((parts) => parts.join("-"));

const nonAlphanumeric = fc.string({
	unit: fc.constantFrom(" ", "-", "_", "!", "?", "/", "ß", "日", "\n"),
});

describe("slugify", () => {
	it("folds accents, lowercases and hyphenates", () => {
		expect(slugify("  Crème Brûlée — Recipe #1!  ")).toEqual(
			ok("creme-brulee-recipe-1"),
		);
		expect(slugify("Hello, World!")).toEqual(ok("hello-world"));
		expect(slugify("--already-a-slug--")).toEqual(ok("already-a-slug"));
	});

	it("rejects input without letters or digits", () => {
		const result = slugify("日本語");
		expect(result.isErr()).toBe(true);
		expect(
			result.match(
				() => "ok",
				(error) => error.kind,
			),
		).toBe("empty");
	});

	// Properties return booleans: fast-check reports the shrunk counterexample.
	test.prop([fc.string()])("never returns an invalid slug", (text) => {
		const result = slugify(text);
		return result.isErr() || SLUG_PATTERN.test(result.value);
	});

	test.prop([fc.string()])("is idempotent", (text) => {
		const once = slugify(text);
		return once.isErr() || slugify(once.value).isOk();
	});

	test.prop([fc.string()])(
		"returns the same slug when applied twice",
		(text) => {
			const once = slugify(text);
			return once.match(
				(slug) =>
					slugify(slug).match(
						(again) => again === slug,
						() => false,
					),
				() => true,
			);
		},
	);

	test.prop([validSlug])("keeps valid slugs unchanged", (slug) => {
		return slugify(slug).match(
			(result) => result === slug,
			() => false,
		);
	});

	test.prop([nonAlphanumeric])(
		"fails on empty or symbol-only input",
		(text) => {
			return slugify(text).isErr();
		},
	);
});
