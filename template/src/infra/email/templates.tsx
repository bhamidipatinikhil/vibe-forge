import { render } from "@react-email/render";
import type { ReactElement } from "react";
import {
	Body,
	Button,
	Container,
	Head,
	Heading,
	Html,
	Preview,
	Text,
} from "react-email";
import type { EmailMessage } from "./mailer.js";

interface ActionEmailProps {
	readonly preview: string;
	readonly heading: string;
	readonly body: string;
	readonly action: string;
	readonly url: string;
}

/** One call-to-action email: the shape of every account email the app sends. */
function ActionEmail(props: ActionEmailProps): ReactElement {
	return (
		<Html lang="en">
			<Head />
			<Preview>{props.preview}</Preview>
			<Body style={{ fontFamily: "system-ui, sans-serif", color: "#111827" }}>
				<Container style={{ maxWidth: "480px", padding: "24px" }}>
					<Heading as="h1" style={{ fontSize: "20px" }}>
						{props.heading}
					</Heading>
					<Text>{props.body}</Text>
					<Button
						href={props.url}
						style={{
							background: "#111827",
							color: "#ffffff",
							padding: "12px 20px",
							borderRadius: "6px",
						}}
					>
						{props.action}
					</Button>
					<Text style={{ fontSize: "12px", color: "#4b5563" }}>
						If you did not ask for this, ignore this email. The link expires
						soon and works once.
					</Text>
				</Container>
			</Body>
		</Html>
	);
}

async function message(
	to: string,
	subject: string,
	props: ActionEmailProps,
): Promise<EmailMessage> {
	const element = <ActionEmail {...props} />;
	const [html, text] = await Promise.all([
		render(element),
		render(element, { plainText: true }),
	]);
	return { to, subject, html, text };
}

/**
 * The "confirm your address" email sent after sign-up.
 * @param to - Recipient.
 * @param url - better-auth's verification link.
 */
export function verifyEmailMessage(
	to: string,
	url: string,
): Promise<EmailMessage> {
	return message(to, "Confirm your email address", {
		preview: "Confirm your email address",
		heading: "Confirm your email address",
		body: "Select the button below to confirm this address for your account.",
		action: "Confirm email",
		url,
	});
}

/**
 * The password-reset email.
 * @param to - Recipient.
 * @param url - Link to the reset form carrying the one-time token.
 */
export function resetPasswordMessage(
	to: string,
	url: string,
): Promise<EmailMessage> {
	return message(to, "Reset your password", {
		preview: "Reset your password",
		heading: "Reset your password",
		body: "Select the button below to choose a new password.",
		action: "Choose a new password",
		url,
	});
}
