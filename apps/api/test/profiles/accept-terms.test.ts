import { describe, expect, it, afterAll } from "vitest";
import { buildApp } from "../../src/app.js";
import { signInCookie, signUpAndVerify } from "../helpers/auth.js";
import { buildTestEnv, injectAs, uniqueEmail, uniqueRemoteAddress } from "../helpers/env.js";

const PASSWORD = "correct-horse-battery";

describe("POST /v1/me/accept-terms (DEV_PLAN Phase 1 PR4b: age & terms)", () => {
  const app = buildApp(buildTestEnv());
  const inject = injectAs(app, uniqueRemoteAddress());

  afterAll(async () => {
    await app.close();
  });

  it("is null until accepted, then records both timestamps and the version", async () => {
    const email = uniqueEmail("accept-terms");
    await signUpAndVerify(app, { email, password: PASSWORD });
    const cookie = await signInCookie(app, { email, password: PASSWORD });

    const before = await inject({ method: "GET", url: "/v1/me", headers: { cookie } });
    expect(before.json().ageConfirmedAt).toBeNull();
    expect(before.json().termsAcceptedAt).toBeNull();

    const accept = await inject({
      method: "POST",
      url: "/v1/me/accept-terms",
      headers: { cookie },
      payload: { ageConfirmed: true, termsVersion: "2026-01-01" },
    });
    expect(accept.statusCode).toBe(200);
    const body = accept.json();
    expect(body.ageConfirmedAt).toBeTypeOf("string");
    expect(body.termsAcceptedAt).toBeTypeOf("string");
    expect(body.termsVersion).toBe("2026-01-01");
  });

  it("rejects ageConfirmed: false (no under-18 path)", async () => {
    const email = uniqueEmail("accept-terms-underage");
    await signUpAndVerify(app, { email, password: PASSWORD });
    const cookie = await signInCookie(app, { email, password: PASSWORD });

    const response = await inject({
      method: "POST",
      url: "/v1/me/accept-terms",
      headers: { cookie },
      payload: { ageConfirmed: false, termsVersion: "2026-01-01" },
    });
    expect(response.statusCode).toBe(400);
  });
});
