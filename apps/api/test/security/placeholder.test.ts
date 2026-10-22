import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { signInCookie, signUpAndVerify } from "../helpers/auth.js";
import { buildTestEnv, clearRateLimit, injectAs, uniqueEmail } from "../helpers/env.js";

// DEV_PLAN Phase 1 "Security tests" bullet, plus its own acceptance
// criterion ("PATCH /me with { role: admin } → 400 and role unchanged").
// Full IDOR/visibility matrix testing arrives with logs/lists/follows —
// see docs/SECURITY.md §Authorization and test/profiles/*.test.ts for the
// profiles-specific canView coverage that landed with PR3.
describe("security test suite", () => {
  const env = buildTestEnv();
  const app = buildApp(env);
  const inject = injectAs(app, "203.0.113.30");
  beforeAll(() => clearRateLimit(env, "203.0.113.30"));
  afterAll(async () => {
    await app.close();
  });

  it("mass assignment: role/plan/status-shaped fields in the signup body are ignored", async () => {
    const response = await inject({
      method: "POST",
      url: "/v1/auth/sign-up/email",
      payload: {
        name: "Attacker",
        email: uniqueEmail("security-mass-assignment"),
        password: "whatever-password-1",
        // None of these are real fields on Better Auth's user model; if a
        // future `user.additionalFields` config ever added one named like
        // this, it would still need to go through the server, never the
        // client-supplied signup body.
        role: "admin",
        plan: "premium",
        status: "active",
        emailVerified: true,
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().user.emailVerified).toBe(false);
  });

  it("an unverified account cannot authenticate (stand-in for 'can't post')", async () => {
    const email = uniqueEmail("security-unverified");
    await inject({
      method: "POST",
      url: "/v1/auth/sign-up/email",
      payload: { name: "Unverified", email, password: "whatever-password-1" },
    });

    const signIn = await inject({
      method: "POST",
      url: "/v1/auth/sign-in/email",
      payload: { email, password: "whatever-password-1" },
    });
    expect(signIn.statusCode).toBe(403);
    expect(signIn.json().code).toBe("EMAIL_NOT_VERIFIED");
  });

  it("PATCH /me with { role: admin } → 400 and role unchanged (DEV_PLAN acceptance)", async () => {
    const email = uniqueEmail("security-patch-me-role");
    const password = "whatever-password-1";
    await signUpAndVerify(app, { email, password });
    const cookie = await signInCookie(app, { email, password });

    const patch = await inject({
      method: "PATCH",
      url: "/v1/me",
      headers: { cookie },
      payload: { role: "admin" },
    });
    expect(patch.statusCode).toBe(400);

    const me = await inject({ method: "GET", url: "/v1/me", headers: { cookie } });
    expect(me.json().role).toBe("user");
  });

  it.todo("IDOR visibility matrix — arrives with logs/lists/follows (TRD §5)");
});
