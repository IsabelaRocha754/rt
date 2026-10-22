import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { buildTestEnv, clearRateLimit, injectAs, uniqueEmail } from "../helpers/env.js";

// DEV_PLAN Phase 1 "Security tests" bullet. Full IDOR/visibility matrix
// testing arrives with the first user-owned resources (profiles, Phase 1
// PR3; logs, lists, ... later) — see docs/SECURITY.md §Authorization. These
// two are testable now, against the auth routes landing in this PR.
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

  it.todo("IDOR visibility matrix — arrives with profiles/logs/lists (TRD §5)");
});
