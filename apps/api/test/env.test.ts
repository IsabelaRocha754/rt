import { describe, expect, it, vi } from "vitest";
import { loadEnv } from "../src/env.js";

const baseEnv = {
  DATABASE_URL: "postgres://app_user:changeme@localhost:5432/plate",
  DATABASE_URL_OWNER: "postgres://app_owner:changeme@localhost:5432/plate",
  ADMIN_ORIGIN: "http://localhost:5173",
};

describe("loadEnv", () => {
  it("accepts a valid development config", () => {
    const env = loadEnv({ ...baseEnv, NODE_ENV: "development" });
    expect(env.ADMIN_ORIGIN).toBe("http://localhost:5173");
  });

  it("refuses to start in production with a wildcard ADMIN_ORIGIN", () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    loadEnv({ ...baseEnv, NODE_ENV: "production", ADMIN_ORIGIN: "*" });

    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("refuses to start in production with an http ADMIN_ORIGIN", () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    loadEnv({ ...baseEnv, NODE_ENV: "production", ADMIN_ORIGIN: "http://admin.example.com" });

    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
