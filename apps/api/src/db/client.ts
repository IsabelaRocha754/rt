import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema/index.js";

// Request-scoped client — connects as app_user (no BYPASSRLS, no table ownership).
export function createAppUserDb(databaseUrl: string) {
  const pool = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 3000 });
  return drizzle(pool, { schema });
}

// Migration/seed-only client — connects as app_owner. Never import this from
// request-handling code.
export function createOwnerDb(databaseUrlOwner: string) {
  const pool = new Pool({ connectionString: databaseUrlOwner, connectionTimeoutMillis: 3000 });
  return drizzle(pool, { schema });
}

export type AppUserDb = ReturnType<typeof createAppUserDb>;
