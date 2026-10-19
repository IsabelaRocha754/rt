-- Local-only role provisioning, mounted via docker-entrypoint-initdb.d.
-- Staging/production roles are provisioned through the hosting provider's
-- console/CLI instead of this script — see apps/api/README.md.
CREATE ROLE app_user LOGIN PASSWORD 'changeme';
CREATE ROLE app_worker LOGIN PASSWORD 'changeme';
-- app_owner already exists: it's the POSTGRES_USER the container was initialized with.
