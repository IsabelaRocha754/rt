import { uuidv7 } from "uuidv7";
import type { S3Client } from "@aws-sdk/client-s3";
import type { AppUserDb } from "../../db/client.js";
import { withUserTx } from "../../db/rls.js";
import { deleteObject, getObjectBytes, putObjectBytes } from "../../storage/s3.js";
import { detectImageType, InvalidImageError, processImage } from "../../photos/pipeline.js";
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

// DEV_PLAN Phase 1 F1 "18+ and terms acceptance stored with version" — a
// dedicated action rather than a general PATCH /me field, since it only
// ever moves forward (there's no "un-confirm you're 18") and is meant to
// be called again on its own when `termsVersion` changes later.
export function acceptTerms(
  db: AppUserDb,
  userId: string,
  termsVersion: string,
): Promise<ProfileRow> {
  const now = new Date();
  return withUserTx(db, userId, (tx) =>
    repo.updateProfile(tx, userId, {
      ageConfirmedAt: now,
      termsAcceptedAt: now,
      termsVersion,
    }),
  );
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

const AVATAR_SIZE_PX = 512;

export class InvalidAvatarKeyError extends Error {}

// The key embeds the owner's own user id so `completeAvatarUpload` can
// check ownership without a DB round trip — there's no "pending avatar
// upload" table (TRD §4's `profiles` only has the final `avatar_key`),
// so this check is what stops user A from asking us to process (and claim
// as their own) an object key some other flow issued for user B.
export function avatarQuarantineKey(userId: string): string {
  return `avatars/${userId}/${uuidv7()}`;
}

interface AvatarDeps {
  db: AppUserDb;
  s3: S3Client;
  buckets: { quarantine: string; public: string };
}

// SECURITY.md "Restrict file uploads": magic-byte check, decode + re-encode
// with sharp, strip all metadata, random public key, quarantine object
// never served and always deleted (success or failure) — the pipeline
// itself lives in src/photos/pipeline.ts and src/storage/s3.ts so Phase 3's
// log photos can reuse it unchanged.
export async function completeAvatarUpload(
  deps: AvatarDeps,
  userId: string,
  quarantineKey: string,
): Promise<ProfileRow> {
  if (!quarantineKey.startsWith(`avatars/${userId}/`)) {
    throw new InvalidAvatarKeyError();
  }

  const bytes = await getObjectBytes(deps.s3, deps.buckets.quarantine, quarantineKey);

  try {
    const detected = detectImageType(bytes);
    if (!detected) throw new InvalidImageError("unrecognized image type");

    const processed = await processImage(bytes, AVATAR_SIZE_PX);
    const publicKey = `avatars/${uuidv7()}.webp`;
    await putObjectBytes(
      deps.s3,
      deps.buckets.public,
      publicKey,
      processed.bytes,
      processed.contentType,
    );

    return withUserTx(deps.db, userId, (tx) =>
      repo.updateProfile(tx, userId, { avatarKey: publicKey }),
    );
  } finally {
    // Quarantine objects are never served and never kept — this runs
    // whether processing succeeded, failed, or threw.
    await deleteObject(deps.s3, deps.buckets.quarantine, quarantineKey);
  }
}
