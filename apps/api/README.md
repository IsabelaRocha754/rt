# @plate/api

Fastify API. See the repo root `CLAUDE.md` and `docs/TRD.md` for architecture.

## DB roles

Three roles: `app_owner` (migrations only), `app_user` (request-scoped, RLS-bound), `app_worker` (background jobs).

- **Local (docker-compose):** `app_owner` is the Postgres container's `POSTGRES_USER`. `app_user` and `app_worker` are created by `docker/postgres/init-roles.sql`, mounted via `docker-entrypoint-initdb.d` — it only runs once, on first volume creation.
- **Staging/production:** roles are provisioned through the hosting provider's console/CLI instead, since role creation with passwords isn't portable across environments. Grants and RLS support functions still ship as ordinary Drizzle migrations (run as `app_owner`), applying the same way everywhere.

## Commands

```bash
pnpm dev                # start the API with reload
pnpm db:generate         # generate a migration from schema changes
pnpm db:migrate          # apply migrations (as app_owner)
pnpm db:seed             # seed dev data (never runs in production)
pnpm test                # unit/integration tests
pnpm test:security       # authz/IDOR test suite
```
