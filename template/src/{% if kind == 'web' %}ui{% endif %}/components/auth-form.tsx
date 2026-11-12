// One form component for every account page (sign-in, sign-up, password reset): TanStack Form with a Zod schema
// (validated on submit, then on every change) and the submit outcome announced in an alert region.
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { type ReactElement, useState } from "react";
import type { z } from "zod";
import { Button } from "./ui/button";
import { TextField } from "./ui/field";

/** One input of an {@link AuthForm}. */
export interface AuthField {
	/** Field name; also the key in the submitted values. */
	readonly name: string;
	/** Visible label. */
	readonly label: string;
	/** Input type. */
	readonly type: "text" | "email" | "password";
	/** Browser autofill hint (`email`, `current-password`, `new-password`, `name`). */
	readonly autoComplete: string;
}

/** Props of {@link AuthForm}. */
export interface AuthFormProps {
	/** Inputs, in order. */
	readonly fields: readonly AuthField[];
	/** Validates the values (shape: one string per field). */
	readonly schema: z.ZodType<Record<string, string>, Record<string, string>>;
	/** Text of the submit button. */
	readonly submitLabel: string;
	/** Sends the values; a thrown Error's message is shown to the user. */
	readonly onSubmit: (values: Record<string, string>) => Promise<void>;
}

function firstMessage(errors: readonly unknown[]): string | undefined {
	for (const error of errors) {
		if (typeof error === "string") {
			return error;
		}
		if (
			typeof error === "object" &&
			error !== null &&
			"message" in error &&
			typeof error.message === "string"
		) {
			return error.message;
		}
	}
	return undefined;
}

/** A validated form whose submit failures are announced to assistive technology. */
export function AuthForm(props: AuthFormProps): ReactElement {
	const [failure, setFailure] = useState<string | undefined>(undefined);
	const form = useForm({
		defaultValues: Object.fromEntries(
			props.fields.map((field) => [field.name, ""]),
		),
		// Validate on submit; after the first attempt, re-validate on every change so a fixed field clears its error.
		validationLogic: revalidateLogic(),
		validators: { onDynamic: props.schema },
		onSubmit: async ({ value }) => {
			setFailure(undefined);
			try {
				await props.onSubmit(value);
			} catch (e: unknown) {
				setFailure(e instanceof Error ? e.message : String(e));
			}
		},
	});
	return (
		<form
			noValidate
			className="grid gap-4"
			onSubmit={(event) => {
				event.preventDefault();
				void form.handleSubmit();
			}}
		>
			{props.fields.map((spec) => (
				<form.Field key={spec.name} name={spec.name}>
					{(field) => (
						<TextField
							label={spec.label}
							name={spec.name}
							type={spec.type}
							autoComplete={spec.autoComplete}
							value={field.state.value}
							onChange={field.handleChange}
							onBlur={field.handleBlur}
							error={firstMessage(field.state.meta.errors)}
						/>
					)}
				</form.Field>
			))}
			<p role="alert" className="min-h-5 text-sm text-destructive">
				{failure}
			</p>
			<form.Subscribe selector={(state) => state.isSubmitting}>
				{(submitting) => (
					<Button type="submit" disabled={submitting}>
						{props.submitLabel}
					</Button>
				)}
			</form.Subscribe>
		</form>
	);
}
