# CLAUDE.md — Plate (codename)

A Letterboxd-style mobile app for restaurants: users log visits, rate them (0.5–5 stars), review, keep a want-to-go list, make lists, follow friends and see their activity. Real public launch on iOS + Android, Brazil-first, PT-BR + English.

"Plate" is a **codename**. Keep the product name in one config value (`APP_NAME`) and in i18n strings so it can be renamed before store launch.

## Read before working

These documents are the source of truth. Read the relevant one before starting a task, and update it in the same PR if a decision changes.

| Doc                  | What it covers                                                   |
| -------------------- | ---------------------------------------------------------------- |
| `docs/PRD.md`        | Product goals, users, features, non-goals                        |
| `docs/MVP_SCOPE.md`  | What is in / out of v1. **Do not build out-of-scope features.**  |
| `docs/TRD.md`        | Architecture, stack, data model, API, visibility rules           |
| `docs/USER_FLOWS.md` | Step-by-step flows and edge cases                                |
| `docs/UI_PLAN.md`    | Navigation, screens, components, design rules                    |
| `docs/DEV_PLAN.md`   | Phased build order and acceptance criteria                       |
| `docs/SECURITY.md`   | Security & privacy requirements — **mandatory for every change** |

Work in `DEV_PLAN.md` phase order. Don't start a phase until the previous phase's acceptance criteria pass.

## Stack (summary — details in TRD)

- **Monorepo:** pnpm workspaces — `apps/mobile`, `apps/api`, `apps/admin`, `packages/shared`
- **Mobile:** React Native + Expo (managed), TypeScript strict, Expo Router, TanStack Query, react-hook-form + Zod, i18next, expo-secure-store
- **API:** Node.js LTS + Fastify, TypeScript strict, Zod (via `fastify-type-provider-zod`), Drizzle ORM
- **Auth:** Better Auth (email+password, Google, Apple) with its Expo integration
- **DB:** PostgreSQL 16 with Row-Level Security as a second layer of access control
- **Files:** S3-compatible object storage (Cloudflare R2; MinIO locally), presigned uploads
- **Restaurant data:** Google Places API (New), called **only from the API**, plus user-submitted restaurants
- **Hosting:** API as a Docker container on a managed PaaS (Render or Railway), managed Postgres; mobile via EAS Build / Submit / Update
- **Admin:** small web panel (Vite + React) for moderation, cookie-based sessions
- **Observability:** Sentry (mobile + API) with PII scrubbing

## Commands

Development happens inside WSL (Ubuntu) on Windows.

```bash
pnpm install                 # install all workspaces
docker compose up -d         # local Postgres + MinIO
pnpm db:migrate              # apply migrations (apps/api)
pnpm db:seed                 # seed dev data (never runs in production)
pnpm dev:api                 # API on http://localhost:3000
pnpm dev:mobile              # Expo dev server
pnpm dev:admin               # admin panel
pnpm lint && pnpm typecheck && pnpm test   # must pass before every commit
pnpm test:security           # authz/IDOR + tampering test suite
```

If a command above doesn't exist yet, create it as part of Phase 0.

One-time local setup: install the [`gitleaks`](https://github.com/gitleaks/gitleaks) binary (not an npm package) so the pre-commit hook can run — e.g. download a release into `~/.local/bin` inside WSL. The hook refuses to commit if it's missing.

## Non-negotiable rules

1. **Security first.** Every change must satisfy `docs/SECURITY.md`. If a task conflicts with it, stop and ask.
2. **No secrets in code or git.** Secrets live in `.env` (gitignored) and the host's secret store. `.env.example` lists names with fake values. The mobile app contains **no secrets and no database credentials** — only the public API base URL and Sentry DSN.
3. **Every API endpoint** has: an auth check (unless explicitly public), a Zod schema for params/query/body with unknown keys rejected, a Zod response schema that whitelists returned fields, an authorization check on the target record, and tests — including a test that another user **cannot** access it.
4. **Identity comes from the session, never the request body.** `userId`, `role`, `plan`, `status`, `createdBy` etc. are set server-side only.
5. **Database access only through Drizzle** (parameterized). No string-built SQL. Raw SQL only via Drizzle's `sql` template tag.
6. **Migrations are append-only.** Never edit a merged migration; write a new one. Every new table with user data gets RLS policies in the same migration.
7. **User content is plain text.** Never render user content as HTML/Markdown. No `dangerouslySetInnerHTML` in the admin panel.
8. **Respect Google Places terms.** Store `place_id` permanently; cache other Google fields only as long as the terms allow (see TRD). Never expose the Places key to the client.
9. **Ask before adding a dependency.** Prefer well-maintained packages; pin versions; lockfile is committed.
10. **i18n everywhere.** No hard-coded user-facing strings — add keys to both `pt-BR` and `en`.
11. **Out-of-scope = don't build.** If something seems needed but isn't in `MVP_SCOPE.md`, propose it, don't implement it.

## Conventions

- TypeScript `strict: true`; no `any` without a comment explaining why.
- Shared Zod schemas and types live in `packages/shared`; mobile and API import from there.
- IDs are UUIDv7 (`uuid` column). Never expose sequential IDs.
- Timestamps are `timestamptz` in UTC; dates of visits are `date`.
- Money is integer cents + ISO currency code (default `BRL`).
- Ratings are stored as `smallint` 1–10 (half-stars); UI shows 0.5–5.
- API is REST under `/v1`, JSON, cursor-based pagination (`?cursor=&limit=`, max limit 50).
- Errors: `{ error: { code, message } }`; never leak stack traces, SQL, or internal IDs in production.
- Git: small PRs, conventional commits (`feat:`, `fix:`, `sec:`…), one phase task per branch.
- Tests: Vitest + Fastify `inject` + real Postgres (Testcontainers or the compose DB) for the API; Jest + React Native Testing Library for mobile.

## Definition of done (every task)

- [ ] Lint, typecheck, tests pass locally and in CI
- [ ] New endpoints have authz + "other user can't access" tests
- [ ] Strings exist in `pt-BR` and `en`
- [ ] `docs/` updated if behavior or decisions changed
- [ ] `SECURITY.md` checklist items touched by this change are satisfied
- [ ] No secrets, no `console.log` of personal data
