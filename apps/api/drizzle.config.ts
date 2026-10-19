import { defineConfig } from "drizzle-kit";

// Migrations run as app_owner — the owner client, never the request-scoped app_user client.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL_OWNER ?? "postgres://app_owner:changeme@localhost:5432/plate",
  },
});
