import { CSPProvider } from "@base-ui/react/csp-provider";
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Link,
	Outlet,
	Scripts,
	useRouter,
} from "@tanstack/react-router";
import type { ReactElement, ReactNode } from "react";
import { LocaleSwitcher } from "../components/locale-switcher";
import { m } from "../paraglide/messages.js";
import { getLocale } from "../paraglide/runtime.js";
import { clientEnv } from "../public-env";
import appCss from "../styles/app.css?url";

const umami =
	clientEnv.VITE_UMAMI_SCRIPT_URL === undefined ||
	clientEnv.VITE_UMAMI_WEBSITE_ID === undefined
		? []
		: [
				{
					src: clientEnv.VITE_UMAMI_SCRIPT_URL,
					defer: true,
					"data-website-id": clientEnv.VITE_UMAMI_WEBSITE_ID,
				},
			];

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
	{
		head: () => ({
			meta: [
				{ charSet: "utf-8" },
				{ name: "viewport", content: "width=device-width, initial-scale=1" },
				{ title: m.site_name() },
				{ name: "description", content: m.site_description() },
				{ property: "og:site_name", content: m.site_name() },
			],
			links: [
				{ rel: "stylesheet", href: appCss },
				{ rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
			],
			scripts: umami,
		}),
		component: RootComponent,
		notFoundComponent: NotFound,
	},
);

function NavLink(props: {
	readonly to: string;
	readonly children: ReactNode;
}): ReactElement {
	return (
		<Link
			to={props.to}
			className="inline-flex min-h-10 items-center rounded-md px-2 hover:bg-muted"
			activeProps={{ "aria-current": "page", className: "font-semibold" }}
		>
			{props.children}
		</Link>
	);
}

function RootComponent(): ReactElement {
	const { queryClient } = Route.useRouteContext();
	const nonce = useRouter().options.ssr?.nonce;
	return (
		<html lang={getLocale()}>
			<head>
				<HeadContent />
			</head>
			<body>
				<CSPProvider nonce={nonce}>
					<QueryClientProvider client={queryClient}>
						<a href="#main" className="sr-only focus:not-sr-only">
							{m.skip_to_content()}
						</a>
						<header className="mx-auto flex max-w-3xl items-center justify-between gap-4 p-4">
							<nav aria-label={m.nav_label()} className="flex gap-2">
								<NavLink to="/">{m.nav_home()}</NavLink>
								<NavLink to="/blog">{m.nav_blog()}</NavLink>
								<NavLink to="/account">{m.nav_account()}</NavLink>
							</nav>
							<LocaleSwitcher />
						</header>
						<main id="main" className="mx-auto max-w-3xl p-4">
							<Outlet />
						</main>
					</QueryClientProvider>
				</CSPProvider>
				<Scripts />
			</body>
		</html>
	);
}

function NotFound(): ReactElement {
	return (
		<>
			<h1 className="text-2xl font-semibold">{m.not_found_title()}</h1>
			<p className="mt-2">
				<Link to="/" className="underline">
					{m.nav_home()}
				</Link>
			</p>
		</>
	);
}
