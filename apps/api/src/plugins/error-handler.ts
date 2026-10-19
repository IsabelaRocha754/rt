import fp from "fastify-plugin";
import { hasZodFastifySchemaValidationErrors } from "fastify-type-provider-zod";
import type { FastifyError, FastifyInstance } from "fastify";
import type { Env } from "../env.js";

export default fp(async function errorHandlerPlugin(app: FastifyInstance, opts: { env: Env }) {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      reply.status(400).send({
        error: { code: "validation_error", message: "Invalid request." },
      });
      return;
    }

    const statusCode = error.statusCode ?? 500;
    request.log.error({ err: error }, "request failed");

    if (statusCode < 500) {
      reply.status(statusCode).send({
        error: { code: error.code ?? "bad_request", message: error.message },
      });
      return;
    }

    // Never leak stack traces or SQL in production.
    reply.status(500).send({
      error: {
        code: "internal_error",
        message: opts.env.NODE_ENV === "production" ? "Something went wrong." : error.message,
      },
    });
  });
});
