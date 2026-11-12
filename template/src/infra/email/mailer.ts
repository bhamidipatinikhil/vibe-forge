import { err, ok, type Result } from "neverthrow";
import type { Logger } from "pino";
import { Resend } from "resend";

/** One transactional email, already rendered. */
export interface EmailMessage {
	/** Recipient address. */
	readonly to: string;
	/** Subject line. */
	readonly subject: string;
	/** HTML body. */
	readonly html: string;
	/** Plain-text alternative. */
	readonly text: string;
}

/** Expected failure of {@link Mailer.send}: the provider refused or could not be reached. */
export interface MailError {
	/** Which transport failed. */
	readonly transport: Mailer["transport"];
	/** Provider message, safe to log (never contains the body). */
	readonly message: string;
}

/** Sends rendered email through one transport. */
export interface Mailer {
	/** `resend` in production, `mailpit` locally, `log` when neither is configured. */
	readonly transport: "resend" | "mailpit" | "log";
	/**
	 * Delivers one message.
	 * @param message - The rendered email.
	 */
	readonly send: (message: EmailMessage) => Promise<Result<void, MailError>>;
}

/** Options of {@link createMailer}. */
export interface MailerOptions {
	/** Sender, e.g. `App <noreply@example.com>`. */
	readonly from: string;
	/** Resend API key; selects the Resend transport. */
	readonly resendApiKey?: string | undefined;
	/** Mailpit base URL; selects the Mailpit transport when there is no Resend key. */
	readonly mailpitUrl?: string | undefined;
	/** `true` in production, where the log transport is refused. */
	readonly production: boolean;
	/** Logger for the log transport and delivery failures. */
	readonly logger: Pick<Logger, "info">;
}

function resendMailer(apiKey: string, from: string): Mailer {
	const resend = new Resend(apiKey);
	return {
		transport: "resend",
		send: async (message) => {
			const { error } = await resend.emails.send({ from, ...message });
			return error === null
				? ok(undefined)
				: err({ transport: "resend", message: error.message });
		},
	};
}

/** Address part of `Name <address>` (or the whole string when there is no name). */
function address(sender: string): { Email: string; Name?: string } {
	const match = /^(?<name>[^<]*)<(?<email>[^>]+)>$/.exec(sender.trim());
	const email = match?.groups?.["email"];
	const name = match?.groups?.["name"]?.trim();
	if (email === undefined) {
		return { Email: sender.trim() };
	}
	return name === undefined || name === ""
		? { Email: email }
		: { Email: email, Name: name };
}

function mailpitMailer(baseUrl: string, from: string): Mailer {
	const endpoint = new URL("/api/v1/send", baseUrl);
	return {
		transport: "mailpit",
		send: async (message) => {
			const response = await fetch(endpoint, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					From: address(from),
					To: [{ Email: message.to }],
					Subject: message.subject,
					HTML: message.html,
					Text: message.text,
				}),
			});
			return response.ok
				? ok(undefined)
				: err({
						transport: "mailpit",
						message: `HTTP ${String(response.status)}`,
					});
		},
	};
}

function logMailer(logger: Pick<Logger, "info">): Mailer {
	return {
		transport: "log",
		send: (message) => {
			// The recipient and subject only: bodies carry one-time tokens.
			logger.info(
				{ to: message.to, subject: message.subject },
				"email not sent (no RESEND_API_KEY or MAILPIT_URL); logged instead",
			);
			return Promise.resolve(ok(undefined));
		},
	};
}

/**
 * Picks the transport: Resend when an API key is set, otherwise Mailpit when
 * a URL is set, otherwise the log (refused in production, where it would
 * silently drop verification and password-reset mail).
 * @param options - Sender, credentials and environment.
 * @returns The mailer, or an error naming the missing configuration.
 */
export function createMailer(options: MailerOptions): Result<Mailer, string> {
	if (options.resendApiKey !== undefined) {
		return ok(resendMailer(options.resendApiKey, options.from));
	}
	if (options.mailpitUrl !== undefined) {
		return ok(mailpitMailer(options.mailpitUrl, options.from));
	}
	if (options.production) {
		return err("RESEND_API_KEY is required in production");
	}
	return ok(logMailer(options.logger));
}
