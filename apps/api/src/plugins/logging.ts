import type { Env } from "../env.js";

const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "req.body.password",
  "req.body.token",
  "req.body.email",
  "res.headers['set-cookie']",
];

export function buildLoggerOptions(env: Env) {
  return {
    level: env.LOG_LEVEL,
    redact: { paths: REDACT_PATHS, censor: "[redacted]" },
    transport:
      env.NODE_ENV === "production"
        ? undefined
        : { target: "pino-pretty", options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" } },
  };
}
