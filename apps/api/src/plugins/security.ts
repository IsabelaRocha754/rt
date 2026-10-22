import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import type { Env } from "../env.js";

export default fp(async function securityPlugin(app: FastifyInstance, opts: { env: Env }) {
  await app.register(helmet, {
    hsts: { maxAge: 31536000, includeSubDomains: true },
    referrerPolicy: { policy: "no-referrer" },
    frameguard: { action: "deny" },
  });

  // Mobile clients don't send CORS requests. This allowlist exists for the admin panel only.
  await app.register(cors, {
    origin: [opts.env.ADMIN_ORIGIN],
    credentials: true,
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
    errorResponseBuilder: () => ({
      error: { code: "rate_limited", message: "Too many requests." },
    }),
  });

  await app.register(sensible);
});
