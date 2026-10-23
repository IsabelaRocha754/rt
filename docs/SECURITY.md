# Security & Privacy — Plate (codename)

Mandatory for every change. If a task would violate anything here, stop and ask.

References: OWASP ASVS (API), OWASP MASVS (mobile), OWASP API Security Top 10.

---

## 1. Checklist

Each item says **how** it's done in this stack. During Phase 7, add evidence (test name, CI job, config) after each item.

### Secrets & keys

- [ ] **Hide API keys.** All secrets (DB URLs, auth secret, OAuth secrets, Google Places key, S3 keys, email key, encryption key) live only in `.env` locally and in the host's secret manager in staging/prod. The mobile app and admin bundle contain **no secrets** — only `API_URL`, `SENTRY_DSN`, `APP_NAME`. CI greps the built mobile bundle for key patterns and fails if found. Google Places key is restricted to the Places API (New) and has a billing budget alert.
- [ ] **Purge git secrets.** gitleaks runs as a pre-commit hook and in CI on every push and PR (full history on `main`). `.env*` is gitignored except `.env.example`. **If a secret is ever committed:** (1) rotate/revoke it immediately — assume it's compromised; (2) then remove it from history with `git filter-repo`, force-push, and ask collaborators to re-clone; (3) record it in the incident log. Purging history never replaces rotation.
- [ ] **"Public DB key" → not applicable by design.** That pattern belongs to Supabase/Firebase, where the app talks to the DB directly. Here the app talks only to our API; there is **no database key of any kind in the client**. The DB accepts connections only from the API/worker with credentials kept server-side, over TLS.

### Database

- [ ] **Enable row-level security.** `ENABLE` + `FORCE ROW LEVEL SECURITY` on every table with user data. API connects as `app_user` (not owner, no `BYPASSRLS`). Each request's queries run in a transaction with `SET LOCAL app.user_id`. Policies mirror the service-layer rules in TRD §5. RLS is the **second** layer; service-layer checks are the first. A test connects as `app_user` without `app.user_id` and asserts it can read nothing private.
- [ ] **Parameterize queries.** All DB access via Drizzle query builder or its `sql` tagged template (which parameterizes). No string concatenation into SQL, no `sql.raw` with user input (lint rule bans `sql.raw` outside migrations).
- [ ] **Encrypt sensitive data.**
  - In transit: TLS everywhere (client↔API, API↔DB with `sslmode=require` or stricter, API↔S3, API↔Google).
  - At rest: managed Postgres and R2 provider encryption; backups encrypted.
  - Field-level: OAuth provider access/refresh tokens encrypted at rest via Better Auth's own `account.encryptOAuthTokens: true` (`src/auth/auth.ts`), keyed from `BETTER_AUTH_SECRET` rather than a separate `FIELD_ENCRYPTION_KEY` — that var is reserved for future sensitive fields this project encrypts itself in the repo layer.
  - Passwords are **hashed, not encrypted** (see below).
  - IP addresses in security logs are stored hashed (HMAC) and kept ≤ 90 days.
  - Data exports stored in a private bucket, deleted after 24 h.

### Authentication & sessions

- [ ] **Hash passwords.** Handled by Better Auth (memory-hard algorithm: scrypt by default; argon2id acceptable). Never implement hashing by hand, never log or return password fields. Minimum 10 characters; reject passwords found in breach lists.
- [ ] **Enforce server-side auth.** Every route is authenticated by default (Fastify `onRequest` hook); public routes must be explicitly listed (`/health`, auth routes, `GET /lists/share/:slug`). Client-side checks (hidden buttons) are UX only and never trusted. Email verification required before any write that's visible to others.
- [ ] **Secure session cookies (admin web) / secure token storage (mobile).**
  - Admin panel: cookies `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`, short idle timeout (30 min), absolute timeout (12 h), CSRF protection on state-changing requests, TOTP 2FA required for admin accounts.
  - Mobile: native apps don't use browser cookies; session tokens are stored in **expo-secure-store** (Keychain / Keystore) via Better Auth's Expo integration — never in AsyncStorage, logs, or URLs.
  - Sessions are revocable; password change/reset revokes all other sessions; "sign out of all devices" exists.
