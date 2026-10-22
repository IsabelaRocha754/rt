import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAtColumn, idColumn } from "./_conventions.js";

// Tables managed by Better Auth (TRD §4 "Auth tables"). Field names follow
// exactly what Better Auth's Drizzle adapter expects (see
// node_modules/better-auth — or `pnpm dlx @better-auth/cli generate` against
// src/auth/auth.ts) — only id/timestamp column *types* are adapted to this
// repo's conventions (UUIDv7 ids, timestamptz). Do not rename fields.
//
// RLS: deliberately NOT enabled here. Every column in a RLS policy would
// need to be evaluated against `app.user_id`, but Better Auth's own
// connection pool never calls `withUserTx` (it manages sign-up/sign-in
// before any session exists) — it is itself the trust boundary, and all
// access to these tables goes through its parameterized queries, never
// through user-supplied SQL. App tables that store user data (profiles,
// logs, ...) still get RLS per SECURITY.md.

export const user = pgTable("user", {
  id: idColumn(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: createdAtColumn(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const session = pgTable(
  "session",
  {
    id: idColumn(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: createdAtColumn(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: idColumn(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    // The email+password hash lives here (providerId = "credential"), set
    // and read only by Better Auth. Never returned by any of our own routes.
    password: text("password"),
    createdAt: createdAtColumn(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: idColumn(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAtColumn(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

// Better Auth's own login/signup/reset rate-limit counters (persisted so
// limits survive an API restart). Not user data — just a key + counter.
export const rateLimit = pgTable("rate_limit", {
  id: idColumn(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  // Epoch milliseconds — needs bigint, a plain integer overflows ~2038.
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});
