# TRD — Plate (codename)

Technical requirements: architecture, stack, data model, API and access rules. Security requirements are in `SECURITY.md` and apply on top of everything here.

## 1. Architecture

```
┌──────────────┐   HTTPS (bearer token)   ┌───────────────┐   TLS   ┌──────────────┐
│ Mobile app   │ ───────────────────────▶ │ API (Fastify) │ ──────▶ │ PostgreSQL   │
│ Expo / RN    │                          │ Docker on PaaS│         │ (RLS on)     │
└──────┬───────┘                          └──┬─────┬──────┘         └──────────────┘
       │ presigned PUT (photo upload)         │     │
       ▼                                      │     │ server-side key
┌──────────────┐  quarantine → processed      │     ▼
│ Object store │ ◀────────────────────────────┘  ┌─────────────────┐
│(R2 / local S3)│                                │ Google Places   │
└──────────────┘                                 │ API (New)       │
                                                 └─────────────────┘
┌──────────────┐   HTTPS (secure cookie session)
│ Admin panel  │ ─────────────────────────────▶ API /v1/admin/*
└──────────────┘
```

- The mobile app **never** talks to the database, Google, or the bucket with credentials. It only knows the API base URL. Photo uploads use one-time presigned URLs issued by the API.
- There is **no public database key** in this architecture (that concept belongs to Supabase/Firebase). The DB is reachable only from the API's private network/credentials.

## 2. Stack

| Layer            | Choice                                                                        | Notes                                                  |
| ---------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------ |
| Language         | TypeScript (strict) everywhere                                                | Shared types in `packages/shared`                      |
| Package manager  | pnpm workspaces                                                               | Lockfile committed                                     |
| Mobile           | Expo (managed) + React Native, Expo Router                                    | EAS Build/Submit/Update; no Mac needed                 |
| Mobile data      | TanStack Query                                                                | Caching, retries, optimistic likes                     |
| Forms            | react-hook-form + Zod                                                         | Same schemas as the API                                |
| Mobile storage   | expo-secure-store (tokens), nothing sensitive in AsyncStorage                 |                                                        |
| i18n             | i18next + expo-localization                                                   | `pt-BR`, `en`                                          |
| Images (client)  | expo-image-picker, expo-image-manipulator, expo-image                         | Client resizes before upload; server re-encodes anyway |
| Location         | expo-location, "while in use" only                                            | Search bias only                                       |
| API              | Fastify + `fastify-type-provider-zod`                                         | Request **and** response schemas                       |
| Fastify plugins  | @fastify/helmet, @fastify/cors, @fastify/rate-limit, @fastify/sensible        |                                                        |
| ORM              | Drizzle ORM + drizzle-kit migrations                                          | Parameterized queries                                  |
| Auth             | Better Auth (+ Expo plugin)                                                   | Email/password, Google, Apple, email verification      |
| Email            | Transactional provider (e.g. Resend)                                          | Verification, password reset                           |
| Image processing | sharp (in API worker)                                                         | Re-encode, strip metadata                              |
| Jobs             | pg-boss (Postgres-backed queue)                                               | Photo processing, export, deletion, cache refresh      |
| DB               | PostgreSQL 16                                                                 | `citext`, RLS                                          |
| Object storage   | Cloudflare R2 (prod), LocalStack S3 (local)                                   | S3 API — see §2a                                       |
| Admin            | Vite + React + TypeScript                                                     | Separate origin, cookie session                        |
| Monitoring       | Sentry (mobile + API)                                                         | `sendDefaultPii: false`, scrubbing                     |
| Testing          | Vitest, Fastify `inject`, Testcontainers; Jest + RNTL; Maestro (E2E, Phase 7) |                                                        |
| CI               | GitHub Actions                                                                | See DEV_PLAN Phase 0                                   |
| Hosting          | Render or Railway (API container + managed Postgres), US-East to start        | Portable via Docker                                    |

### 2a. Local object storage: zenko/cloudserver, not MinIO

