import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAppUserDb, createOwnerDb } from "../../src/db/client.js";
import { withUserTx } from "../../src/db/rls.js";
import { user } from "../../src/db/schema/auth.js";
import { profiles } from "../../src/db/schema/profiles.js";

// Exercises the profiles RLS policies directly against Postgres (migration
// 0002), independent of the HTTP layer — SECURITY.md "Enable row-level
// security": a test connects as app_user and asserts what it can and
// can't read/write.
describe("profiles row-level security", () => {
  const databaseUrl =
    process.env.DATABASE_URL ?? "postgres://app_user:changeme@localhost:5432/plate";
  const databaseUrlOwner =
    process.env.DATABASE_URL_OWNER ?? "postgres://app_owner:changeme@localhost:5432/plate";
  const ownerDb = createOwnerDb(databaseUrlOwner);
  const appDb = createAppUserDb(databaseUrl);

  let activeUserId: string;
  let suspendedUserId: string;

  beforeAll(async () => {
    // Seed two auth users (FK target) and their profiles directly as
    // app_owner, bypassing the app entirely — this test is about the DB
    // policies, not the signup flow.
    const [activeUser] = await ownerDb
      .insert(user)
      .values({ name: "RLS Active", email: `rls-active-${Date.now()}@example.com` })
      .returning();
    const [suspendedUser] = await ownerDb
      .insert(user)
      .values({ name: "RLS Suspended", email: `rls-suspended-${Date.now()}@example.com` })
      .returning();
    activeUserId = activeUser!.id;
    suspendedUserId = suspendedUser!.id;

    await ownerDb.insert(profiles).values({ userId: activeUserId });
    await ownerDb.insert(profiles).values({ userId: suspendedUserId, status: "suspended" });
  });

  afterAll(async () => {
    await ownerDb.$client.end();
    await appDb.$client.end();
  });

  it("without app.user_id set, sees active profiles but not a suspended one", async () => {
    const rows = await appDb
      .select({ userId: profiles.userId })
      .from(profiles)
      .where(sql`${profiles.userId} in (${activeUserId}, ${suspendedUserId})`);
    const ids = rows.map((row) => row.userId);
    expect(ids).toContain(activeUserId);
    expect(ids).not.toContain(suspendedUserId);
  });

  it("without app.user_id set, cannot update any profile", async () => {
    const result = await appDb
      .update(profiles)
      .set({ displayName: "Should not stick" })
      .where(sql`${profiles.userId} = ${activeUserId}`)
      .returning();
    expect(result).toHaveLength(0);
  });

  it("a signed-in user cannot update someone else's profile", async () => {
    const result = await withUserTx(appDb, suspendedUserId, (tx) =>
      tx
        .update(profiles)
        .set({ displayName: "IDOR attempt" })
        .where(sql`${profiles.userId} = ${activeUserId}`)
        .returning(),
    );
    expect(result).toHaveLength(0);
  });

  it("a signed-in user can update their own profile", async () => {
    const result = await withUserTx(appDb, activeUserId, (tx) =>
      tx
        .update(profiles)
        .set({ displayName: "Self update" })
        .where(sql`${profiles.userId} = ${activeUserId}`)
        .returning(),
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.displayName).toBe("Self update");
  });

  it("a suspended user can still read their own profile", async () => {
    const rows = await withUserTx(appDb, suspendedUserId, (tx) =>
      tx
        .select()
        .from(profiles)
        .where(sql`${profiles.userId} = ${suspendedUserId}`),
    );
    expect(rows).toHaveLength(1);
  });
});
