import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { buildTestEnv, clearRateLimit, injectAs, uniqueEmail } from "../helpers/env.js";

// A fixed, test-only IP so this file's rate-limit bucket (keyed by IP + path
// in Better Auth's limiter) can't collide with other test files hitting the
// same /sign-in/email path from their own fixed IPs.
const REMOTE_ADDRESS = "203.0.113.42";

describe("auth endpoints are rate-limited (DEV_PLAN Phase 1 acceptance)", () => {
  const env = buildTestEnv();
  const app = buildApp(env);
  const inject = injectAs(app, REMOTE_ADDRESS);

  beforeAll(() => clearRateLimit(env, REMOTE_ADDRESS));
  afterAll(async () => {
    await app.close();
  });

  it("returns 429 on the 6th sign-in attempt within a minute", async () => {
    const payload = { email: uniqueEmail("rate-limit"), password: "whatever-password-1" };

    for (let attempt = 1; attempt <= 5; attempt++) {
      const response = await inject({
        method: "POST",
        url: "/v1/auth/sign-in/email",
        payload,
      });
      expect(response.statusCode).toBe(401);
    }

    const sixth = await inject({
      method: "POST",
      url: "/v1/auth/sign-in/email",
      payload,
    });
    expect(sixth.statusCode).toBe(429);
  });
});