- [ ] **Rate-limit login.** Two layers, both keyed by IP: Better Auth's own limiter (`storage: "database"`, persists across restarts) gives sign-in/sign-up/password-reset/verification-resend a 5/min cap; `@fastify/rate-limit`, applied only to those same routes, adds a coarser 20/hour cap on top. Same for signup, password reset, and verification-email resend. Generic error messages to avoid account enumeration. Better Auth's `auth.handler` runs behind a plain `fetch` `Request` with no socket, so it can't see the caller's IP by itself — `src/plugins/auth.ts` sets a server-trusted `x-real-ip` header from Fastify's own `request.ip` on every forwarded request, and `src/auth/auth.ts` lists it in `advanced.ipAddress.ipAddressHeaders`; without this it silently falls back to one shared bucket for every client. Account-identifier-keyed limiting (not just IP) is not yet implemented — revisit once credential-stuffing patterns justify it.
- [ ] **Add bot protection.**
  - Rate limits on signup, login, follow, like, comment, report, restaurant submission, autocomplete.
  - Email verification before posting; new accounts (< 24 h) get lower limits.
  - Disposable-email domain blocklist at signup (`packages/shared/src/auth.ts`'s `DISPOSABLE_EMAIL_DOMAINS`, checked in `src/auth/auth.ts`'s `hooks.before`) — a curated list of ~30 common throwaway-mail providers, not exhaustive.
  - Device attestation before launch: Apple App Attest / Google Play Integrity token checked on signup and login (Phase 7). Cloudflare Turnstile on the admin login page.
  - Anomaly alerts: spikes in signups or 429s from one source.

### Authorization

- [ ] **Lock record access (no IDOR).** Every read/write loads the record **with** an ownership/visibility condition (`WHERE id = $1 AND user_id = $session`) or calls `canView`. UUIDv7 IDs (not guessable sequences — but never relied upon as security). Tests: for every endpoint, another user gets 404 (not 403, to avoid confirming existence) for private resources.
- [ ] **Block field tampering (mass assignment).** Request schemas are Zod `.strict()` objects listing only client-editable fields; unknown keys → 400. Server sets `user_id`, `author_id`, `owner_id`, `role`, `plan`, `status`, `created_by`, `approved_*`, timestamps. Enum and numeric ranges validated (rating 1–10, price ≥ 0). Tests send forbidden fields and assert rejection.
- [ ] **Admin authorization** checked on every `/v1/admin/*` request (role from DB, not token claim cache older than the session).

### Input & output

