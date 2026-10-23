import { sql } from "drizzle-orm";
import type { FastifyInstance, InjectOptions } from "fastify";
import { createOwnerDb } from "../../src/db/client.js";
import type { Env } from "../../src/env.js";

// Shared with test/helpers/auth.ts, which needs the same secret to mint a
// verification token directly instead of going through a mocked email send.
export const TEST_BETTER_AUTH_SECRET = "test-secret-at-least-32-characters-long";

export function buildTestEnv(overrides: Partial<Env> = {}): Env {
  return {
    NODE_ENV: "test",
    PORT: 3000,
    LOG_LEVEL: "error",
    DATABASE_URL: process.env.DATABASE_URL ?? "postgres://app_user:changeme@localhost:5432/plate",
    DATABASE_URL_OWNER:
      process.env.DATABASE_URL_OWNER ?? "postgres://app_owner:changeme@localhost:5432/plate",
    ADMIN_ORIGIN: "http://localhost:5173",
    BETTER_AUTH_SECRET: TEST_BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: "http://localhost:3000",
    EMAIL_API_KEY: "",
    EMAIL_FROM: "Plate <no-reply@plate.app>",
    GOOGLE_OAUTH_CLIENT_ID: "",
    GOOGLE_OAUTH_CLIENT_SECRET: "",
    APPLE_CLIENT_ID: "",
    APPLE_TEAM_ID: "",
    APPLE_KEY_ID: "",
    APPLE_PRIVATE_KEY: "",
    S3_ENDPOINT: process.env.S3_ENDPOINT ?? "http://localhost:4566",
    S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID ?? "test",
    S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY ?? "test",
    S3_BUCKET_QUARANTINE: process.env.S3_BUCKET_QUARANTINE ?? "plate-quarantine",
    S3_BUCKET_PUBLIC: process.env.S3_BUCKET_PUBLIC ?? "plate-public",
    S3_BUCKET_PRIVATE: process.env.S3_BUCKET_PRIVATE ?? "plate-private",
    ...overrides,
  };
}

export function uniqueEmail(label: string): string {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

// Better Auth's rate limiter keys by (IP, path) — see src/auth/auth.ts. Each
// test file that hits /sign-up/email or /sign-in/email repeatedly gets its
// own fixed IP so it can't be silently 429'd by another file's calls on the
// shared default "127.0.0.1" inject address within the same 60s window.
export function injectAs(app: FastifyInstance, remoteAddress: string) {
  return (options: InjectOptions) => app.inject({ ...options, remoteAddress });
}

// A fresh, effectively-unique IP per call. test/helpers/auth.ts uses this
// so every signed-up test user gets its own Better Auth rate-limit bucket
// — a shared fixed IP across many signups/sign-ins in one test file (or
// loop) hits the 5/min cap long before the test does anything interesting.
export function uniqueRemoteAddress(): string {
  const octet = () => Math.floor(Math.random() * 254) + 1;
  return `10.${octet()}.${octet()}.${octet()}`;
}

// Better Auth's rate limit key is `${ip}|${path}` (persisted, storage:
// "database"). Lets a test file start with a clean bucket for its own fixed
// IP, so a re-run within the same 60s window doesn't see a leftover count
// from the previous run.
export async function clearRateLimit(env: Env, remoteAddress: string): Promise<void> {
  const db = createOwnerDb(env.DATABASE_URL_OWNER);
  await db.execute(sql`delete from rate_limit where key like ${`${remoteAddress}|%`}`);
  await db.$client.end();
}
