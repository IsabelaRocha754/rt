import { eq } from "drizzle-orm";
import type { AppUserDb } from "../../db/client.js";
import { profiles } from "../../db/schema/profiles.js";

export type ProfileRow = typeof profiles.$inferSelect;
export type ProfilePatch = Partial<
  Pick<ProfileRow, "username" | "displayName" | "bio" | "isPrivate" | "locale" | "avatarKey">
>;

// Every call here must run inside `withUserTx` (db/rls.ts) — RLS is the
// only thing stopping `findByUsername` from returning someone else's
// private-and-not-yours row (see the `profiles_select` policy's migration
// comment).
export async function findProfileByUserId(
  db: AppUserDb,
  userId: string,
): Promise<ProfileRow | null> {
  const [row] = await db.select().from(profiles).where(eq(profiles.userId, userId));
  return row ?? null;
}

export async function findProfileByUsername(
  db: AppUserDb,
  username: string,
): Promise<ProfileRow | null> {
  const [row] = await db.select().from(profiles).where(eq(profiles.username, username));
  return row ?? null;
}

export async function updateProfile(
  db: AppUserDb,
  userId: string,
  patch: ProfilePatch,
): Promise<ProfileRow> {
  const [row] = await db.update(profiles).set(patch).where(eq(profiles.userId, userId)).returning();
  if (!row) throw new Error(`No profile row for user ${userId} — should be unreachable.`);
  return row;
}