- [ ] **Validate all input.** Zod schemas for params, query, body, and headers we read; limits from `packages/shared` (lengths, counts, ranges). Strings trimmed, Unicode-normalized (NFC), control characters stripped; usernames restricted to `[a-z0-9_.]`. Body size limit (100 KB JSON). Validation happens on the server even if the client also validates.
- [ ] **Escape user content.** User text is stored raw and rendered only as plain text: React Native `<Text>` (no HTML rendering), React in admin with default escaping, **no** `dangerouslySetInnerHTML`, no Markdown/HTML rendering, no WebViews showing user content. The list share page (if rendered server-side) uses an auto-escaping template. Links in reviews are not auto-linked in v1.
- [ ] **Restrict file uploads.** Only via a presigned PUT to a quarantine bucket, with the client's declared content type and byte length checked against the allowlist/5 MB cap _before_ signing (`src/storage/s3.ts`'s `createUploadUrl`) — both values are then part of the SigV4 signature, so a PUT that actually sends something else fails before S3 stores anything; allowlist JPEG/PNG/WebP/HEIC; 5 MB max enforced there and again on processing; magic-byte check (`src/photos/pipeline.ts`'s `detectImageType`, checked before sharp ever decodes the bytes); decode + re-encode with sharp; strip all metadata (EXIF/GPS — sharp only keeps it if `.withMetadata()` is called, which this never does); max dimensions; random object keys; quarantine objects never served and always deleted (success or failure, via `finally`); max 4 photos per log (Phase 3; avatars are one key, not a list); orphan cleanup (Phase 3, once the job queue exists — see TRD §8/§9). Uploads are reportable and removable by admins (Phase 6).
- [ ] **Trim API responses.** Every route has a Zod **response** schema; Fastify serializes only declared fields. Never return: email (except to its owner), password/hash, tokens, `role`/`plan`/`status` of others, internal flags, quarantine keys, IP data, Google raw payloads beyond the field mask. Errors return `{ error: { code, message } }` without stack traces or SQL.

### Transport & headers

- [ ] **Add security headers.** `@fastify/helmet` on the API and admin: `Strict-Transport-Security: max-age=31536000; includeSubDomains`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY` / `frame-ancestors 'none'`, strict `Content-Security-Policy` on admin and share pages, `Cross-Origin-Resource-Policy`. CORS: allowlist only the admin origin (mobile doesn't need CORS); never `*` with credentials.
- [ ] **Force HTTPS.** Platform TLS termination with HTTP→HTTPS redirect and HSTS; API refuses to start in production with non-`https` URLs in config; mobile uses HTTPS only (iOS ATS defaults on, Android `usesCleartextTraffic=false` in release builds). Presigned URLs are HTTPS.

### Dependencies & supply chain

- [ ] **Scan dependencies.** Dependabot (npm + GitHub Actions), `pnpm audit --audit-level=high` and OSV-Scanner in CI (fail on high/critical), CodeQL for JS/TS. Lockfile committed; exact versions pinned; new dependencies require approval (CLAUDE.md rule 9). GitHub Actions pinned to commit SHAs. Docker image based on a slim official Node LTS image, rebuilt weekly, runs as non-root.
  - **Tracked exceptions**, dated 2026-10-19 — no patched version upstream, or forcing the patch breaks a tool we rely on; dev-tooling-only in every case, never shipped to end users. Re-check at the start of every phase.
    - `GHSA-86w9-cpqp-85rv` (node-forge, via `@expo/cli`) — no patched version upstream.
    - `GHSA-vfj7-8cjw-p6xm` (braces, via Metro's `micromatch`) — no patched version upstream.
    - `GHSA-hp3w-g68c-fv3c` (sprintf-js, via Jest's istanbul coverage chain) — no patched version upstream.
    - `GHSA-3ppc-4f35-3m26`, `GHSA-7r86-cg39-jmmj`, `GHSA-23c5-xmqv-rm74` (minimatch, `eas-cli`'s own direct dependency, pinned at 5.1.2) — a patched version (5.1.8) exists, but forcing it via `overrides` breaks `eas` at runtime (`TypeError: minimatch_1.minimatch is not a function`) under this monorepo's `node-linker=hoisted` setting: hoisting forces every consumer in the tree onto one physical copy, and `eas-cli`'s compiled code expects the exact API shape of 5.1.2, not 5.1.8's. Re-test this exception whenever `eas-cli` is upgraded — a newer release may no longer hit this.
    - `pnpm audit` reads these from `pnpm-workspace.yaml` → `audit.ignore`; OSV-Scanner (a separate tool, run in CI with `--config=./osv-scanner.toml`) reads the same six IDs from `osv-scanner.toml`'s `[[IgnoredVulns]]` — both files must be kept in sync.
  - **Fixed via `pnpm-workspace.yaml` → `overrides`**: `esbuild` (0.25.0), `uuid` (11.1.1), `@babel/core` (7.29.7), `nanoid` (3.3.18), `tar` (7.5.21), `joi` (17.13.7) — patched versions existed upstream and forcing them doesn't break anything, so these are forced across the whole dependency tree rather than exempted.

### Logging & monitoring

- [ ] Structured logs with redaction (`authorization`, `cookie`, `password`, `token`, `email`, presigned URLs).
- [ ] Sentry with `sendDefaultPii: false` and a `beforeSend` scrubber; no request bodies attached.
- [ ] `audit_log` for admin actions, role changes, account deletion, password changes.
- [ ] Alerts: error-rate spike, auth 429 spike, Google budget threshold, failed jobs.

### Backups & recovery

- [ ] Managed automated backups with point-in-time recovery where available; one restore drill before launch; documented in `docs/runbooks/restore.md`.

---

## 2. Privacy (LGPD)

- **Data minimization:** collect only what features need. No birthdate stored — only the 18+ confirmation timestamp. No contacts upload. Location used only to bias a search request and **never stored or logged**.
- **Legal bases:** contract execution (account, core features); legitimate interest (security logs, abuse prevention); consent where required. Documented in the Privacy Policy.
- **User rights:** in-app data export; in-app account deletion (content hidden immediately, hard-deleted within 30 days, backups expire on their normal rotation); profile editing; privacy controls.
- **Companion tags** require consent of the tagged person (approval) and are removable by them.
- **Photos:** metadata stripped so location isn't leaked.
- **International transfer:** hosting may be outside Brazil (US region initially); the Privacy Policy must disclose this and the safeguards used.
- **Processors:** list hosting, DB, storage, email, Sentry, Google in the Privacy Policy.
- **Encarregado (DPO) contact:** an email address published in the Privacy Policy.
- **Incident response:** documented steps (contain, rotate secrets, assess, notify ANPD and affected users when required).

## 3. Legal & age

- **Minimum age 18.** Brazil's ECA Digital (Lei 15.211/2025, in force since 17 March 2026) applies to services likely to be accessed by under-18s and forbids self-declaration as the age-check mechanism. Policy for v1:
  - Store age rating set to 18+ on both stores.
  - Signup requires 18+ confirmation and, where the platform exposes an age signal API, the app reads it and blocks under-18 accounts.
  - Terms of Service state the 18+ requirement; reports of underage users lead to account suspension.
- **Get a legal review** of the age policy, Terms of Service and Privacy Policy before launch. These docs are engineering requirements, not legal advice.
- **Google Maps Platform terms:** caching limits, attribution requirements, field masks — verify before Phase 2 and re-check yearly.
- **Store policies:** Sign in with Apple (required when offering Google sign-in on iOS), in-app account deletion, UGC moderation (report, block, removal, published contact).

## 4. Threat model (summary)

| Threat                                 | Main controls                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------- |
| Account takeover (credential stuffing) | Rate limits, breached-password check, generic errors, attestation, session revocation |
| Reading private profiles/logs (IDOR)   | Service-layer checks + RLS + visibility test matrix                                   |
| Privilege escalation via request body  | Strict schemas, server-set fields, tests                                              |
| Stalking via photos/location           | EXIF stripping, no stored location, tag approval, block                               |
| Harassment/spam in comments            | Rate limits, verification, report/block/mute, admin removal                           |
| Malicious file upload                  | Quarantine, magic bytes, re-encode, size/type limits                                  |
| Leaked secrets                         | gitleaks, no client secrets, rotation procedure, restricted keys                      |
| Google bill spike / key abuse          | Server-only key, restrictions, per-user limits, cache, budget alerts                  |
| Vulnerable dependency                  | Dependabot, audit/OSV, CodeQL, pinned versions                                        |
| Data loss                              | Automated backups, restore drill                                                      |

## 5. Rules for the coding agent

1. Never print, log, or echo secrets — including in test output and error messages.
2. Never disable a check (TLS verification, RLS, rate limit, CSRF, validation) to make something work. Ask instead.
3. Every new endpoint ships with: auth, request schema (`.strict()`), response schema, authorization check, and a cross-user access test.
4. Every new table with user data ships with RLS policies in the same migration.
5. Any new user-generated field gets a length limit in `packages/shared` and is rendered as plain text.
6. Security-relevant changes use the `sec:` commit prefix and update this document.
