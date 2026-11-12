import { createFileRoute, Link } from "@tanstack/react-router";
import { allPosts } from "content-collections";
import type { ReactElement } from "react";
import { m } from "../../paraglide/messages.js";

export const Route = createFileRoute("/blog/")({
	head: () => ({ meta: [{ title: `${m.blog_title()} · ${m.site_name()}` }] }),
	component: BlogIndex,
});

function BlogIndex(): ReactElement {
	const posts = allPosts.toSorted((a, b) => b.date.localeCompare(a.date));
	return (
		<>
			<h1 className="text-3xl font-semibold">{m.blog_title()}</h1>
			<ul className="mt-6 grid gap-4">
				{posts.map((post) => (
					<li key={post.slug}>
						<Link
							to="/blog/$slug"
							params={{ slug: post.slug }}
							className="text-lg font-semibold underline"
						>
							{post.title}
						</Link>
						<p className="text-muted-foreground">{post.summary}</p>
					</li>
				))}
			</ul>
		</>
	);
}
