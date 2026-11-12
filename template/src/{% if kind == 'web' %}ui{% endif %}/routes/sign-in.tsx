import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { z } from "zod";
import { AuthForm } from "../components/auth-form";
import { Card } from "../components/ui/card";
import { postAuth } from "../lib/api";
import { m } from "../paraglide/messages.js";

export const Route = createFileRoute("/sign-in")({
	head: () => ({
		meta: [{ title: `${m.sign_in_title()} · ${m.site_name()}` }],
	}),
	component: SignIn,
});

const schema = z.object({
	email: z.email({ error: () => m.error_email() }),
	password: z.string().min(1, { error: () => m.error_required() }),
});

function SignIn(): ReactElement {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	return (
		<Card className="mx-auto max-w-md">
			<h1 className="mb-4 text-2xl font-semibold">{m.sign_in_title()}</h1>
			<AuthForm
				schema={schema}
				submitLabel={m.sign_in_title()}
				fields={[
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
						autoComplete: "current-password",
					},
				]}
				onSubmit={async (values) => {
					await postAuth("/sign-in/email", values);
					await queryClient.invalidateQueries({ queryKey: ["me"] });
					await navigate({ to: "/account" });
				}}
			/>
			<p className="mt-4 text-sm">
				<Link to="/sign-up" className="underline">
					{m.sign_up_title()}
				</Link>
			</p>
		</Card>
	);
}
