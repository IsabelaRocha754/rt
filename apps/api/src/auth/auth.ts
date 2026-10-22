import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware, APIError } from "better-auth/api";
import { haveIBeenPwned } from "better-auth/plugins";
import { DISPOSABLE_EMAIL_DOMAINS, MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "@plate/shared";
import type { AppUserDb } from "../db/client.js";
import * as schema from "../db/schema/index.js";
import type { Env } from "../env.js";
import { sendPasswordResetEmail, sendVerificationEmail } from "../email.js";
import { buildAppleClientSecret } from "./apple-client-secret.js";

// Separate from the generic error-handler plugin's `{ error: { code,
// message } }` envelope: these requests never reach our Fastify route
// handlers — Better Auth's own `auth.handler` answers them directly with
// its own response shape, which its client SDK expects.
function rejectSignUp(code: string, message: string): never {
  throw new APIError("BAD_REQUEST", { code, message });
}

// Google/Apple only get added once their own vars are filled in (env.ts
// enforces each provider's vars are all-or-nothing) — this is what "stub/
// skip OAuth until credentials exist" means in practice: the API boots and
// email+password works regardless, and each provider turns on by itself
// the moment its .env values are real.
async function buildSocialProviders(env: Env) {
  const providers: NonNullable<Parameters<typeof betterAuth>[0]["socialProviders"]> = {};

  if (env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET) {
    providers.google = {
      clientId: env.GOOGLE_OAUTH_CLIENT_ID,
      clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
    };
  }

  if (env.APPLE_CLIENT_ID && env.APPLE_TEAM_ID && env.APPLE_KEY_ID && env.APPLE_PRIVATE_KEY) {
    providers.apple = {
      clientId: env.APPLE_CLIENT_ID,
      clientSecret: await buildAppleClientSecret({
        teamId: env.APPLE_TEAM_ID,
        keyId: env.APPLE_KEY_ID,
        privateKey: env.APPLE_PRIVATE_KEY,
        clientId: env.APPLE_CLIENT_ID,
      }),
      // TODO(PR4, mobile Expo integration): add `appBundleIdentifier` once
      // the mobile app's bundle id is wired through — needed for native
      // (id-token) Sign in with Apple, not for this web/authorization-code
      // flow.
    };
  }

  return providers;
}

export async function buildAuth(env: Env, db: AppUserDb) {
  const socialProviders = await buildSocialProviders(env);

  return betterAuth({
    socialProviders,
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
    // SECURITY.md "Encrypt sensitive data" > field-level: OAuth access/
    // refresh tokens stored in the `account` table are encrypted at rest,
    // using Better Auth's own built-in symmetric encryption (keyed from
    // `secret` above) rather than us reimplementing it.
    account: { encryptOAuthTokens: true },
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
        "/sign-in/social": { window: 60, max: 5 },
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

export type Auth = Awaited<ReturnType<typeof buildAuth>>;