Phase 0 originally planned MinIO for local S3-compatible storage. Both
MinIO's own container images (`quay.io/minio/minio`, `quay.io/minio/mc`,
401 on anonymous pull) and LocalStack (its S3 service now refuses to start
without a `LOCALSTACK_AUTH_TOKEN`) turned out to require a registry login
or paid license just to boot — not a local misconfiguration (verified:
anonymous pulls of other images from the same registries succeed fine).
`docker-compose.yml` uses `zenko/cloudserver` instead: a plain,
single-container, unauthenticated S3-compatible server (Scality's open-source
S3 Server) with no account or token of any kind. Bucket creation runs via a
one-shot `amazon/aws-cli` init container (`s3-init` in `docker-compose.yml`)
instead of an `mc`/`awslocal`-based one. Local `.env` values:
`S3_ENDPOINT=http://localhost:4566`, `S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY=test`.
Production still targets Cloudflare R2 either way — this only affects the
local dev stack. Re-check this choice periodically: free-tier S3-compatible
dev tooling has been moving towards paid licensing industry-wide.

## 3. Repository layout

```
plate/
├── CLAUDE.md
├── docs/
├── apps/
│   ├── mobile/          # Expo app (app/ for Expo Router routes)
│   ├── api/             # Fastify app
│   │   ├── src/
│   │   │   ├── modules/<feature>/{routes,service,repo,schemas}.ts
│   │   │   ├── db/{schema,migrations,rls}
│   │   │   ├── plugins/ # auth, rate-limit, helmet, errors
│   │   │   └── jobs/
│   │   └── test/
│   └── admin/
├── packages/
│   └── shared/          # Zod schemas, types, constants (limits, enums)
├── docker-compose.yml   # postgres, localstack (S3)
├── .env.example
└── .github/workflows/
```

Each API module follows `routes → service → repo`. Routes validate and authenticate; services hold business and authorization rules; repos are the only place that queries the DB.

## 4. Data model

All tables: `id uuid` (UUIDv7) primary key unless noted, `created_at timestamptz default now()`, `updated_at` where rows change. Soft delete (`deleted_at`) only where noted; account deletion hard-deletes (see SECURITY §Privacy).

Auth tables (`user`, `session`, `account`, `verification`) are managed by Better Auth. App profile data lives in `profiles`, 1:1 with the auth user.

Google and Apple sign-in (`src/auth/auth.ts`) are each wired in only once their own env vars are fully set (`env.ts` rejects a partial set for either) — the API boots and email+password works with neither configured. Apple's "client secret" is actually a short-lived ES256 JWT that Better Auth expects pre-built (it does not generate one from a team id/key id/private key itself), so `src/auth/apple-client-secret.ts` signs it ourselves at startup from `APPLE_TEAM_ID`/`APPLE_KEY_ID`/`APPLE_PRIVATE_KEY`.

### profiles

| column                           | type                                        | notes                                   |
| -------------------------------- | ------------------------------------------- | --------------------------------------- |
| user_id                          | uuid PK FK → auth user                      |                                         |
| username                         | citext unique                               | 3–30 chars, `[a-z0-9_.]`, reserved list |
| display_name                     | text                                        | ≤ 50                                    |
| bio                              | text null                                   | ≤ 300                                   |
| avatar_key                       | text null                                   | object-store key                        |
| is_private                       | boolean default false                       |                                         |
| locale                           | text default 'pt-BR'                        |                                         |
| role                             | enum(`user`,`admin`) default `user`         | never writable via API body             |
| plan                             | enum(`free`,`premium`) default `free`       | never writable via API body             |
| status                           | enum(`active`,`suspended`) default `active` |                                         |
| age_confirmed_at                 | timestamptz                                 | set at signup (18+ gate)                |
| terms_accepted_at, terms_version | timestamptz, text                           |                                         |

### restaurants

