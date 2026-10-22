import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { signInCookie, signUpAndVerify } from "../helpers/auth.js";
import { buildTestEnv, clearRateLimit, injectAs, uniqueEmail } from "../helpers/env.js";

const REMOTE_ADDRESS = "203.0.113.61";
const PASSWORD = "correct-horse-battery";

async function createUser(
  app: ReturnType<typeof buildApp>,
  label: string,
  patch: Record<string, unknown>,
) {
  const email = uniqueEmail(label);
  await signUpAndVerify(app, { email, password: PASSWORD });
  const cookie = await signInCookie(app, { email, password: PASSWORD });
  const inject = injectAs(app, REMOTE_ADDRESS);
  const response = await inject({
    method: "PATCH",
    url: "/v1/me",
    headers: { cookie },
    payload: patch,
  });
  if (response.statusCode !== 200) {
    throw new Error(`profile setup failed: ${response.statusCode} ${response.body}`);
  }
  return { email, cookie, username: response.json().username as string };
}

describe("GET /v1/users/:username (DEV_PLAN Phase 1 PR3: canView)", () => {
  const env = buildTestEnv();
  const app = buildApp(env);
  const inject = injectAs(app, REMOTE_ADDRESS);

  beforeAll(() => clearRateLimit(env, REMOTE_ADDRESS));
  afterAll(async () => {
    await app.close();
  });

  it("requires a session", async () => {
    const response = await inject({ method: "GET", url: "/v1/users/anyone" });
    expect(response.statusCode).toBe(401);
  });

  it("returns 404 for a username that doesn't exist", async () => {
    const viewer = await createUser(app, "canview-viewer-404", {
      username: `viewer404${Date.now()}`,
    });
    const response = await inject({
      method: "GET",
      url: "/v1/users/no-such-user-at-all",
      headers: { cookie: viewer.cookie },
    });
    expect(response.statusCode).toBe(404);
  });

  it("shows the full profile for a public account to any other viewer", async () => {
    const owner = await createUser(app, "canview-public-owner", {
      username: `pub${Date.now()}`,
      bio: "I eat a lot of pizza",
      isPrivate: false,
    });
    const viewer = await createUser(app, "canview-public-viewer", {
      username: `viewerpub${Date.now()}`,
    });

    const response = await inject({
      method: "GET",
      url: `/v1/users/${owner.username}`,
      headers: { cookie: viewer.cookie },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.username).toBe(owner.username);
    expect(body.isPrivate).toBe(false);
    expect(body.bio).toBe("I eat a lot of pizza");
  });

  it("shows only the teaser for a private account to a non-owner (no follows yet)", async () => {
    const owner = await createUser(app, "canview-private-owner", {
      username: `priv${Date.now()}`,
      displayName: "Private Person",
      bio: "secret restaurant opinions",
      isPrivate: true,
    });
    const viewer = await createUser(app, "canview-private-viewer", {
      username: `viewerpriv${Date.now()}`,
    });

    const response = await inject({
      method: "GET",
      url: `/v1/users/${owner.username}`,
      headers: { cookie: viewer.cookie },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.username).toBe(owner.username);
    expect(body.displayName).toBe("Private Person");
    expect(body.isPrivate).toBe(true);
    expect(body.bio).toBeUndefined();
  });

  it("shows the full profile to the private account's own owner", async () => {
    const owner = await createUser(app, "canview-private-self", {
      username: `privself${Date.now()}`,
      bio: "only I should see this... but I'm also me",
      isPrivate: true,
    });

    const response = await inject({
      method: "GET",
      url: `/v1/users/${owner.username}`,
      headers: { cookie: owner.cookie },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().bio).toBe("only I should see this... but I'm also me");
  });
});
