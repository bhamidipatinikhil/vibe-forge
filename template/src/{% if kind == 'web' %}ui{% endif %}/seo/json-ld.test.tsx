import type { WebSite } from "schema-dts";
import { expect, test } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { Card } from "../components/ui/card";
import { clientSchema } from "../env.schema";
import { jsonLdScript } from "./json-ld";

test("jsonLdScript serializes schema.org data and cannot close its script element", () => {
	const script = jsonLdScript<WebSite>({
		"@context": "https://schema.org",
		"@type": "WebSite",
		name: "</script><x>",
	});
	expect(script.type).toBe("application/ld+json");
	expect(script.children).not.toContain("</script>");
	expect(JSON.parse(script.children)).toMatchObject({
		"@type": "WebSite",
		name: "</script><x>",
	});
});

test("Card renders a labelled section", async () => {
	await render(<Card aria-label="Profile">content</Card>);
	await expect
		.element(page.getByRole("region", { name: "Profile" }))
		.toHaveTextContent("content");
});

test("the browser env schema accepts an empty configuration", () => {
	expect(clientSchema.VITE_SENTRY_DSN.safeParse(undefined).success).toBe(true);
	expect(
		clientSchema.VITE_UMAMI_SCRIPT_URL.safeParse("not a url").success,
	).toBe(false);
});
