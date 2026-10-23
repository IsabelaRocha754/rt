import { describe, expect, it, vi } from "vitest";
import { loadEnv } from "../src/env.js";

const baseEnv = {
  DATABASE_URL: "postgres://app_user:changeme@localhost:5432/plate",
  DATABASE_URL_OWNER: "postgres://app_owner:changeme@localhost:5432/plate",
  ADMIN_ORIGIN: "http://localhost:5173",
  BETTER_AUTH_SECRET: "test-secret-at-least-32-characters-long",
  BETTER_AUTH_URL: "http://localhost:3000",
  EMAIL_API_KEY: "",
  S3_ENDPOINT: "http://localhost:4566",
  S3_ACCESS_KEY_ID: "test",
  S3_SECRET_ACCESS_KEY: "test",
  S3_BUCKET_QUARANTINE: "plate-quarantine",
  S3_BUCKET_PUBLIC: "plate-public",
  S3_BUCKET_PRIVATE: "plate-private",
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

  const prodOverrides = {
    ADMIN_ORIGIN: "https://admin.example.com",
    BETTER_AUTH_URL: "https://api.example.com",
    DATABASE_URL: "postgres://app_user:changeme@db.example.com:5432/plate?sslmode=require",
    EMAIL_API_KEY: "re_live_key",
    S3_ENDPOINT: "https://s3.example.com",
  };

  it("accepts a valid production config", () => {
    const env = loadEnv({ ...baseEnv, ...prodOverrides, NODE_ENV: "production" });
    expect(env.NODE_ENV).toBe("production");
  });

  it("refuses to start in production with the .env.example placeholder secret", () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    loadEnv({
      ...baseEnv,
      ...prodOverrides,
      NODE_ENV: "production",
      BETTER_AUTH_SECRET: "replace-with-32-byte-random-value",
    });

    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("refuses to start in production without an EMAIL_API_KEY", () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    loadEnv({ ...baseEnv, ...prodOverrides, NODE_ENV: "production", EMAIL_API_KEY: "" });

    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("refuses to start in production with an http S3_ENDPOINT", () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    loadEnv({
      ...baseEnv,
      ...prodOverrides,
      NODE_ENV: "production",
      S3_ENDPOINT: "http://s3.example.com",
    });

    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
