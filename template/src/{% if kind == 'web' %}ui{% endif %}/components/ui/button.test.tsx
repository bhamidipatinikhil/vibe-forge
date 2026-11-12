import { expect, test } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { Button } from "./button";

test("renders an accessible button that reports clicks and supports variants", async () => {
	let clicks = 0;
	await render(
		<Button
			variant="outline"
			onClick={() => {
				clicks += 1;
			}}
		>
			Save
		</Button>,
	);
	const button = page.getByRole("button", { name: "Save" });
	await button.click();
	expect(clicks).toBe(1);
	await expect.element(button).toHaveClass(/border/);
});
