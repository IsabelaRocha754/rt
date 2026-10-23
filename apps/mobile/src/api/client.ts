import Constants from "expo-constants";
import { authClient } from "../auth/client";

const apiUrl: string = Constants.expoConfig?.extra?.apiUrl ?? "http://localhost:3000";

// Better Auth's Expo client stores the session outside normal cookie jars
// (SecureStore) — @better-auth/expo/client docs: attach it manually and
// pass `credentials: "omit"` so the platform's own (empty) cookie handling
// doesn't interfere.
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const cookie = await authClient.getCookie();
  const headers = new Headers(init.headers);
  if (cookie) headers.set("Cookie", cookie);
  return fetch(`${apiUrl}${path}`, { ...init, headers, credentials: "omit" });
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const data = await response.json().catch(() => null);
  return data?.error?.message ?? fallback;
}

export async function apiFetchJson<T>(
  path: string,
  init: RequestInit = {},
  fallbackErrorMessage = "Something went wrong.",
): Promise<T> {
  const response = await apiFetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  if (!response.ok) {
    throw new ApiError(await readErrorMessage(response, fallbackErrorMessage), response.status);
  }
  return response.json() as Promise<T>;
}
