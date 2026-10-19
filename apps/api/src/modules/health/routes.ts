import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

export default async function healthRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/health",
    schema: {
      response: { 200: z.object({ status: z.literal("ok") }) },
    },
    handler: async () => ({ status: "ok" as const }),
  });
}
