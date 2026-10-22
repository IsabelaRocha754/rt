import fp from "fastify-plugin";
import { fromNodeHeaders } from "better-auth/node";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { buildAuth, type Auth } from "../auth/auth.js";
import { createAppUserDb } from "../db/client.js";
import type { Env } from "../env.js";

declare module "fastify" {
  interface FastifyInstance {
    auth: Auth;
  }
}

// Endpoints that are the usual target of credential stuffing, enumeration,
// and spam signups get a second, coarser cap on top of Better Auth's own
// per-minute limiter (src/auth/auth.ts) — SECURITY.md "progressive backoff
// and temporary lock after 20/hour". Registered as their own routes so
// Fastify's router matches them ahead of the generic catch-all below,
// without capping unrelated auth traffic (get-session, oauth callbacks...).
const SENSITIVE_PATHS = [
  "/sign-in/email",
  "/sign-up/email",
  "/sign-in/social",
  "/request-password-reset",
  "/send-verification-email",
];

async function forwardToAuth(
  auth: Auth,
  authUrl: string,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const url = new URL(request.url, authUrl);
  const headers = fromNodeHeaders(request.headers);
  // A plain fetch Request carries no socket — Better Auth's rate limiter
  // (src/auth/auth.ts) otherwise can't see the caller's IP at all and falls
  // back to one shared bucket for every client. `x-real-ip` here is set by
  // us from Fastify's own `request.ip` (which already applied its own
  // trustProxy rules against the real connection), never copied from a
  // client-supplied header, so Better Auth can trust it.
  headers.set("x-real-ip", request.ip);
  const webRequest = new Request(url, {
    method: request.method,
    headers,
    ...(request.body ? { body: JSON.stringify(request.body) } : {}),
  });

  const authResponse = await auth.handler(webRequest);

  reply.status(authResponse.status);
  for (const [key, value] of authResponse.headers) {
    const lower = key.toLowerCase();
    if (lower === "set-cookie" || lower === "content-length" || lower === "transfer-encoding") {
      continue;
    }
    reply.header(key, value);
  }
  const cookies = authResponse.headers.getSetCookie();
  if (cookies.length > 0) {
    reply.header("set-cookie", cookies);
  }

  const text = await authResponse.text();
  reply.send(text.length > 0 ? text : null);
}

export default fp(async function authPlugin(app: FastifyInstance, opts: { env: Env }) {
  const db = createAppUserDb(opts.env.DATABASE_URL);
  const auth = await buildAuth(opts.env, db);
  app.decorate("auth", auth);
  app.addHook("onClose", async () => {
    await db.$client.end();
  });

  const handler = (request: FastifyRequest, reply: FastifyReply) =>
    forwardToAuth(auth, opts.env.BETTER_AUTH_URL, request, reply);

  for (const path of SENSITIVE_PATHS) {
    app.route({
      method: ["GET", "POST"],
      url: `/v1/auth${path}`,
      config: { rateLimit: { max: 20, timeWindow: "1 hour" } },
      handler,
    });
  }

  app.route({
    method: ["GET", "POST"],
    url: "/v1/auth/*",
    handler,
  });
});
