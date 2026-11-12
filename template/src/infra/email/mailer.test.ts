import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { server } from "../../../tests/setup.msw.js";
import { createMailer, type EmailMessage } from "./mailer.js";
import { resetPasswordMessage, verifyEmailMessage } from "./templates.js";

const message: EmailMessage = {
	to: "ada@example.com",
	subject: "Hi",
	html: "<p>Hi</p>",
	text: "Hi",
};
const logger = { info: vi.fn() };

describe("createMailer", () => {
	it("sends through Resend when an API key is set", async () => {
		let body: unknown;
		server.use(
			http.post("https://api.resend.com/emails", async ({ request }) => {
				body = await request.json();
				return HttpResponse.json({ id: "email_1" });
			}),
		);
		const mailer = createMailer({
			from: "App <noreply@example.com>",
			resendApiKey: "re_test",
			production: true,
			logger,
		});
		expect(mailer._unsafeUnwrap().transport).toBe("resend");
		expect((await mailer._unsafeUnwrap().send(message)).isOk()).toBe(true);
		expect(body).toMatchObject({
			from: "App <noreply@example.com>",
			to: "ada@example.com",
			subject: "Hi",
		});
	});

	it("reports a Resend refusal as a MailError", async () => {
		server.use(
			http.post("https://api.resend.com/emails", () =>
				HttpResponse.json(
					{
						name: "validation_error",
						message: "Invalid `to` field.",
						statusCode: 422,
					},
					{ status: 422 },
				),
			),
		);
		const mailer = createMailer({
			from: "noreply@example.com",
			resendApiKey: "re_test",
			production: true,
			logger,
		});
		const sent = await mailer._unsafeUnwrap().send(message);
		expect(sent._unsafeUnwrapErr()).toEqual({
			transport: "resend",
			message: "Invalid `to` field.",
		});
	});

	it("sends to Mailpit's HTTP API when only MAILPIT_URL is set", async () => {
		let body: unknown;
		server.use(
			http.post("http://127.0.0.1:8025/api/v1/send", async ({ request }) => {
				body = await request.json();
				return HttpResponse.json({ ID: "1" });
			}),
		);
		const mailer = createMailer({
			from: "App <noreply@example.com>",
			mailpitUrl: "http://127.0.0.1:8025",
			production: false,
			logger,
		});
		expect((await mailer._unsafeUnwrap().send(message)).isOk()).toBe(true);
		expect(body).toMatchObject({
			From: { Email: "noreply@example.com", Name: "App" },
			To: [{ Email: "ada@example.com" }],
		});
		server.use(
			http.post(
				"http://127.0.0.1:8025/api/v1/send",
				() => new HttpResponse(null, { status: 500 }),
			),
		);
		const failed = await createMailer({
			from: "noreply@example.com",
			mailpitUrl: "http://127.0.0.1:8025",
			production: false,
			logger,
		})
			._unsafeUnwrap()
			.send(message);
		expect(failed._unsafeUnwrapErr()).toEqual({
			transport: "mailpit",
			message: "HTTP 500",
		});
	});

	it("logs instead of sending outside production, and refuses to start without a transport in production", async () => {
		const mailer = createMailer({
			from: "noreply@example.com",
			production: false,
			logger,
		});
		expect((await mailer._unsafeUnwrap().send(message)).isOk()).toBe(true);
		expect(logger.info).toHaveBeenCalledWith(
			{ to: "ada@example.com", subject: "Hi" },
			expect.any(String),
		);
		expect(
			createMailer({
				from: "noreply@example.com",
				production: true,
				logger,
			})._unsafeUnwrapErr(),
		).toMatch(/RESEND_API_KEY/);
	});
});

describe("account email templates", () => {
	it("renders HTML and text with the link", async () => {
		const verify = await verifyEmailMessage(
			"ada@example.com",
			"https://app.example/verify?token=t",
		);
		expect(verify.subject).toBe("Confirm your email address");
		expect(verify.html).toContain('href="https://app.example/verify?token=t"');
		expect(verify.text).toContain("https://app.example/verify?token=t");
		const reset = await resetPasswordMessage(
			"ada@example.com",
			"https://app.example/reset-password?token=t",
		);
		expect(reset.html).toContain("Reset your password");
	});
});
