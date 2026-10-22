import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { createAppUserDb, type AppUserDb } from "../db/client.js";
import type { Env } from "../env.js";

declare module "fastify" {
  interface FastifyInstance {
    db: AppUserDb;
  }
}

// One pool for the whole app, shared by the auth plugin and every feature
// module — never the owner client (db/client.ts: "never import this from
// request-handling code").
export default fp(async function dbPlugin(app: FastifyInstance, opts: { env: Env }) {
  const db = createAppUserDb(opts.env.DATABASE_URL);
  app.decorate("db", db);
  app.addHook("onClose", async () => {
    await db.$client.end();
  });
});
