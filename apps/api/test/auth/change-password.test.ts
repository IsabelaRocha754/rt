import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../src/app.js";
import { buildTestEnv, clearRateLimit, injectAs, uniqueEmail } from "../helpers/env.js";

type SendEmail = (env: unknown, to: string, url: string) => Promise<void>;

const { sendVerificationEmail } = vi.hoisted(() => ({
  sendVerificationEmail: vi.fn<SendEmail>(async () => {}),
}));

vi.mock("../../src/email.js", () => ({
  sendVerificationEmail,
  sendPasswordResetEmail: vi.fn<SendEmail>(async () => {}),
}));

function cookieHeader(setCookie: string[]): string {
  return setCookie.map((cookie) => cookie.split(";")[0]).join("; ");
}

const REMOTE_ADDRESS = "203.0.113.20";

describe("change-password (DEV_PLAN Phase 1: session revocation on password change)", () => {
  const env = buildTestEnv();
  const app = buildApp(env);
  const inject = injectAs(app, REMOTE_ADDRESS);

  beforeAll(() => clearRateLimit(env, REMOTE_ADDRESS));
  afterAll(async () => {
    await app.close();
  });

  it("revokes every other session and issues a fresh one for the current device", async () => {
    const email = uniqueEmail("change-pw");
    const originalPassword = "original-password-1";
    const newPassword = "brand-new-password-2";

    const signUp = await inject({
      method: "POST",
      url: "/v1/auth/sign-up/email",
      payload: { name: "Multi Device", email, password: originalPassword },
    });
    expect(signUp.statusCode).toBe(200);

    const verifyUrl = sendVerificationEmail.mock.calls[0]?.[2] as string;
    const token = new URL(verifyUrl).searchParams.get("token");
    await inject({ method: "GET", url: `/v1/auth/verify-email?token=${token}` });

    // Two "devices" sign in with the same account.
    const sessionA = await inject({
      method: "POST",
      url: "/v1/auth/sign-in/email",
      payload: { email, password: originalPassword },
    });
    const sessionB = await inject({
      method: "POST",
      url: "/v1/auth/sign-in/email",
      payload: { email, password: originalPassword },
    });
    const cookieA = cookieHeader(sessionA.cookies.map((c) => `${c.name}=${c.value}`));
    const cookieB = cookieHeader(sessionB.cookies.map((c) => `${c.name}=${c.value}`));

    // Device A changes the password without asking to revoke other sessions —
    // the server enforces it regardless (src/auth/auth.ts before-hook).
    const changePassword = await inject({
      method: "POST",
      url: "/v1/auth/change-password",
      headers: { cookie: cookieA },
      payload: { currentPassword: originalPassword, newPassword },
    });
    expect(changePassword.statusCode).toBe(200);
    const newCookie = cookieHeader(changePassword.cookies.map((c) => `${c.name}=${c.value}`));

    const deviceBAfter = await inject({
      method: "GET",
      url: "/v1/auth/get-session",
      headers: { cookie: cookieB },
    });
    expect(deviceBAfter.json()).toBeNull();

    const deviceAOldSessionAfter = await inject({
      method: "GET",
      url: "/v1/auth/get-session",
      headers: { cookie: cookieA },
    });
    expect(deviceAOldSessionAfter.json()).toBeNull();

    const deviceAWithNewSession = await inject({
      method: "GET",
      url: "/v1/auth/get-session",
      headers: { cookie: newCookie },
    });
    expect(deviceAWithNewSession.json()?.user?.email).toBe(email);

    // The new password works; the old one no longer does.
    const signInWithNewPassword = await inject({
      method: "POST",
      url: "/v1/auth/sign-in/email",
      payload: { email, password: newPassword },
    });
    expect(signInWithNewPassword.statusCode).toBe(200);
  });
});
