import { afterAll, describe, expect, it } from "vitest";
import { env } from "../env.js";
import { createDatabase, databaseReachable } from "./db.js";

const db = createDatabase({ url: env.DATABASE_URL, poolMax: 1 });

afterAll(async () => {
	await db.destroy();
});

describe("createDatabase", () => {
	it("reaches the migrated database and sees its tables", async () => {
		expect(await databaseReachable(db)).toBe(true);
		const users = await db
			.selectFrom("users")
			.select(({ fn }) => fn.countAll<number>().as("count"))
			.executeTakeFirst();
		expect(Number(users?.count)).toBe(0);
	});

	it("fails the probe when the database is unreachable", async () => {
		const down = createDatabase({
			url: "postgres://postgres@127.0.0.1:1/none",
			poolMax: 1,
		});
		await expect(databaseReachable(down)).rejects.toThrow();
		await down.destroy();
	});
});
