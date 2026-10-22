import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware, APIError } from "better-auth/api";
import { haveIBeenPwned } from "better-auth/plugins";
import { DISPOSABLE_EMAIL_DOMAINS, MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "@plate/shared";
import type { AppUserDb } from "../db/client.js";
import * as schema from "../db/schema/index.js";
import type { Env } from "../env.js";
import { sendPasswordResetEmail, sendVerificationEmail } from "../email.js";

// Separate from the generic error-handler plugin's `{ error: { code,
// message } }` envelope: these requests never reach our Fastify route
// handlers — Better Auth's own `auth.handler` answers them directly with
// its own response shape, which its client SDK expects.
function rejectSignUp(code: string, message: string): never {
  throw new APIError("BAD_REQUEST", { code, message });
}

export function buildAuth(env: Env, db: AppUserDb) {
  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    // Must include the mount path — TRD §7 mounts Better Auth at
    // `/v1/auth/*` (src/plugins/auth.ts), not the library default
    // `/api/auth`. Every link Better Auth generates (verification, reset)
    // is built from this.
    baseURL: `${env.BETTER_AUTH_URL}/v1/auth`,
    trustedOrigins: [env.ADMIN_ORIGIN],
    // UUIDv7 ids everywhere (CLAUDE.md "Conventions") — let the `idColumn()`
    // defaults in db/schema/auth.ts generate them, instead of Better Auth's
    // own id generator.
    advanced: {
      database: { generateId: false },
      // src/plugins/auth.ts sets this from Fastify's own `request.ip`
      // (already resolved against trustProxy) before forwarding — without
      // it, Better Auth's rate limiter can't see a client IP at all (its
      // own `Request` object carries no socket) and falls back to one
      // shared bucket for every caller.
      ipAddress: { ipAddressHeaders: ["x-real-ip"] },
    },
    database: drizzleAdapter(db, { provider: "pg", schema }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      maxPasswordLength: MAX_PASSWORD_LENGTH,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await sendPasswordResetEmail(env, user.email, url);
      },
    },
    emailVerification: {
      sendVerificationEmail: async ({ user, url }) => {
        await sendVerificationEmail(env, user.email, url);
      },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      // SECURITY.md "Rate-limit login": 5/min on auth endpoints that are
      // the usual target of credential stuffing / enumeration / spam
      // signups. A second, coarser 20/hour cap sits in front of these same
      // paths via @fastify/rate-limit (src/plugins/auth.ts).
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 60, max: 5 },
        "/request-password-reset": { window: 60, max: 5 },
        "/send-verification-email": { window: 60, max: 5 },
      },
    },
    plugins: [
      haveIBeenPwned({
        customPasswordCompromisedMessage:
          "This password has appeared in a data breach. Please choose a different one.",
      }),
    ],
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === "/sign-up/email") {
          const email = typeof ctx.body?.email === "string" ? ctx.body.email : undefined;
          const domain = email?.split("@")[1]?.toLowerCase();
          if (domain && DISPOSABLE_EMAIL_DOMAINS.includes(domain)) {
            rejectSignUp("disposable_email", "Please sign up with a permanent email address.");
          }
        }

        if (ctx.path === "/change-password" && ctx.body) {
          // Security policy (DEV_PLAN Phase 1 "session revocation on
          // password change"): always revoke every other session, no
          // matter what the client sends.
          ctx.body.revokeOtherSessions = true;
        }
      }),
    },
  });
}

export type Auth = ReturnType<typeof buildAuth>;
