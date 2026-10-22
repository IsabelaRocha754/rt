import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { signInCookie, signUpAndVerify } from "../helpers/auth.js";
import { buildTestEnv, clearRateLimit, injectAs, uniqueEmail } from "../helpers/env.js";

const REMOTE_ADDRESS = "203.0.113.60";
const PASSWORD = "correct-horse-battery";

describe("GET/PATCH /v1/me (DEV_PLAN Phase 1 PR3)", () => {
  const env = buildTestEnv();
  const app = buildApp(env);
  const inject = injectAs(app, REMOTE_ADDRESS);

  beforeAll(() => clearRateLimit(env, REMOTE_ADDRESS));
  afterAll(async () => {
    await app.close();
  });

  it("requires a session", async () => {
    const response = await inject({ method: "GET", url: "/v1/me" });
    expect(response.statusCode).toBe(401);
  });

  it("auto-creates a profile row at signup and returns it from GET /me", async () => {
    const email = uniqueEmail("me-basic");
    await signUpAndVerify(app, { email, password: PASSWORD });
    const cookie = await signInCookie(app, { email, password: PASSWORD });

    const response = await inject({ method: "GET", url: "/v1/me", headers: { cookie } });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.email).toBe(email);
    expect(body.username).toBeNull();
    expect(body.role).toBe("user");
    expect(body.plan).toBe("free");
    expect(body.status).toBe("active");
    expect(body.isPrivate).toBe(false);
    expect(body).not.toHaveProperty("password");
  });

  it("rejects role/plan/status in the PATCH body (mass assignment)", async () => {
    const email = uniqueEmail("me-mass-assignment");
    await signUpAndVerify(app, { email, password: PASSWORD });
    const cookie = await signInCookie(app, { email, password: PASSWORD });

    const response = await inject({
      method: "PATCH",
      url: "/v1/me",
      headers: { cookie },
      payload: { role: "admin" },
    });
    expect(response.statusCode).toBe(400);

    const check = await inject({ method: "GET", url: "/v1/me", headers: { cookie } });
    expect(check.json().role).toBe("user");
  });

  it("updates displayName/bio/isPrivate/locale", async () => {
    const email = uniqueEmail("me-update");
    await signUpAndVerify(app, { email, password: PASSWORD });
    const cookie = await signInCookie(app, { email, password: PASSWORD });

    const response = await inject({
      method: "PATCH",
      url: "/v1/me",
      headers: { cookie },
      payload: { displayName: "Ada", bio: "pizza enthusiast", isPrivate: true, locale: "en" },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.displayName).toBe("Ada");
    expect(body.bio).toBe("pizza enthusiast");
    expect(body.isPrivate).toBe(true);
    expect(body.locale).toBe("en");
  });

  it("normalizes a valid username to lowercase", async () => {
    const email = uniqueEmail("me-username");
    await signUpAndVerify(app, { email, password: PASSWORD });
    const cookie = await signInCookie(app, { email, password: PASSWORD });

    // Mixed-case but otherwise fixed data would collide with a previous
    // run's row — Postgres state isn't reset between runs, unlike each
    // test's own uniqueEmail().
    const mixedCaseUsername = `Ada_Lovelace_${Date.now()}`;
    const response = await inject({
      method: "PATCH",
      url: "/v1/me",
      headers: { cookie },
      payload: { username: mixedCaseUsername },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().username).toBe(mixedCaseUsername.toLowerCase());
  });

  it.each(["ab", "has space", "a".repeat(31), "admin"])(
    "rejects an invalid or reserved username %s",
    async (username) => {
      const email = uniqueEmail("me-bad-username");
      await signUpAndVerify(app, { email, password: PASSWORD });
      const cookie = await signInCookie(app, { email, password: PASSWORD });

      const response = await inject({
        method: "PATCH",
        url: "/v1/me",
        headers: { cookie },
        payload: { username },
      });
      expect(response.statusCode).toBe(400);
    },
  );

  it("rejects a username already taken by someone else", async () => {
    const takenUsername = `taken${Date.now()}`;

    const firstEmail = uniqueEmail("me-username-first");
    await signUpAndVerify(app, { email: firstEmail, password: PASSWORD });
    const firstCookie = await signInCookie(app, {
      email: firstEmail,
      password: PASSWORD,
    });
    const claim = await inject({
      method: "PATCH",
      url: "/v1/me",
      headers: { cookie: firstCookie },
      payload: { username: takenUsername },
    });
    expect(claim.statusCode).toBe(200);

    const secondEmail = uniqueEmail("me-username-second");
    await signUpAndVerify(app, { email: secondEmail, password: PASSWORD });
    const secondCookie = await signInCookie(app, {
      email: secondEmail,
      password: PASSWORD,
    });
    const conflict = await inject({
      method: "PATCH",
      url: "/v1/me",
      headers: { cookie: secondCookie },
      payload: { username: takenUsername },
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json().error.code).toBe("username_taken");
  });
});
