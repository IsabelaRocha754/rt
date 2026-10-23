import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Env } from "../env.js";

export function createS3Client(env: Env): S3Client {
  return new S3Client({
    endpoint: env.S3_ENDPOINT,
    // Region is meaningless for a self-hosted S3-compatible server, but the
    // SDK requires some value.
    region: "us-east-1",
    // Path-style ("endpoint/bucket/key") rather than virtual-hosted-style
    // ("bucket.endpoint/key") — required by zenko/cloudserver locally and
    // by most non-AWS S3-compatible servers; Cloudflare R2 (prod) accepts
    // both.
    forcePathStyle: true,
    // AWS SDK v3's default ("WHEN_SUPPORTED") signs in an
    // `x-amz-checksum-*`/`x-amz-sdk-checksum-algorithm` requirement that
    // most non-AWS S3-compatible servers (zenko/cloudserver included)
    // don't implement, answering with a 501 "NotImplemented". This only
    // disables the SDK's own opportunistic checksum — nothing here skips
    // a check of ours.
    requestChecksumCalculation: "WHEN_REQUIRED",
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
  });
}

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ALLOWED_UPLOAD_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

const PRESIGNED_URL_EXPIRES_SECONDS = 5 * 60;

// SECURITY.md "Restrict file uploads": size and content-type are enforced
// here, in the presigned URL itself — `ContentType` and `ContentLength`
// are part of what gets SigV4-signed, so a PUT that sends a different
// content type or a different number of bytes than declared fails the
// signature check before S3 (or our own `MAX_UPLOAD_BYTES`/allowlist
// check, run on the declared values before this is even called) ever
// stores anything. The photo pipeline (src/photos/pipeline.ts) enforces
// both again at process time regardless — a signed header is a client's
// *claim* about what it's sending, not proof of what it actually sent.
//
// (A presigned POST with a `content-length-range`/`starts-with` policy
// would also work in principle, but zenko/cloudserver — and most non-AWS
// S3-compatible servers — doesn't implement the POST Object API at all,
// answering any POST upload with a 501.)
export async function createUploadUrl(
  client: S3Client,
  bucket: string,
  key: string,
  contentType: string,
  contentLength: number,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
  });
  return getSignedUrl(client, command, { expiresIn: PRESIGNED_URL_EXPIRES_SECONDS });
}

export async function getObjectBytes(
  client: S3Client,
  bucket: string,
  key: string,
): Promise<Buffer> {
  const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const bytes = await response.Body?.transformToByteArray();
  if (!bytes) throw new Error(`Empty object body for ${bucket}/${key}`);
  return Buffer.from(bytes);
}

export async function putObjectBytes(
  client: S3Client,
  bucket: string,
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await client.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }),
  );
}

export async function deleteObject(client: S3Client, bucket: string, key: string): Promise<void> {
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