| column                            | type                                | notes                                                           |
| --------------------------------- | ----------------------------------- | --------------------------------------------------------------- |
| source                            | enum(`google`,`user`)               |                                                                 |
| google_place_id                   | text unique null                    | stored permanently (allowed by Google terms)                    |
| status                            | enum(`active`,`pending`,`rejected`) | `google` rows are `active`                                      |
| name, city, neighborhood, address | text null                           | **only for `source = user`**; Google fields are not stored here |
| created_by                        | uuid null FK profiles               | for user-submitted                                              |
| approved_by, approved_at          |                                     | admin moderation                                                |

### place_cache

Short-lived cache of Google Place Details responses (field-masked). `place_id PK`, `payload jsonb`, `fetched_at`, `expires_at`. TTL must comply with current Google Maps Platform terms — **verify the terms before Phase 2** and set the TTL constant in `packages/shared`. A job purges expired rows.

### logs (visits)

| column                 | type                      | notes                                       |
| ---------------------- | ------------------------- | ------------------------------------------- |
| user_id                | uuid FK                   | from session                                |
| restaurant_id          | uuid FK                   | **the only required field**                 |
| visited_on             | date default current_date | `<= current_date`                           |
| rating                 | smallint null             | check 1–10                                  |
| review                 | text null                 | ≤ 5,000 chars                               |
| price_per_person_cents | integer null              | ≥ 0, ≤ 10,000,000                           |
| currency               | char(3) default 'BRL'     | ISO 4217 allowlist                          |
| deleted_at             | timestamptz null          | soft delete (comments/likes cascade hidden) |

### log_dishes

`log_id FK`, `name text ≤ 120`, `rating smallint null (1–10)`, `position smallint`. Max 20 per log.

### log_photos

`log_id FK`, `quarantine_key text`, `storage_key text null`, `status enum(pending, ready, rejected)`, `width`, `height`, `position`. Max 4 per log.

### log_companions

`log_id FK`, `tagged_user_id FK`, `status enum(pending, accepted, declined)`, PK (`log_id`, `tagged_user_id`). Max 10 per log. Shown only when `accepted`.

### follows

`follower_id`, `followee_id`, `status enum(pending, accepted)`, PK pair, check `follower_id <> followee_id`.

### blocks / mutes

`blocker_id`, `blocked_id` PK pair. Same shape for `mutes` (`muter_id`, `muted_id`).

### want_to_go

`user_id`, `restaurant_id`, PK pair.

### lists / list_items

`lists`: `owner_id`, `title ≤ 100`, `description ≤ 1,000`, `is_ranked boolean`, `share_slug text unique` (random, 10+ chars).
`list_items`: `list_id`, `restaurant_id`, `position int`, `note ≤ 500`; unique (`list_id`, `restaurant_id`); max 250 items.

### likes

`user_id`, `target_type enum(log, list, comment)`, `target_id`, PK triple.

### comments

`author_id`, `target_type enum(log, list)`, `target_id`, `body ≤ 1,000`, `deleted_at`.

### notifications

`user_id`, `type enum(follow, follow_request, follow_accepted, like, comment, tag_request, tag_accepted, moderation)`, `actor_id`, `target_type`, `target_id`, `read_at`.

### reports

`reporter_id`, `target_type enum(profile, log, comment, list, photo, restaurant)`, `target_id`, `reason enum(spam, harassment, hate, sexual, violence, false_info, other)`, `details ≤ 500`, `status enum(open, actioned, dismissed)`, `handled_by`, `handled_at`.

### audit_log

Admin and security events: `actor_id`, `action`, `target_type`, `target_id`, `metadata jsonb` (no secrets, no raw PII), `created_at`. Append-only (no UPDATE/DELETE grant).

### Indexes (minimum)

`logs (user_id, visited_on desc)`, `logs (restaurant_id, created_at desc)`, `follows (followee_id, status)`, `comments (target_type, target_id, created_at)`, `notifications (user_id, read_at, created_at desc)`, `lists (owner_id)`.

## 5. Visibility & authorization rules

