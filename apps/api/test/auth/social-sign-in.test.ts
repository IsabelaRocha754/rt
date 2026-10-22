import { generateKeyPairSync } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { buildTestEnv, clearRateLimit, injectAs } from "../helpers/env.js";

function generateTestApplePrivateKeyPem(): string {
  const { privateKey } = generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  return privateKey.replace(/\n/g, "\\n");
}

describe("social sign-in (DEV_PLAN Phase 1 PR2: Google/Apple OAuth)", () => {
  describe("when no provider credentials are configured", () => {
    const env = buildTestEnv();
    const app = buildApp(env);
    const inject = injectAs(app, "203.0.113.50");

    beforeAll(() => clearRateLimit(env, "203.0.113.50"));
    afterAll(async () => {
      await app.close();
    });

    it.each(["google", "apple"])("returns 404 for provider=%s", async (provider) => {
      const response = await inject({
        method: "POST",
        url: "/v1/auth/sign-in/social",
        payload: { provider, callbackURL: "/", disableRedirect: true },
      });
      expect(response.statusCode).toBe(404);
      expect(response.json().code).toBe("PROVIDER_NOT_FOUND");
    });
  });

  describe("once Google credentials are configured", () => {
    const env = buildTestEnv({
      GOOGLE_OAUTH_CLIENT_ID: "test-google-client-id",
      GOOGLE_OAUTH_CLIENT_SECRET: "test-google-client-secret",
    });
    const app = buildApp(env);
    const inject = injectAs(app, "203.0.113.51");

    beforeAll(() => clearRateLimit(env, "203.0.113.51"));
    afterAll(async () => {
      await app.close();
    });

    it("returns a Google authorize URL built from our client id and callback path", async () => {
      const response = await inject({
        method: "POST",
        url: "/v1/auth/sign-in/social",
        payload: { provider: "google", callbackURL: "/", disableRedirect: true },
      });
      expect(response.statusCode).toBe(200);

      const url = new URL(response.json().url);
      expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
      expect(url.searchParams.get("client_id")).toBe("test-google-client-id");
      expect(url.searchParams.get("redirect_uri")).toBe(
        "http://localhost:3000/v1/auth/callback/google",
      );
    });
  });

  describe("once Apple credentials are configured", () => {
    const env = buildTestEnv({
      APPLE_CLIENT_ID: "dev.plate.signin",
      APPLE_TEAM_ID: "TEAMID1234",
      APPLE_KEY_ID: "KEYID56789",
      APPLE_PRIVATE_KEY: generateTestApplePrivateKeyPem(),
    });
    const app = buildApp(env);
    const inject = injectAs(app, "203.0.113.52");

    beforeAll(() => clearRateLimit(env, "203.0.113.52"));
    afterAll(async () => {
      await app.close();
    });

    it("returns an Apple authorize URL built from our client id and callback path", async () => {
      const response = await inject({
        method: "POST",
        url: "/v1/auth/sign-in/social",
        payload: { provider: "apple", callbackURL: "/", disableRedirect: true },
      });
      expect(response.statusCode).toBe(200);

      const url = new URL(response.json().url);
      expect(url.origin + url.pathname).toBe("https://appleid.apple.com/auth/authorize");
      expect(url.searchParams.get("client_id")).toBe("dev.plate.signin");
      expect(url.searchParams.get("redirect_uri")).toBe(
        "http://localhost:3000/v1/auth/callback/apple",
      );
    });
  });
});
