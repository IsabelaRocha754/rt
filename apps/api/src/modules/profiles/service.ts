import type { AppUserDb } from "../../db/client.js";
import { withUserTx } from "../../db/rls.js";
import * as repo from "./repo.js";
import type { ProfilePatch, ProfileRow } from "./repo.js";

export class UsernameTakenError extends Error {}

// Postgres unique_violation (23505). Drizzle wraps the driver's error in
// its own `DrizzleQueryError`, with the raw `pg` error (the one that
// actually carries `.code`) on `.cause` — check both, since which layer
// carries it isn't guaranteed to stay the same across versions.
function isUniqueViolation(error: unknown): boolean {
  const typed = error as { code?: unknown; cause?: { code?: unknown } } | null | undefined;
  return typed?.code === "23505" || typed?.cause?.code === "23505";
}

export function getOwnProfile(db: AppUserDb, userId: string): Promise<ProfileRow | null> {
  return withUserTx(db, userId, (tx) => repo.findProfileByUserId(tx, userId));
}

export async function updateOwnProfile(
  db: AppUserDb,
  userId: string,
  patch: ProfilePatch,
): Promise<ProfileRow> {
  return withUserTx(db, userId, async (tx) => {
    try {
      return await repo.updateProfile(tx, userId, patch);
    } catch (error) {
      if (isUniqueViolation(error)) throw new UsernameTakenError();
      throw error;
    }
  });
}

export type PublicProfileView =
  { kind: "full"; profile: ProfileRow } | { kind: "private"; profile: ProfileRow };

// TRD §5 `canView`, simplified for Phase 1: there's no `follows` table yet
// (Phase 4), so a private account's "follower" branch can never be true —
// a non-owner always gets the `private` (teaser) view until that lands.
// RLS (migration 0002) already hides suspended/nonexistent rows entirely —
// `null` here means "404", not "private".
export async function getPublicProfile(
  db: AppUserDb,
  viewerId: string,
  username: string,
): Promise<PublicProfileView | null> {
  const target = await withUserTx(db, viewerId, (tx) =>
    repo.findProfileByUsername(tx, username.toLowerCase()),
  );
  if (!target) return null;

  if (target.userId === viewerId || !target.isPrivate) {
    return { kind: "full", profile: target };
  }
  return { kind: "private", profile: target };
}
