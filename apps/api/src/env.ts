import { z } from "zod";

// Only vars Phase 0 actually uses are required. The rest of TRD.md §10's list
// (Better Auth, Google, S3, email, Sentry...) stays optional until the phase
// that introduces them — tighten to required there, never loosen validation.
const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    DATABASE_URL: z.string().min(1),
    DATABASE_URL_OWNER: z.string().min(1),
    ADMIN_ORIGIN: z.string().min(1),
  })
  .superRefine((value, ctx) => {
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