Implemented in the service layer **and** mirrored in RLS policies (defense in depth). Every rule has tests.

`canView(viewer, owner)`:

1. If either has blocked the other → **false** (both directions).
2. If `viewer == owner` → true.
3. If owner is suspended → false (admins excepted).
4. If owner is public → true.
5. If owner is private → true only if `viewer` follows `owner` with `status = accepted`.

Applies to: profile details beyond username/avatar, logs, lists, want-to-go, stats, follower/following lists.

Additional rules:

- **Unauthenticated access:** only list share links (`/v1/lists/share/:slug`) for public owners. Everything else requires a session.
- **Write ownership:** only the owner edits/deletes their logs, lists, list items, dishes, photos. Comment author or the content owner can delete a comment.
- **Companions:** the tag is visible only if `accepted` **and** the viewer can view the tagged user. Blocked users can't be tagged. A tagged user can remove themselves anytime.
- **Comments/likes:** require `canView(actor, contentOwner)`; blocked users can't interact. Private-account content can only be commented on by approved followers.
- **Feed:** logs from users the viewer follows (accepted), excluding blocked/muted, newest first, cursor-paginated.
- **Pending restaurants:** visible only to the submitter and admins until approved.
- **Admin endpoints:** `role = admin` checked server-side on every request; admin session separate (cookie) from mobile tokens.

### Row-Level Security

- The API connects as role `app_user` (no superuser, no `BYPASSRLS`, not table owner). Migrations run as `app_owner`.
- Each request runs DB work inside a transaction that sets `SET LOCAL app.user_id = '<uuid>'` (and `app.role`).
- `FORCE ROW LEVEL SECURITY` on all user-data tables; policies implement ownership for writes and `canView` (via a `SECURITY DEFINER` SQL function with a fixed `search_path`) for reads.
- Background jobs that need broad access use a separate `app_worker` role with narrowly scoped policies.
- **Exception: Better Auth's own tables** (`user`, `session`, `account`, `verification`, `rate_limit`) do **not** get RLS. Every access to them goes through Better Auth's own parameterized queries, running before any app session/`app.user_id` exists (sign-up, sign-in) — Better Auth itself is the trust boundary here, not a Postgres policy. All other tables with user data still get RLS as above.

## 6. Google Places integration

- Only the API calls Google. Key restricted by API (Places API New only) and stored as a secret. Billing **budget alerts** configured.
- Endpoints:
  - `GET /v1/places/autocomplete?q=&lat=&lng=&sessionToken=` → proxies Autocomplete (New). Client generates a session token per search session.
  - `GET /v1/restaurants/google/:placeId` → ensures a `restaurants` row exists (`source = google`), then returns details from `place_cache` or Place Details (New) with a **minimal field mask** (id, displayName, formattedAddress, location, types, googleMapsUri).
- Never request photo/review/rating fields from Google in v1 (cost + terms). Photos shown are user photos.
- Attribution: display Google attribution where required by the terms.
- Rate-limit and cap per user (e.g. autocomplete 60/min); server-side debounce. Log usage counts (not queries) for cost monitoring.
- If Google is down or the budget cap is hit, search falls back to local restaurants (user-submitted + previously logged).

## 7. API surface (v1)

All under `/v1`. Auth routes are mounted by Better Auth under `/v1/auth/*`. `🔓` = public (no session).

**Me & profiles**

- `GET /me` · `PATCH /me` (display_name, bio, is_private, locale) · `POST /me/avatar/upload-url` · `DELETE /me` (account deletion) · `POST /me/export`
- `GET /users/:username` · `GET /users/:username/logs` · `/lists` · `/want-to-go` · `/stats` · `/followers` · `/following`
- `GET /me/year-in-review?year=`

**Social**

