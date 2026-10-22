import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import type { Env } from "../src/env.js";

const testEnv: Env = {
  NODE_ENV: "test",
  PORT: 3000,
  LOG_LEVEL: "error",
  DATABASE_URL: "postgres://app_user:changeme@localhost:5432/plate",
  DATABASE_URL_OWNER: "postgres://app_owner:changeme@localhost:5432/plate",
  ADMIN_ORIGIN: "http://localhost:5173",
  BETTER_AUTH_SECRET: "test-secret-at-least-32-characters-long",
  BETTER_AUTH_URL: "http://localhost:3000",
  EMAIL_API_KEY: "",
  EMAIL_FROM: "Plate <no-reply@plate.app>",
};

describe("GET /health", () => {
  it("returns 200 with the security headers present", async () => {
    const app = buildApp(testEnv);
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
    expect(response.headers["strict-transport-security"]).toBeDefined();
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("DENY");
    expect(response.headers["referrer-policy"]).toBe("no-referrer");

    await app.close();
  });
});
