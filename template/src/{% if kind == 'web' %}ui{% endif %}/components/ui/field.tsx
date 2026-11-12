// shadcn/ui-style form field on Base UI's Field: the label, control and error message are associated
// automatically (htmlFor, aria-describedby, aria-invalid), which axe and screen readers check.
import { Field as BaseField } from "@base-ui/react/field";
import type { ReactElement, ReactNode } from "react";
import { Input } from "./input";

/** Props of {@link TextField}. */
export interface TextFieldProps {
	/** Visible label. */
	readonly label: string;
	/** Input name (also the form field name). */
	readonly name: string;
	/** Input type. */
	readonly type?: "text" | "email" | "password";
	/** Browser autofill hint. */
	readonly autoComplete?: string;
	/** Current value. */
	readonly value: string;
	/** Called with the new value on every change. */
	readonly onChange: (value: string) => void;
	/** Called when the input loses focus. */
	readonly onBlur?: () => void;
	/** Validation message; set makes the field invalid. */
	readonly error?: string | undefined;
	/** Optional help text below the input. */
	readonly description?: ReactNode;
}

/** A labelled text input with its validation message. */
export function TextField(props: TextFieldProps): ReactElement {
	const invalid = props.error !== undefined && props.error !== "";
	return (
		<BaseField.Root
			name={props.name}
			invalid={invalid}
			className="grid gap-1.5"
		>
			<BaseField.Label className="text-sm font-semibold">
				{props.label}
			</BaseField.Label>
			<Input
				type={props.type ?? "text"}
				autoComplete={props.autoComplete}
				value={props.value}
				onValueChange={(value) => {
					props.onChange(value);
				}}
				onBlur={props.onBlur}
			/>
			{props.description === undefined ? null : (
				<BaseField.Description className="text-sm text-muted-foreground">
					{props.description}
				</BaseField.Description>
			)}
			{invalid ? (
				<BaseField.Error match={true} className="text-sm text-destructive">
					{props.error}
				</BaseField.Error>
			) : null}
		</BaseField.Root>
	);
}
