import { apiFetch, apiFetchJson } from "./client";

export interface Me {
  id: string;
  email: string;
  emailVerified: boolean;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  avatarKey: string | null;
  isPrivate: boolean;
  locale: string;
  role: "user" | "admin";
  plan: "free" | "premium";
  status: "active" | "suspended";
  ageConfirmedAt: string | null;
  termsAcceptedAt: string | null;
  termsVersion: string | null;
  createdAt: string;
  updatedAt: string;
}

// `null` means "no session" — distinct from a thrown error, so callers can
// route to the welcome screen without treating it as a failure to report.
export async function fetchMe(): Promise<Me | null> {
  const response = await apiFetch("/v1/me");
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(`GET /v1/me failed: ${response.status}`);
  return response.json() as Promise<Me>;
}

export interface PatchMeBody {
  username?: string;
  displayName?: string | null;
  bio?: string | null;
  isPrivate?: boolean;
  locale?: "pt-BR" | "en";
}

export function patchMe(body: PatchMeBody): Promise<Me> {
  return apiFetchJson<Me>("/v1/me", { method: "PATCH", body: JSON.stringify(body) });
}

export function acceptTerms(termsVersion: string): Promise<Me> {
  return apiFetchJson<Me>("/v1/me/accept-terms", {
    method: "POST",
    body: JSON.stringify({ ageConfirmed: true, termsVersion }),
  });
}

interface AvatarUploadTarget {
  url: string;
  key: string;
  headers: Record<string, string>;
}

// Takes the already-read file blob (not just a URI) so its exact byte
// size is known upfront — that size is what gets checked against the
// allowlist/cap and signed into the upload URL (apps/api/src/storage/
// s3.ts), so it has to be the real number, not a guess.
export async function uploadAvatar(bytes: Blob, contentType: string): Promise<Me> {
  const target = await apiFetchJson<AvatarUploadTarget>("/v1/me/avatar/upload-url", {
    method: "POST",
    body: JSON.stringify({ contentType, contentLength: bytes.size }),
  });

  const upload = await fetch(target.url, { method: "PUT", headers: target.headers, body: bytes });
  if (!upload.ok) throw new Error(`Avatar upload failed: ${upload.status}`);

  return apiFetchJson<Me>("/v1/me/avatar/complete", {
    method: "POST",
    body: JSON.stringify({ key: target.key }),
  });
}
