import { expect, test } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { z } from "zod";
import { AuthForm } from "./auth-form";

const schema = z.object({
	email: z.email({ error: "Enter a valid email address." }),
});
const fields = [
	{ name: "email", label: "Email", type: "email", autoComplete: "email" },
] as const;

test("validates on submit, shows the field error, then submits valid values", async () => {
	const submitted: Record<string, string>[] = [];
	await render(
		<AuthForm
			schema={schema}
			fields={fields}
			submitLabel="Continue"
			onSubmit={(values) => {
				submitted.push(values);
				return Promise.resolve();
			}}
		/>,
	);
	await page.getByRole("button", { name: "Continue" }).click();
	await expect
		.element(page.getByText("Enter a valid email address."))
		.toBeVisible();
	expect(submitted).toEqual([]);
	await page.getByLabelText("Email").fill("ada@example.com");
	await page.getByRole("button", { name: "Continue" }).click();
	await expect.poll(() => submitted).toEqual([{ email: "ada@example.com" }]);
});

test("announces a failed submission in the alert region", async () => {
	await render(
		<AuthForm
			schema={schema}
			fields={fields}
			submitLabel="Continue"
			onSubmit={() => Promise.reject(new Error("Invalid email or password"))}
		/>,
	);
	await page.getByLabelText("Email").fill("ada@example.com");
	await page.getByRole("button", { name: "Continue" }).click();
	await expect
		.element(page.getByRole("alert"))
		.toHaveTextContent("Invalid email or password");
});
