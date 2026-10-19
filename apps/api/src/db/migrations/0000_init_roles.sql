-- Run as app_owner. Roles app_user/app_worker are created out-of-band (local:
-- docker/postgres/init-roles.sql via docker-entrypoint-initdb.d; staging/prod:
-- the hosting provider's console/CLI) — this migration only grants access and
-- installs the RLS support function, since role creation can't be made
-- portable across local compose and managed Postgres.

REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO app_user, app_worker;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_worker;

-- Stub for now — no feature tables/policies exist yet. Future canView() RLS
-- policies (TRD §5) will call this instead of reading current_setting directly.
CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS uuid
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = pg_catalog, public
AS $$ SELECT current_setting('app.user_id', true)::uuid $$;
