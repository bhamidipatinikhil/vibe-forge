// shadcn/ui Card (copied): plain markup, no behaviour.
import type { ComponentProps, ReactElement } from "react";
import { cn } from "../../lib/utils";

/** A bordered surface grouping related content. */
export function Card({
	className,
	...props
}: ComponentProps<"section">): ReactElement {
	return (
		<section
			className={cn("rounded-md border p-6 shadow-sm", className)}
			{...props}
		/>
	);
}
