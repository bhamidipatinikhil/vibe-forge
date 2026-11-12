import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { meQuery, postAuth } from "../lib/api";
import { m } from "../paraglide/messages.js";

export const Route = createFileRoute("/account")({
	head: () => ({
		meta: [{ title: `${m.account_title()} · ${m.site_name()}` }],
	}),
	component: Account,
});

function Account(): ReactElement {
	const queryClient = useQueryClient();
	const me = useQuery(meQuery);
	return (
		<Card className="mx-auto max-w-md">
			<h1 className="mb-4 text-2xl font-semibold">{m.account_title()}</h1>
			{me.isPending ? <p aria-live="polite">{m.loading()}</p> : null}
			{me.data === null ? (
				<p>
					{m.not_signed_in()}{" "}
					<Link to="/sign-in" className="underline">
						{m.sign_in_title()}
					</Link>
				</p>
			) : null}
			{me.data === undefined || me.data === null ? null : (
				<>
					<p>{m.signed_in_as({ name: me.data.name, email: me.data.email })}</p>
					<Button
						className="mt-4"
						variant="outline"
						onClick={() => {
							void postAuth("/sign-out", {}).then(() =>
								queryClient.invalidateQueries({ queryKey: ["me"] }),
							);
						}}
					>
						{m.sign_out()}
					</Button>
				</>
			)}
		</Card>
	);
}
