import { boolean, customType, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createdAtColumn } from "./_conventions.js";
import { user } from "./auth.js";

// Postgres' CITEXT type (case-insensitive text) — enabled via `CREATE
// EXTENSION citext` in this table's migration. Drizzle has no built-in
// helper for it.
const citext = customType<{ data: string }>({
  dataType() {
    return "citext";
  },
});

export const profileRoleEnum = pgEnum("profile_role", ["user", "admin"]);
export const profilePlanEnum = pgEnum("profile_plan", ["free", "premium"]);
export const profileStatusEnum = pgEnum("profile_status", ["active", "suspended"]);

export const profiles = pgTable("profiles", {
  // 1:1 with the auth user — no separate `id` column (TRD §4).
  userId: uuid("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  // Nullable until the user picks one (DEV_PLAN Phase 1 F1 "choose
  // username" happens after email verification, as a separate step from
  // account creation) — enforced server-side in packages/shared's
  // `isValidUsername`, not by a DB constraint beyond uniqueness.
  username: citext("username").unique(),
  displayName: text("display_name"),
  bio: text("bio"),
  avatarKey: text("avatar_key"),
  isPrivate: boolean("is_private").default(false).notNull(),
  locale: text("locale").default("pt-BR").notNull(),
  // Never writable via the API request body — set only by server logic.
  role: profileRoleEnum("role").default("user").notNull(),
  plan: profilePlanEnum("plan").default("free").notNull(),
  status: profileStatusEnum("status").default("active").notNull(),
  // Set by the signup flow (DEV_PLAN Phase 1 PR4) — the columns exist now
  // because RLS/migrations land with the table, not because this PR wires
  // an endpoint for them yet.
  ageConfirmedAt: timestamp("age_confirmed_at", { withTimezone: true }),
  termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
  termsVersion: text("terms_version"),
  createdAt: createdAtColumn(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});
