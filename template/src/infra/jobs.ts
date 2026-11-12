import { PgBoss } from "pg-boss";
import type { Logger } from "pino";
import { z } from "zod";
import type { Database } from "./db.js";
import type { Mailer } from "./email/mailer.js";
import { resetPasswordMessage, verifyEmailMessage } from "./email/templates.js";

/** Queue of account emails; the worker renders and sends them with retries. */
export const SEND_EMAIL_QUEUE = "send-email";
/** Daily cron job deleting expired sessions and verification tokens. */
export const PURGE_EXPIRED_QUEUE = "purge-expired-auth-rows";

/** What an email job carries: the template and its link, never a rendered body. */
export const EmailJobSchema = z.object({
	template: z.enum(["verify-email", "reset-password"]),
	to: z.email(),
	url: z.url(),
});

/** Payload of a {@link SEND_EMAIL_QUEUE} job. */
export type EmailJob = z.infer<typeof EmailJobSchema>;

/** The running job system. */
export interface Jobs {
	/**
	 * Queues an account email (sent by a worker, retried with backoff).
	 * @param job - Template, recipient and link.
	 */
	readonly enqueueEmail: (job: EmailJob) => Promise<void>;
	/** Stops polling and waits for running jobs (graceful, bounded). */
	readonly stop: () => Promise<void>;
}

/** Options of {@link startJobs}. */
export interface JobsOptions {
	/** Postgres URL; pg-boss keeps its tables in the `pgboss` schema it manages itself. */
	readonly databaseUrl: string;
	/** Run workers and cron schedules here (`JOBS_ENABLED`); queuing works either way. */
	readonly runWorkers: boolean;
	/** Query builder for the maintenance jobs. */
	readonly db: Database;
	/** Transport for {@link SEND_EMAIL_QUEUE}. */
	readonly mailer: Mailer;
	/** Logger for job failures. */
	readonly logger: Pick<Logger, "error" | "info">;
}

/**
 * Renders and sends one email job; a delivery failure throws so pg-boss retries it.
 * @param job - The validated payload.
 * @param mailer - Transport.
 */
export async function sendEmailJob(
	job: EmailJob,
	mailer: Mailer,
): Promise<void> {
	const message =
		job.template === "verify-email"
			? await verifyEmailMessage(job.to, job.url)
			: await resetPasswordMessage(job.to, job.url);
	const sent = await mailer.send(message);
	if (sent.isErr()) {
		throw new Error(`${sent.error.transport}: ${sent.error.message}`);
	}
}

/**
 * Deletes expired sessions and verification tokens.
 * @param db - Query builder.
 * @param now - Current time (a parameter so tests control it).
 * @returns How many rows were deleted.
 */
export async function purgeExpiredAuthRows(
	db: Database,
	now: Date,
): Promise<number> {
	const sessions = await db
		.deleteFrom("sessions")
		.where("expires_at", "<", now)
		.executeTakeFirst();
	const verifications = await db
		.deleteFrom("verifications")
		.where("expires_at", "<", now)
		.executeTakeFirst();
	return Number(sessions.numDeletedRows + verifications.numDeletedRows);
}

/**
 * Starts pg-boss (creating or migrating its schema), the queues, and, when
 * `runWorkers` is set, the workers and the daily purge schedule.
 * @param options - Connection, collaborators and the worker switch.
 * @returns The running job system.
 */
export async function startJobs(options: JobsOptions): Promise<Jobs> {
	const boss = new PgBoss({
		connectionString: options.databaseUrl,
		schema: "pgboss",
		max: 2,
	});
	boss.on("error", (error) => {
		options.logger.error({ err: error }, "pg-boss error");
	});
	await boss.start();
	await boss.createQueue(SEND_EMAIL_QUEUE);
	await boss.createQueue(PURGE_EXPIRED_QUEUE);
	if (options.runWorkers) {
		await boss.work<unknown>(SEND_EMAIL_QUEUE, async (batch) => {
			for (const job of batch) {
				await sendEmailJob(EmailJobSchema.parse(job.data), options.mailer);
			}
		});
		await boss.work(PURGE_EXPIRED_QUEUE, async () => {
			const deleted = await purgeExpiredAuthRows(options.db, new Date());
			options.logger.info({ deleted }, "purged expired auth rows");
		});
		await boss.schedule(PURGE_EXPIRED_QUEUE, "17 3 * * *");
	}
	return {
		enqueueEmail: async (job) => {
			await boss.send(SEND_EMAIL_QUEUE, job, {
				retryLimit: 5,
				retryBackoff: true,
			});
		},
		stop: () => boss.stop({ graceful: true, timeout: 10_000 }),
	};
}
