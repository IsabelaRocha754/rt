import { sql } from "drizzle-orm";
import type { FastifyInstance, InjectOptions } from "fastify";
import { createOwnerDb } from "../../src/db/client.js";
import type { Env } from "../../src/env.js";

export function buildTestEnv(overrides: Partial<Env> = {}): Env {
  return {
    NODE_ENV: "test",
    PORT: 3000,
    LOG_LEVEL: "error",
    DATABASE_URL: process.env.DATABASE_URL ?? "postgres://app_user:changeme@localhost:5432/plate",
    DATABASE_URL_OWNER:
      process.env.DATABASE_URL_OWNER ?? "postgres://app_owner:changeme@localhost:5432/plate",
    ADMIN_ORIGIN: "http://localhost:5173",
    BETTER_AUTH_SECRET: "test-secret-at-least-32-characters-long",
    BETTER_AUTH_URL: "http://localhost:3000",
    EMAIL_API_KEY: "",
    EMAIL_FROM: "Plate <no-reply@plate.app>",
    GOOGLE_OAUTH_CLIENT_ID: "",
    GOOGLE_OAUTH_CLIENT_SECRET: "",
    APPLE_CLIENT_ID: "",
    APPLE_TEAM_ID: "",
    APPLE_KEY_ID: "",
    APPLE_PRIVATE_KEY: "",
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

// Better Auth's rate limit key is `${ip}|${path}` (persisted, storage:
// "database"). Lets a test file start with a clean bucket for its own fixed
// IP, so a re-run within the same 60s window doesn't see a leftover count
// from the previous run.
export async function clearRateLimit(env: Env, remoteAddress: string): Promise<void> {
  const db = createOwnerDb(env.DATABASE_URL_OWNER);
  await db.execute(sql`delete from rate_limit where key like ${`${remoteAddress}|%`}`);
  await db.$client.end();
}