- `POST /users/:id/follow` · `DELETE /users/:id/follow` · `GET /me/follow-requests` · `POST /me/follow-requests/:id/accept|decline` · `DELETE /me/followers/:id` (remove follower)
- `POST /users/:id/block` · `DELETE /users/:id/block` · `POST /users/:id/mute` · `DELETE /users/:id/mute`
- `GET /feed?cursor=`
- `POST /likes` · `DELETE /likes` (`{targetType, targetId}`)
- `GET /comments?targetType=&targetId=` · `POST /comments` · `DELETE /comments/:id`
- `GET /notifications` · `POST /notifications/read`

**Restaurants & search**

- `GET /places/autocomplete` · `GET /restaurants/google/:placeId` · `GET /restaurants/:id` · `GET /restaurants/:id/logs` · `POST /restaurants` (user submission)

**Logs**

- `POST /logs` · `GET /logs/:id` · `PATCH /logs/:id` · `DELETE /logs/:id`
- `POST /logs/:id/photos/upload-url` · `POST /logs/:id/photos/:photoId/complete` · `DELETE /logs/:id/photos/:photoId`
- `POST /logs/:id/companions/:userId/accept|decline` · `DELETE /logs/:id/companions/me`

**Want-to-go & lists**

- `PUT /want-to-go/:restaurantId` · `DELETE /want-to-go/:restaurantId`
- `POST /lists` · `GET /lists/:id` · `PATCH /lists/:id` · `DELETE /lists/:id` · `PUT /lists/:id/items` (replace ordered items) · 🔓 `GET /lists/share/:slug`

**Reports**

- `POST /reports`

**Admin** (`/v1/admin/*`, cookie session, `role = admin`)

- reports queue, pending restaurants, remove content, suspend/unsuspend user, audit log view.

**Ops**

- 🔓 `GET /health` (no details) · `GET /ready` (internal only)

## 8. Photo pipeline

1. Client picks image, resizes to ≤ 2048px, compresses (JPEG/WebP).
2. `POST …/upload-url` → API validates count/limits, creates `log_photos` row (`pending`) and returns a presigned PUT to the **quarantine** bucket with fixed key, content-type and max size (5 MB), expiring in 5 min.
3. Client uploads, then calls `…/complete`.
4. Job: download from quarantine → verify magic bytes (JPEG/PNG/WebP/HEIC) → decode with sharp → re-encode to WebP, strip **all** metadata (EXIF/GPS), cap dimensions → write to **public** bucket under random key → mark `ready` → delete quarantine object. Failures mark `rejected`.
5. Served through the R2 public domain/CDN with long cache headers. Keys are random UUIDs.

Avatars follow the same pipeline (square crop, 512px).

## 9. Jobs (pg-boss)

`photo.process`, `account.export` (JSON zip to a private bucket, 24h signed link emailed/in-app), `account.delete` (hard delete + object cleanup within 30 days, immediately hidden), `place_cache.purge`, `quarantine.cleanup` (orphans > 24h), `stats.year_in_review` (optional precompute).

## 10. Environments & config

- `local` (compose), `staging` (separate DB, bucket, Google key with low quota), `production`.
- Config validated at boot with Zod; the process **refuses to start** if a required secret is missing or if `NODE_ENV=production` with insecure settings (http URLs, wildcard CORS, debug logging).
- `.env.example` lists: `DATABASE_URL`, `DATABASE_URL_OWNER` (migrations), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_OAUTH_CLIENT_ID/SECRET`, `APPLE_*`, `GOOGLE_PLACES_API_KEY`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET_QUARANTINE`, `S3_BUCKET_PUBLIC`, `S3_BUCKET_PRIVATE`, `EMAIL_API_KEY`, `FIELD_ENCRYPTION_KEY`, `SENTRY_DSN`, `ADMIN_ORIGIN`.
- Mobile config (`app.config.ts`) holds only `API_URL`, `SENTRY_DSN`, `APP_NAME`.

## 11. Performance targets

- p95 API latency < 300 ms (excluding Google calls) from Brazil.
- Feed and lists cursor-paginated, max 50 per page.
- Mobile cold start < 3 s on a mid-range Android.
- Images lazy-loaded with blurhash placeholders.
