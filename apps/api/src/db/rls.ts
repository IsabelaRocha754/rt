import { sql } from "drizzle-orm";
import type { AppUserDb } from "./client.js";

/**
 * Runs `fn` inside a transaction with `app.user_id` (and optionally `app.role`)
 * set for the duration of the transaction, so RLS policies can read them via
 * `current_setting('app.user_id', true)`.
 *
 * Uses `set_config(..., true)` (the `true` means transaction-local, i.e. the
 * SQL equivalent of `SET LOCAL`) so the value is bound as a query parameter —
 * never string-interpolated into the SQL text.
 */
export async function withUserTx<T>(
  db: AppUserDb,
  userId: string,
  fn: (tx: AppUserDb) => Promise<T>,
  role?: string,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`);
    if (role) {
      await tx.execute(sql`select set_config('app.role', ${role}, true)`);
    }
    return fn(tx as unknown as AppUserDb);
  });
}
