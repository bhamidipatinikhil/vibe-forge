import { err, ok, type Result } from "neverthrow";

/** Shape every slug produced by {@link slugify} satisfies. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Expected failure of {@link slugify}: the input has no slug-able characters. */
export interface SlugError {
	/** Discriminant for exhaustive handling. */
	readonly kind: "empty";
	/** Human-readable explanation, safe to return to clients. */
	readonly message: string;
}

const COMBINING_MARKS = /\p{M}+/gu;
const NON_ALPHANUMERIC_RUNS = /[^a-z0-9]+/g;
const EDGE_HYPHENS = /^-+|-+$/g;

/**
 * Turns free text into a URL slug: folds accents to ASCII, lowercases, and
 * collapses every run of other characters into one hyphen. Idempotent:
 * `slugify(slug)` returns the same slug.
 * @param text - Free text such as a title.
 * @returns `ok(slug)` matching {@link SLUG_PATTERN}, or `err` when nothing remains.
 */
export function slugify(text: string): Result<string, SlugError> {
	const slug = text
		.normalize("NFKD")
		.replace(COMBINING_MARKS, "")
		.toLowerCase()
		.replace(NON_ALPHANUMERIC_RUNS, "-")
		.replace(EDGE_HYPHENS, "");
	if (slug === "") {
		return err({
			kind: "empty",
			message: "text contains no letters or digits",
		});
	}
	return ok(slug);
}
