// shadcn/ui Button (copied, not installed: this file is yours to edit), rendered by Base UI's Button.
import { Button as BaseButton } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps, ReactElement } from "react";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
	"inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50",
	{
		variants: {
			variant: {
				default: "bg-primary text-primary-foreground hover:bg-primary/90",
				outline: "border bg-background hover:bg-muted",
				ghost: "hover:bg-muted",
			},
		},
		defaultVariants: { variant: "default" },
	},
);

/** Props of {@link Button}: Base UI's button props plus a visual variant. */
export type ButtonProps = ComponentProps<typeof BaseButton> &
	VariantProps<typeof buttonVariants>;

/** A button; `variant` picks default, outline or ghost styling. */
export function Button({
	className,
	variant,
	...props
}: ButtonProps): ReactElement {
	return (
		<BaseButton
			className={cn(
				buttonVariants({ variant }),
				typeof className === "string" ? className : undefined,
			)}
			{...props}
		/>
	);
}
