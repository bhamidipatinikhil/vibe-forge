import { createFileRoute, Link } from "@tanstack/react-router";
import { type ReactElement, useState } from "react";
import { z } from "zod";
import { AuthForm } from "../components/auth-form";
import { Card } from "../components/ui/card";
import { postAuth } from "../lib/api";
import { m } from "../paraglide/messages.js";

// The link in the password-reset email (src/infra/auth.ts) lands here with ?token=...
export const Route = createFileRoute("/reset-password")({
	validateSearch: z.object({ token: z.string().default("") }),
	head: () => ({ meta: [{ title: `${m.reset_title()} · ${m.site_name()}` }] }),
	component: ResetPassword,
});

const schema = z.object({
	newPassword: z.string().min(8, { error: () => m.error_password_length() }),
});

function ResetPassword(): ReactElement {
	const { token } = Route.useSearch();
	const [done, setDone] = useState(false);
	return (
		<Card className="mx-auto max-w-md">
			<h1 className="mb-4 text-2xl font-semibold">{m.reset_title()}</h1>
			{done ? (
				<p role="status">
					{m.reset_done()}{" "}
					<Link to="/sign-in" className="underline">
						{m.sign_in_title()}
					</Link>
				</p>
			) : (
				<AuthForm
					schema={schema}
					submitLabel={m.reset_title()}
					fields={[
						{
							name: "newPassword",
							label: m.new_password_label(),
							type: "password",
							autoComplete: "new-password",
						},
					]}
					onSubmit={async (values) => {
						await postAuth("/reset-password", { ...values, token });
						setDone(true);
					}}
				/>
			)}
		</Card>
	);
}
