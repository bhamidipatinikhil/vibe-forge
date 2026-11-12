import { err, ok } from "neverthrow";
import { afterAll, describe, expect, it, vi } from "vitest";
import { env } from "../env.js";
import { createDatabase } from "./db.js";
import type { EmailMessage, Mailer } from "./email/mailer.js";
import { purgeExpiredAuthRows, sendEmailJob, startJobs } from "./jobs.js";

const db = createDatabase({ url: env.DATABASE_URL, poolMax: 2 });

afterAll(async () => {
	await db.destroy();
});

function recordingMailer(
	fail = false,
): Mailer & { readonly sent: EmailMessage[] } {
	const sent: EmailMessage[] = [];
	return {
		transport: "log",
		sent,
		send: (message) => {
			sent.push(message);
			return Promise.resolve(
				fail
					? err({ transport: "log" as const, message: "down" })
					: ok(undefined),
			);
		},
	};
}

describe("sendEmailJob", () => {
	it("renders the template and sends it; a failed delivery throws so pg-boss retries", async () => {
		const mailer = recordingMailer();
		await sendEmailJob(
			{
				template: "reset-password",
				to: "ada@example.com",
				url: "https://app.example/r?token=t",
			},
			mailer,
		);
		expect(mailer.sent[0]?.subject).toBe("Reset your password");
		await expect(
			sendEmailJob(
				{
					template: "verify-email",
					to: "ada@example.com",
					url: "https://app.example/v",
				},
				recordingMailer(true),
			),
		).rejects.toThrow("log: down");
	});
});

describe("purgeExpiredAuthRows", () => {
	it("deletes expired sessions and verification tokens only", async () => {
		const now = new Date("2027-01-01T00:00:00Z");
		const past = new Date("2026-12-31T00:00:00Z");
		const future = new Date("2027-01-02T00:00:00Z");
		await db
			.insertInto("users")
			.values({ id: "u1", name: "Ada", email: "purge@example.com" })
			.execute();
		await db
			.insertInto("sessions")
			.values([
				{ id: "s1", user_id: "u1", token: "t1", expires_at: past },
				{ id: "s2", user_id: "u1", token: "t2", expires_at: future },
			])
			.execute();
		await db
			.insertInto("verifications")
			.values({ id: "v1", identifier: "x", value: "y", expires_at: past })
			.execute();
		expect(await purgeExpiredAuthRows(db, now)).toBe(2);
		const left = await db.selectFrom("sessions").select("id").execute();
		expect(left).toEqual([{ id: "s2" }]);
	});
});

describe("startJobs", () => {
	it("queues an email and the worker delivers it", async () => {
		const mailer = recordingMailer();
		const logger = { error: vi.fn(), info: vi.fn() };
		const jobs = await startJobs({
			databaseUrl: env.DATABASE_URL,
			runWorkers: true,
			db,
			mailer,
			logger,
		});
		await jobs.enqueueEmail({
			template: "verify-email",
			to: "ada@example.com",
			url: "https://app.example/v",
		});
		await vi.waitFor(
			() => {
				expect(mailer.sent).toHaveLength(1);
			},
			{ timeout: 15_000, interval: 100 },
		);
		await jobs.stop();
		expect(logger.error).not.toHaveBeenCalled();
	});
});
