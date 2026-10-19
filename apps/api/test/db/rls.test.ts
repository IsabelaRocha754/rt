import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createAppUserDb } from "../../src/db/client.js";
import { withUserTx } from "../../src/db/rls.js";

// Requires the compose (or CI service-container) Postgres to be up with the
// app_user role from docker/postgres/init-roles.sql + migration 0000 applied.
const databaseUrl = process.env.DATABASE_URL ?? "postgres://app_user:changeme@localhost:5432/plate";

describe("withUserTx", () => {
  const db = createAppUserDb(databaseUrl);
  afterAll(async () => {
    await db.$client.end();
  });

  it("sets app.user_id for the duration of the transaction", async () => {
    const userId = "00000000-0000-0000-0000-000000000000";

    const result = await withUserTx(db, userId, async (tx) => {
      const rows = await tx.execute(sql`select current_setting('app.user_id', true) as value`);
      return rows.rows[0]?.value;
    });

    expect(result).toBe(userId);
  });

  it("does not leak app.user_id outside the transaction", async () => {
    const rows = await db.execute(sql`select current_setting('app.user_id', true) as value`);
    expect(rows.rows[0]?.value).toBe("");
  });
});
