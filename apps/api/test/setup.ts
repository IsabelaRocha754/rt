import { afterEach, beforeEach, vi } from "vitest";

// The haveIBeenPwned plugin (src/auth/auth.ts) calls out to a real external
// API on every sign-up/password-change and fails CLOSED on any network
// error (rejects the password) — see its vendored behavior notes. Tests run
// offline/in CI with no route to that host, so every test gets a safe
// "not compromised" response by default; test/auth/have-i-been-pwned.test.ts
// overrides this once to exercise the actual breach-rejection path.
const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.startsWith("https://api.pwnedpasswords.com/range/")) {
        return new Response("", { status: 200 });
      }
      return originalFetch(input, init);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});
