import type { Thing, WithContext } from "schema-dts";

/**
 * A JSON-LD `<script type="application/ld+json">` for a route's `head().scripts`
 * (structured data for search engines). `<` is escaped so the payload can never
 * close the script element. Data blocks are not executed, so the CSP is unaffected.
 * @param data - A schema.org object, typed by schema-dts.
 * @returns The head script entry.
 */
export function jsonLdScript<T extends Thing>(
	data: WithContext<T>,
): { type: string; children: string } {
	return {
		type: "application/ld+json",
		children: JSON.stringify(data).replaceAll("<", "\\u003c"),
	};
}
