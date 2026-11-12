import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, UserPlus } from "lucide-react";
import type { ReactElement } from "react";
import type { WebSite } from "schema-dts";
import { m } from "../paraglide/messages.js";
import { jsonLdScript } from "../seo/json-ld";

export const Route = createFileRoute("/")({
	head: () => ({
		meta: [
			{ title: m.site_name() },
			{ property: "og:title", content: m.site_name() },
			{
				property: "og:image",
				content: `/api/v1/og?title=${encodeURIComponent(m.site_name())}`,
			},
		],
		scripts: [
			jsonLdScript<WebSite>({
				"@context": "https://schema.org",
				"@type": "WebSite",
				name: m.site_name(),
			}),
		],
	}),
	component: Home,
});

function Home(): ReactElement {
	return (
		<>
			<h1 className="text-3xl font-semibold">{m.home_title()}</h1>
			<p className="mt-3 text-muted-foreground">{m.home_lead()}</p>
			<ul className="mt-6 flex flex-wrap gap-3">
				<li>
					<Link
						to="/sign-up"
						className="inline-flex min-h-10 items-center gap-2 rounded-md border px-4"
					>
						<UserPlus aria-hidden="true" size={18} />
						{m.sign_up_title()}
					</Link>
				</li>
				<li>
					<Link
						to="/blog"
						className="inline-flex min-h-10 items-center gap-2 rounded-md border px-4"
					>
						<BookOpen aria-hidden="true" size={18} />
						{m.nav_blog()}
					</Link>
				</li>
			</ul>
		</>
	);
}
