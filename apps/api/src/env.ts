import { z } from "zod";
import { APP_NAME } from "@plate/shared";

// The rest of TRD.md §10's list (S3, Sentry...) stays optional until the
// phase that introduces them — tighten to required there, never loosen
// validation. Better Auth (BETTER_AUTH_*) and email (EMAIL_API_KEY) became
// required as of Phase 1 PR1. Google/Apple OAuth (PR2) stay optional: each
// provider is only enabled (src/auth/auth.ts) once its own vars are filled
// in, so the API boots and email+password keeps working without them.
const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    DATABASE_URL: z.string().min(1),
    DATABASE_URL_OWNER: z.string().min(1),
    ADMIN_ORIGIN: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.string().min(1),
    // Optional locally: sendVerificationEmail/sendResetPassword log to stdout
    // instead of sending mail when this is empty. Required in production.
    EMAIL_API_KEY: z.string().default(""),
    EMAIL_FROM: z.string().default(`${APP_NAME} <no-reply@plate.app>`),
    GOOGLE_OAUTH_CLIENT_ID: z.string().default(""),
    GOOGLE_OAUTH_CLIENT_SECRET: z.string().default(""),
    APPLE_CLIENT_ID: z.string().default(""),
    APPLE_TEAM_ID: z.string().default(""),
    APPLE_KEY_ID: z.string().default(""),
    APPLE_PRIVATE_KEY: z.string().default(""),
    // Required as of Phase 1 PR4 (avatar upload pipeline).
    S3_ENDPOINT: z.string().min(1),
    S3_ACCESS_KEY_ID: z.string().min(1),
    S3_SECRET_ACCESS_KEY: z.string().min(1),
    S3_BUCKET_QUARANTINE: z.string().min(1),
    S3_BUCKET_PUBLIC: z.string().min(1),
    S3_BUCKET_PRIVATE: z.string().min(1),
  })
  .superRefine((value, ctx) => {
    // Partial OAuth config is always a mistake, in every environment — a
    // provider either has everything it needs or stays off.
    const googleFields = [value.GOOGLE_OAUTH_CLIENT_ID, value.GOOGLE_OAUTH_CLIENT_SECRET];
    if (googleFields.some(Boolean) && !googleFields.every(Boolean)) {
      ctx.addIssue({
        code: "custom",
        path: ["GOOGLE_OAUTH_CLIENT_ID"],
        message: "Set both GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET, or neither.",
      });
    }
    const appleFields = [
      value.APPLE_CLIENT_ID,
      value.APPLE_TEAM_ID,
      value.APPLE_KEY_ID,
      value.APPLE_PRIVATE_KEY,
    ];
    if (appleFields.some(Boolean) && !appleFields.every(Boolean)) {
      ctx.addIssue({
        code: "custom",
        path: ["APPLE_CLIENT_ID"],
        message:
          "Set APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID and APPLE_PRIVATE_KEY together, or none of them.",
      });
    }

    if (value.NODE_ENV !== "production") return;

    if (value.ADMIN_ORIGIN === "*") {
      ctx.addIssue({
        code: "custom",
        path: ["ADMIN_ORIGIN"],
        message: "ADMIN_ORIGIN must not be a wildcard in production.",
      });
    }
    if (!value.ADMIN_ORIGIN.startsWith("https://")) {
      ctx.addIssue({
        code: "custom",
        path: ["ADMIN_ORIGIN"],
        message: "ADMIN_ORIGIN must be an https URL in production.",
      });
    }
    if (
      !/^postgres(ql)?:\/\//.test(value.DATABASE_URL) ||
      /sslmode=disable/.test(value.DATABASE_URL)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["DATABASE_URL"],
        message: "DATABASE_URL must use TLS in production.",
      });
    }
    if (value.LOG_LEVEL === "debug") {
      ctx.addIssue({
        code: "custom",
        path: ["LOG_LEVEL"],
        message: "LOG_LEVEL must not be debug in production.",
      });
    }
    if (!value.BETTER_AUTH_URL.startsWith("https://")) {
      ctx.addIssue({
        code: "custom",
        path: ["BETTER_AUTH_URL"],
        message: "BETTER_AUTH_URL must be an https URL in production.",
      });
    }
    if (value.BETTER_AUTH_SECRET === "replace-with-32-byte-random-value") {
      ctx.addIssue({
        code: "custom",
        path: ["BETTER_AUTH_SECRET"],
        message: "BETTER_AUTH_SECRET must not be the .env.example placeholder in production.",
      });
    }
    if (value.EMAIL_API_KEY === "") {
      ctx.addIssue({
        code: "custom",
        path: ["EMAIL_API_KEY"],
        message: "EMAIL_API_KEY is required in production (verification/reset email).",
      });
    }
    if (!value.S3_ENDPOINT.startsWith("https://")) {
      ctx.addIssue({
        code: "custom",
        path: ["S3_ENDPOINT"],
        message: "S3_ENDPOINT must be an https URL in production.",
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    // Never print actual env values — only field names and the rule that failed.
    const issues = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    console.error("Refusing to start: invalid configuration.\n" + issues.join("\n"));
    process.exit(1);
  }
  return result.data;
}
