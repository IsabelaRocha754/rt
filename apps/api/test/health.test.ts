import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { buildTestEnv } from "./helpers/env.js";

describe("GET /health", () => {
  it("returns 200 with the security headers present", async () => {
    const app = buildApp(buildTestEnv());
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
