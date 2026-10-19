import { timestamp, uuid } from "drizzle-orm/pg-core";
import { uuidv7 } from "uuidv7";

// Column conventions shared by every table (CLAUDE.md "Conventions"):
// - IDs are UUIDv7, generated in app code — Postgres 16 has no native uuidv7(),
//   and relying on an extension would risk portability to managed hosting.
// - Timestamps are timestamptz in UTC.
export const idColumn = () =>
  uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7());

export const createdAtColumn = () =>
  timestamp("created_at", { withTimezone: true }).defaultNow().notNull();

export const updatedAtColumn = () => timestamp("updated_at", { withTimezone: true });
