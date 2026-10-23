import fp from "fastify-plugin";
import type { S3Client } from "@aws-sdk/client-s3";
import type { FastifyInstance } from "fastify";
import { createS3Client } from "../storage/s3.js";
import type { Env } from "../env.js";

interface Buckets {
  quarantine: string;
  public: string;
  private: string;
}

declare module "fastify" {
  interface FastifyInstance {
    s3: S3Client;
    buckets: Buckets;
  }
}

export default fp(async function storagePlugin(app: FastifyInstance, opts: { env: Env }) {
  app.decorate("s3", createS3Client(opts.env));
  app.decorate("buckets", {
    quarantine: opts.env.S3_BUCKET_QUARANTINE,
    public: opts.env.S3_BUCKET_PUBLIC,
    private: opts.env.S3_BUCKET_PRIVATE,
  });
});
