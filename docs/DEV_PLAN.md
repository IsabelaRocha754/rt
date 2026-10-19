# Dev Plan — Plate (codename)

Build in this order. Each phase ends with acceptance criteria; don't start the next phase until they pass. Each phase is a series of small PRs.

Security work is **inside** every phase, not saved for the end. Phase 7 is a review, not the first time security is considered.

---

## Phase 0 — Foundation

**Tasks**

- pnpm monorepo: `apps/mobile`, `apps/api`, `apps/admin`, `packages/shared`; TypeScript strict; shared ESLint + Prettier config.
- `docker-compose.yml`: Postgres 16 + a local S3-compatible server (with buckets: quarantine, public, private) — see `docs/TRD.md` §2a for why `zenko/cloudserver` replaces MinIO locally.
- API skeleton: Fastify, Zod type provider, env validation (refuse to start on missing/insecure config), helmet, CORS allowlist, rate-limit plugin, central error handler (no stack traces in prod), structured logging with redaction, `/health`.
- Drizzle setup; DB roles `app_owner` / `app_user` / `app_worker`; first migration; RLS helper (`withUserTx(userId, fn)` that sets `app.user_id`).
- Mobile skeleton: Expo Router tabs, theme tokens (light/dark), i18n with both locales, TanStack Query, API client with base URL from config.
- `.gitignore` (incl. `.env*` except `.env.example`), `.env.example`.
- Pre-commit hooks (lint-staged + **gitleaks**).
- GitHub Actions: install → lint → typecheck → test (with Postgres service) → gitleaks → dependency audit (`pnpm audit --audit-level=high` + OSV-Scanner) → CodeQL. Dependabot enabled.
- Root scripts listed in `CLAUDE.md` § Commands.

**Acceptance**

- `pnpm lint && pnpm typecheck && pnpm test` green locally and in CI.
- API boots against compose DB; `/health` returns 200 with security headers present.
- Mobile app runs in Expo Go/dev build on an Android device and shows the five tabs in both languages and themes.
- A deliberately committed fake secret is caught by the pre-commit hook and by CI.

## Phase 1 — Auth & profiles

**Tasks**

- Better Auth: email+password (verification required, reset flow), Google, Apple; Expo integration with tokens in SecureStore.
- Password policy (min 10, breached-password check), login rate limit + progressive delay, generic auth errors.
- Session revocation on password change; "sign out of all devices".
- `profiles` table + RLS; username rules + reserved list; `GET/PATCH /me`; public profile endpoint respecting `canView`.
- Signup flow screens F1–F2; 18+ and terms acceptance stored with version.
- Avatar upload through the photo pipeline (pipeline built here, reused in Phase 3).
- Security tests: mass-assignment (`role`, `plan`, `status` in body ignored/rejected), unverified user can't post, auth endpoints rate-limited.

**Acceptance**

- Sign up/in/out works with all three methods on Android (iOS via EAS + TestFlight once Apple account exists).
- PATCH `/me` with `{ "role": "admin" }` → 400 and role unchanged (test).
- 6th failed login in a minute → 429 (test).

## Phase 2 — Restaurants & search

**Tasks**

- Verify current Google Maps Platform terms and pricing; set `PLACE_CACHE_TTL` and field masks accordingly; configure API key restrictions and budget alerts.
- `/places/autocomplete` proxy with session tokens, per-user rate limit.
- `/restaurants/google/:placeId` (upsert restaurant row + cached details).
- User-submitted restaurants (`pending`), duplicate suggestion, daily limit.
- Search screen, Restaurant screen (without social sections yet), location permission flow.
- Fallback search over local restaurants.

**Acceptance**

- Searching "pizza" in Bauru returns results; the mobile bundle contains no Google key (grep the built bundle in CI).
- Pending restaurants invisible to other users (test).
- Google usage counters visible in logs.

## Phase 3 — Logging

**Tasks**

- `logs`, `log_dishes`, `log_photos`, `log_companions` + RLS.
- CRUD endpoints with full validation (limits from `packages/shared`).
- Photo pipeline for logs (presign → upload → process → ready), quarantine cleanup job.
- Log form, log detail, diary on profile, want-to-go prompt.
- Companion tag requests + accept/decline/remove-self.
- IDOR tests: user B can't read/edit/delete user A's private log, photos, or dishes; can't add dishes to A's log.

**Acceptance**

- A rating-only log can be saved in ≤ 3 taps after picking the restaurant.
- A photo with GPS EXIF comes out with no metadata (test with a fixture).
- Uploading a renamed `.exe` as `.jpg` → rejected (test).

## Phase 4 — Social

**Tasks**

- Follows (public/private, requests, remove follower), blocks, mutes — all enforced in service + RLS.
- Feed endpoint + screen.
- Likes and comments (logs, lists, comments-likes), rate limits per action.
- Notifications table + Activity screen.
- Visibility test matrix: {public, private} × {follower, non-follower, blocked, self, unauthenticated} × {profile, logs, lists, comments, tags}.

**Acceptance**

- Full visibility matrix passes.
- Blocking removes follows both ways and hides content everywhere (test).

## Phase 5 — Lists, want-to-go, stats

**Tasks**

- Want-to-go endpoints/screens.
- Lists CRUD, ranked ordering, notes, share slug + public share endpoint (public owners only).
- Profile stats + Year in review (SQL aggregates; consider precompute job).

**Acceptance**

- A private user's list share link returns 404 (test).
- Year in review renders correctly with seeded data across 12 months.

## Phase 6 — Safety, privacy & admin

**Tasks**

- Reports endpoint + Report sheet everywhere.
- Admin panel: separate origin, cookie session (`HttpOnly`, `Secure`, `SameSite=Strict`), CSRF protection, TOTP 2FA required for admins; reports queue, pending restaurants, remove content, suspend user, audit log.
- Data export job + download.
- Account deletion flow + hard-delete job (DB rows + objects + Better Auth records).
- Privacy Policy + Terms pages (PT-BR/EN) linked in-app.
- Sentry with PII scrubbing in mobile and API.

**Acceptance**

- Deleting an account removes all rows and objects for that user (test with a seeded user, then query every table).
- Non-admin calling `/v1/admin/*` → 403 (test); admin without 2FA can't access the panel.
- Export contains all of the user's own data and none of anyone else's.

## Phase 7 — Hardening & launch

**Tasks**

- Walk through every item in `SECURITY.md` §Checklist and record evidence (test name, config screenshot, or CI job) next to each item.
- Run OWASP ZAP baseline scan against staging; fix findings.
- Review against OWASP MASVS (mobile) for storage, network, platform interaction.
- Load test feed and log creation on staging.
- Backups: verify automated backups and do one restore drill.
- Maestro E2E for F1, F3, F4, F8, F10, F14.
- Store assets, privacy labels / Data safety form, 18+ age rating, review notes with a demo account.
- Internal testing: TestFlight + Google Play internal track with a few friends.

**Acceptance**

- `MVP_SCOPE.md` § MVP release criteria all met.

---

## Working agreement for the coding agent

- One task per branch/PR; keep PRs under ~400 changed lines where possible.
- Write tests first for authorization rules.
- When a decision isn't covered by the docs, stop and ask; then record the answer in the relevant doc.
- Never weaken a security control to make a test pass.
