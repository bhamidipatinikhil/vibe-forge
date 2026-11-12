// Deliberately inaccessible and hook-breaking; linted by tests/lint/jsx-a11y.test.ts with ignores off.
import { type ReactElement, useState } from "react";

export function Broken(props: { readonly on: boolean; readonly onSelect: () => void }): ReactElement {
	if (props.on) {
		useState(0);
	}
	return (
		<div onClick={props.onSelect}>
			<img src="/logo.png" />
			<a href="#">more</a>
		</div>
	);
}
