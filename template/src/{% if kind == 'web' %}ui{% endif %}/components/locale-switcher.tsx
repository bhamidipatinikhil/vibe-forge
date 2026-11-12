// The language picker: a real listbox (keyboard, typeahead, screen-reader semantics) is a "hard widget", so it uses
// react-aria-components rather than a hand-rolled <select> replacement.
import type { ReactElement } from "react";
import {
	Button,
	Label,
	ListBox,
	ListBoxItem,
	Popover,
	Select,
	SelectValue,
} from "react-aria-components";
import { m } from "../paraglide/messages.js";
import {
	getLocale,
	isLocale,
	type Locale,
	locales,
	setLocale,
} from "../paraglide/runtime.js";

/** Each locale's name in its own language. */
const LOCALE_NAMES: Readonly<Record<Locale, string>> = {
	en: "English",
	de: "Deutsch",
};

/** Props of {@link LocaleSwitcher}. */
export interface LocaleSwitcherProps {
	/** Called with the chosen locale; by default Paraglide stores it in a cookie and reloads the page. */
	readonly onChange?: (locale: Locale) => void;
}

/** Switches the UI language. */
export function LocaleSwitcher(props: LocaleSwitcherProps): ReactElement {
	const change =
		props.onChange ??
		((locale: Locale) => {
			void setLocale(locale);
		});
	return (
		<Select
			className="flex items-center gap-2"
			value={getLocale()}
			onChange={(key) => {
				if (typeof key === "string" && isLocale(key)) {
					change(key);
				}
			}}
		>
			<Label className="sr-only">{m.language_label()}</Label>
			<Button className="min-h-10 rounded-md border px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring">
				<SelectValue />
			</Button>
			<Popover className="rounded-md border bg-background shadow-md">
				<ListBox className="p-1 outline-none">
					{locales.map((locale) => (
						<ListBoxItem
							key={locale}
							id={locale}
							className="min-h-10 cursor-default rounded px-3 py-2 text-sm outline-none data-[focused]:bg-muted"
						>
							{LOCALE_NAMES[locale]}
						</ListBoxItem>
					))}
				</ListBox>
			</Popover>
		</Select>
	);
}
