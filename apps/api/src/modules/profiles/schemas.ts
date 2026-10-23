import { z } from "zod";
import {
  BIO_MAX_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
  isValidUsername,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from "@plate/shared";
import { ALLOWED_UPLOAD_CONTENT_TYPES, MAX_UPLOAD_BYTES } from "../../storage/s3.js";

const usernameSchema = z
  .string()
  .min(USERNAME_MIN_LENGTH)
  .max(USERNAME_MAX_LENGTH)
  .transform((value) => value.toLowerCase())
  .refine(isValidUsername, {
    message: "Usernames use only a-z, 0-9, '_' and '.', and can't be a reserved name.",
  });

// Only these fields are ever writable from the request body — role/plan/
// status/user_id/timestamps are server-set (CLAUDE.md rule 4). `.strict()`
// makes an unknown key (e.g. `role`) a 400, not a silently-ignored no-op.
export const patchMeBodySchema = z
  .object({
    username: usernameSchema.optional(),
    displayName: z.string().trim().max(DISPLAY_NAME_MAX_LENGTH).nullable().optional(),
    bio: z.string().trim().max(BIO_MAX_LENGTH).nullable().optional(),
    isPrivate: z.boolean().optional(),
    locale: z.enum(["pt-BR", "en"]).optional(),
  })
  .strict();

export type PatchMeBody = z.infer<typeof patchMeBodySchema>;

export const errorResponseSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});

// Whitelists exactly what a route may return (SECURITY.md "Trim API
// responses") — never email/tokens/role/plan/status of someone ELSE, and
// never the raw internal flags.
export const meResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  emailVerified: z.boolean(),
  username: z.string().nullable(),
  displayName: z.string().nullable(),
  bio: z.string().nullable(),
  avatarKey: z.string().nullable(),
  isPrivate: z.boolean(),
  locale: z.string(),
  role: z.enum(["user", "admin"]),
  plan: z.enum(["free", "premium"]),
  status: z.enum(["active", "suspended"]),
  // null until `POST /me/accept-terms` (DEV_PLAN Phase 1 F1 "age & terms")
  // — the client uses this to know whether that onboarding step is done.
  ageConfirmedAt: z.coerce.string().nullable(),
  termsAcceptedAt: z.coerce.string().nullable(),
  termsVersion: z.string().nullable(),
  createdAt: z.coerce.string(),
  updatedAt: z.coerce.string(),
});

export const usernameParamSchema = z.object({ username: z.string() });

// `ageConfirmed` must be the literal `true` — there is no "confirm you're
// under 18" path (SECURITY.md §3 "Minimum age 18").
export const acceptTermsBodySchema = z
  .object({
    ageConfirmed: z.literal(true),
    termsVersion: z.string().min(1),
  })
  .strict();

export const avatarUploadUrlBodySchema = z
  .object({
    contentType: z.enum(ALLOWED_UPLOAD_CONTENT_TYPES),
    contentLength: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  })
  .strict();

export const avatarUploadUrlResponseSchema = z.object({
  url: z.string(),
  key: z.string(),
  // The client must send exactly these headers on its PUT — both are part
  // of what the URL's signature covers, so anything else fails.
  headers: z.object({ "Content-Type": z.string(), "Content-Length": z.string() }),
});

export const avatarCompleteBodySchema = z.object({ key: z.string() }).strict();

// A private, non-self profile only ever gets this much (USER_FLOWS.md
// F13): avatar, username, display name, and the "this account is private"
// signal — never bio, role, plan, status, or timestamps.
export const publicProfileResponseSchema = z.object({
  username: z.string().nullable(),
  displayName: z.string().nullable(),
  avatarKey: z.string().nullable(),
  isPrivate: z.boolean(),
  bio: z.string().nullable().optional(),
});
