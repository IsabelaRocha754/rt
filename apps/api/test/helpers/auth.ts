import { createEmailVerificationToken } from "better-auth/api";
import type { FastifyInstance } from "fastify";
import { injectAs, TEST_BETTER_AUTH_SECRET, uniqueRemoteAddress } from "./env.js";

interface Credentials {
  email: string;
  password: string;
  name?: string;
}

// Signs up and verifies a user without going through a mocked email send —
// mints the same self-contained JWT Better Auth's own verification link
// carries (src/auth/auth.ts's `emailVerification.sendVerificationEmail`
// callback never runs). Keeps every test file that just needs a verified
// user free of the `vi.mock("../../src/email.js")` boilerplate.
//
// Uses its own fresh IP (env.ts's `uniqueRemoteAddress`) rather than one
// the caller shares across many users — Better Auth's own rate limiter
// caps /sign-up/email and /sign-in/email at 5/min per IP (src/auth/
// auth.ts), which a test file creating more than a handful of users on one
// fixed IP would otherwise hit well before it gets to the actual test.
export async function signUpAndVerify(
  app: FastifyInstance,
  credentials: Credentials,
): Promise<void> {
  const inject = injectAs(app, uniqueRemoteAddress());
  const signUp = await inject({
    method: "POST",
    url: "/v1/auth/sign-up/email",
    payload: {
      name: credentials.name ?? "Test User",
      email: credentials.email,
      password: credentials.password,
    },
  });
  if (signUp.statusCode !== 200) {
    throw new Error(`sign-up failed: ${signUp.statusCode} ${signUp.body}`);
  }

  const token = await createEmailVerificationToken(TEST_BETTER_AUTH_SECRET, credentials.email);
  const verify = await inject({ method: "GET", url: `/v1/auth/verify-email?token=${token}` });
  if (verify.statusCode !== 200) {
    throw new Error(`verify failed: ${verify.statusCode} ${verify.body}`);
  }
}

// Returns a `Cookie` header value good for one authenticated session.
export async function signInCookie(
  app: FastifyInstance,
  credentials: Pick<Credentials, "email" | "password">,
): Promise<string> {
  const inject = injectAs(app, uniqueRemoteAddress());
  const signIn = await inject({
    method: "POST",
    url: "/v1/auth/sign-in/email",
    payload: { email: credentials.email, password: credentials.password },
  });
  if (signIn.statusCode !== 200) {
    throw new Error(`sign-in failed: ${signIn.statusCode} ${signIn.body}`);
  }
  return signIn.cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}
