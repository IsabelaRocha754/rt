-- citext (case-insensitive text) for `username` — TRD §2 "PostgreSQL 16 |
-- citext, RLS".
CREATE EXTENSION IF NOT EXISTS citext;
--> statement-breakpoint
CREATE TYPE "public"."profile_plan" AS ENUM('free', 'premium');--> statement-breakpoint
CREATE TYPE "public"."profile_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."profile_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"username" "citext",
	"display_name" text,
	"bio" text,
	"avatar_key" text,
	"is_private" boolean DEFAULT false NOT NULL,
	"locale" text DEFAULT 'pt-BR' NOT NULL,
	"role" "profile_role" DEFAULT 'user' NOT NULL,
	"plan" "profile_plan" DEFAULT 'free' NOT NULL,
	"status" "profile_status" DEFAULT 'active' NOT NULL,
	"age_confirmed_at" timestamp with time zone,
	"terms_accepted_at" timestamp with time zone,
	"terms_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- Row-level security (SECURITY.md "Enable row-level security"; TRD §5).
-- Service-layer checks (src/modules/profiles/service.ts) are the first
-- layer; this mirrors them as defense in depth.
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "profiles" FORCE ROW LEVEL SECURITY;

-- Read: your own row always; anyone else's only while it's active. A
-- suspended profile stays visible to its own owner but disappears for
-- everyone else. There's no `is_private` branch here — RLS decides whether
-- the ROW is readable at all, not how much of it the API response
-- includes; the private/public split (full profile vs. the "this account
-- is private" teaser from USER_FLOWS.md F13) is a service-layer decision
-- in src/modules/profiles/service.ts, same as the `canView` follower check
-- that lands with Phase 4's `follows` table.
CREATE POLICY "profiles_select" ON "profiles" FOR SELECT
  USING ("user_id" = app_current_user_id() OR "status" = 'active');

-- Insert/update: only your own row. The profile row is created by a
-- Better Auth `user.create.after` hook (src/auth/auth.ts) running inside
-- `withUserTx(db, newUser.id, ...)`, so `app.user_id` is already the new
-- user's own id at insert time.
CREATE POLICY "profiles_insert" ON "profiles" FOR INSERT
  WITH CHECK ("user_id" = app_current_user_id());

CREATE POLICY "profiles_update" ON "profiles" FOR UPDATE
  USING ("user_id" = app_current_user_id())
  WITH CHECK ("user_id" = app_current_user_id());