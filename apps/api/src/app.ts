import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { loadEnv, type Env } from "./env.js";
import { buildLoggerOptions } from "./plugins/logging.js";
import securityPlugin from "./plugins/security.js";
import errorHandlerPlugin from "./plugins/error-handler.js";
import authPlugin from "./plugins/auth.js";
import healthRoutes from "./modules/health/routes.js";

export function buildApp(env: Env = loadEnv()) {
  const app = Fastify({ logger: buildLoggerOptions(env) });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.register(securityPlugin, { env });
  app.register(errorHandlerPlugin, { env });
  app.register(authPlugin, { env });
  app.register(healthRoutes);

  return app;
}
