import { createFileRoute, notFound } from "@tanstack/react-router";
import { allPosts } from "content-collections";
import type { MDXContent } from "mdx/types";
import type { ReactElement } from "react";
import type { BlogPosting } from "schema-dts";
import { jsonLdScript } from "../../seo/json-ld";

// MDX bodies are compiled at build time by @mdx-js/rollup (vite.config.ts); content-collections supplies the
// frontmatter. Imported eagerly, so every post ships in this route's chunk (fine for a blog; switch to a lazy glob
// with one module-level component per post if the posts grow large). Keys look like "/content/posts/hello-world.mdx".
const bodies = import.meta.glob<MDXContent>("/content/posts/*.mdx", {
	eager: true,
	import: "default",
});

export const Route = createFileRoute("/blog/$slug")({
	loader: ({ params }) => {
		const post = allPosts.find((candidate) => candidate.slug === params.slug);
		if (post === undefined) {
			throw notFound();
		}
		return post;
	},
	head: ({ loaderData }) =>
		loaderData === undefined
			? {}
			: {
					meta: [
						{ title: loaderData.title },
						{ name: "description", content: loaderData.summary },
						{ property: "og:title", content: loaderData.title },
						{
							property: "og:image",
							content: `/api/v1/og?title=${encodeURIComponent(loaderData.title)}`,
						},
					],
					scripts: [
						jsonLdScript<BlogPosting>({
							"@context": "https://schema.org",
							"@type": "BlogPosting",
							headline: loaderData.title,
							datePublished: loaderData.date,
							description: loaderData.summary,
						}),
					],
				},
	component: PostPage,
});

function PostPage(): ReactElement {
	const post = Route.useLoaderData();
	const Body = bodies[`/content/posts/${post.slug}.mdx`];
	return (
		<article className="grid gap-4 [&_a]:underline [&_h2]:text-xl [&_h2]:font-semibold">
			<h1 className="text-3xl font-semibold">{post.title}</h1>
			<p className="text-muted-foreground">
				<time dateTime={post.date}>{post.date}</time>
			</p>
			{Body === undefined ? null : <Body />}
		</article>
	);
}
