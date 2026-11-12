import { expect, test } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { LocaleSwitcher } from "./locale-switcher";

test("shows the current language, lists every locale and reports the choice", async () => {
	const chosen: string[] = [];
	await render(
		<LocaleSwitcher
			onChange={(locale) => {
				chosen.push(locale);
			}}
		/>,
	);
	const trigger = page.getByRole("button", { name: /English/ });
	await expect.element(trigger).toBeVisible();
	await trigger.click();
	await expect
		.element(page.getByRole("option", { name: "English" }))
		.toBeVisible();
	await page.getByRole("option", { name: "Deutsch" }).click();
	expect(chosen).toEqual(["de"]);
});
