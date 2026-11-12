// shadcn/ui Input (copied), rendered by Base UI's Input (it wires up Field labels and validity).
import { Input as BaseInput } from "@base-ui/react/input";
import type { ComponentProps, ReactElement } from "react";
import { cn } from "../../lib/utils";

/** A text input. */
export function Input({
	className,
	...props
}: ComponentProps<typeof BaseInput>): ReactElement {
	return (
		<BaseInput
			className={cn(
				"min-h-10 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-invalid:border-destructive",
				typeof className === "string" ? className : undefined,
			)}
			{...props}
		/>
	);
}
