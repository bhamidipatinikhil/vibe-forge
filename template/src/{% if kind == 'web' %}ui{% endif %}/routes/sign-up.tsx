import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { z } from "zod";
import { AuthForm } from "../components/auth-form";
import { Card } from "../components/ui/card";
import { postAuth } from "../lib/api";
import { m } from "../paraglide/messages.js";

export const Route = createFileRoute("/sign-up")({
	head: () => ({
		meta: [{ title: `${m.sign_up_title()} · ${m.site_name()}` }],
	}),
	component: SignUp,
});

const schema = z.object({
	name: z
		.string()
		.trim()
		.min(1, { error: () => m.error_required() }),
	email: z.email({ error: () => m.error_email() }),
	password: z.string().min(8, { error: () => m.error_password_length() }),
});

function SignUp(): ReactElement {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	return (
		<Card className="mx-auto max-w-md">
			<h1 className="mb-4 text-2xl font-semibold">{m.sign_up_title()}</h1>
			<AuthForm
				schema={schema}
				submitLabel={m.sign_up_title()}
				fields={[
					{
						name: "name",
						label: m.name_label(),
						type: "text",
						autoComplete: "name",
					},
					{
						name: "email",
						label: m.email_label(),
						type: "email",
						autoComplete: "email",
					},
					{
						name: "password",
						label: m.password_label(),
						type: "password",
						autoComplete: "new-password",
					},
				]}
				onSubmit={async (values) => {
					await postAuth("/sign-up/email", values);
					await queryClient.invalidateQueries({ queryKey: ["me"] });
					await navigate({ to: "/account" });
				}}
			/>
		</Card>
	);
}
