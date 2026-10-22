import { createHash } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../src/app.js";
import { buildTestEnv, clearRateLimit, injectAs, uniqueEmail } from "../helpers/env.js";

type SendEmail = (env: unknown, to: string, url: string) => Promise<void>;

const { sendVerificationEmail, sendPasswordResetEmail } = vi.hoisted(() => ({
  sendVerificationEmail: vi.fn<SendEmail>(async () => {}),
  sendPasswordResetEmail: vi.fn<SendEmail>(async () => {}),
}));

vi.mock("../../src/email.js", () => ({ sendVerificationEmail, sendPasswordResetEmail }));

const PASSWORD = "correct-horse-battery";

function tokenFromUrl(url: string): string {
  const token = new URL(url).searchParams.get("token");
  if (!token) throw new Error("verification URL had no token");
  return token;
}

const REMOTE_ADDRESS = "203.0.113.10";

describe("email+password auth (DEV_PLAN Phase 1)", () => {
  const env = buildTestEnv();
  const app = buildApp(env);
  const inject = injectAs(app, REMOTE_ADDRESS);

  beforeAll(() => clearRateLimit(env, REMOTE_ADDRESS));
  beforeEach(() => {
    sendVerificationEmail.mockClear();
    sendPasswordResetEmail.mockClear();
  });

  afterAll(async () => {
    await app.close();
  });

  it("requires verification before sign-in, then allows it once verified", async () => {
    const email = uniqueEmail("verify-flow");

    const signUp = await inject({
      method: "POST",
      url: "/v1/auth/sign-up/email",
      payload: { name: "Test User", email, password: PASSWORD },
    });
    expect(signUp.statusCode).toBe(200);
    expect(signUp.json().token).toBeNull();
    expect(sendVerificationEmail).toHaveBeenCalledTimes(1);

    const blocked = await inject({
      method: "POST",
      url: "/v1/auth/sign-in/email",
      payload: { email, password: PASSWORD },
    });
    expect(blocked.statusCode).toBe(403);
    expect(blocked.json().code).toBe("EMAIL_NOT_VERIFIED");

    const verifyUrl = sendVerificationEmail.mock.calls[0]?.[2] as string;
    const verify = await inject({
      method: "GET",
      url: `/v1/auth/verify-email?token=${tokenFromUrl(verifyUrl)}`,
    });
    expect(verify.statusCode).toBe(200);
    expect(verify.json().status).toBe(true);

    const signIn = await inject({
      method: "POST",
      url: "/v1/auth/sign-in/email",
      payload: { email, password: PASSWORD },
    });
    expect(signIn.statusCode).toBe(200);
    expect(typeof signIn.json().token).toBe("string");
  });

  it("rejects passwords shorter than the minimum length", async () => {
    const response = await inject({
      method: "POST",
      url: "/v1/auth/sign-up/email",
      payload: { name: "Too Short", email: uniqueEmail("short-pw"), password: "short123" },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("PASSWORD_TOO_SHORT");
  });

  it("rejects a password found in a breach (have I been pwned)", async () => {
    const breachedPassword = "definitely-breached-password";
    const sha1 = createHash("sha1").update(breachedPassword).digest("hex").toUpperCase();
    const suffix = sha1.slice(5);
    vi.mocked(fetch).mockImplementationOnce(
      async () => new Response(`${suffix}:12`, { status: 200 }),
    );

    const response = await inject({
      method: "POST",
      url: "/v1/auth/sign-up/email",
      payload: { name: "Breached", email: uniqueEmail("breached-pw"), password: breachedPassword },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("PASSWORD_COMPROMISED");
  });

  it("rejects signup with a disposable email domain", async () => {
    const response = await inject({
      method: "POST",
      url: "/v1/auth/sign-up/email",
      payload: {
        name: "Throwaway",
        email: `throwaway-${Date.now()}@mailinator.com`,
        password: PASSWORD,
      },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("disposable_email");
  });

  it("ignores emailVerified/role fields sent in the signup body (mass assignment)", async () => {
    const email = uniqueEmail("mass-assignment");

    const signUp = await inject({
      method: "POST",
      url: "/v1/auth/sign-up/email",
      payload: {
        name: "Sneaky",
        email,
        password: PASSWORD,
        emailVerified: true,
        role: "admin",
      },
    });
    expect(signUp.statusCode).toBe(200);
    expect(signUp.json().user.emailVerified).toBe(false);

    const signIn = await inject({
      method: "POST",
      url: "/v1/auth/sign-in/email",
      payload: { email, password: PASSWORD },
    });
    // Still blocked — the server, not the request body, decided emailVerified.
    expect(signIn.statusCode).toBe(403);
  });

  it("returns a generic error for sign-in with a non-existent account (no enumeration)", async () => {
    const response = await inject({
      method: "POST",
      url: "/v1/auth/sign-in/email",
      payload: { email: uniqueEmail("nobody"), password: PASSWORD },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json().code).toBe("INVALID_EMAIL_OR_PASSWORD");
  });
});
