import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { signInCookie, signUpAndVerify } from "../helpers/auth.js";
import { buildTestEnv, injectAs, uniqueEmail, uniqueRemoteAddress } from "../helpers/env.js";
import { jpegWithExif, notAnImage, tinyJpeg } from "../helpers/image.js";

const PASSWORD = "correct-horse-battery";

async function uploadToS3(
  target: { url: string; headers: Record<string, string> },
  bytes: Buffer,
): Promise<void> {
  const response = await fetch(target.url, { method: "PUT", headers: target.headers, body: bytes });
  if (!response.ok) {
    throw new Error(`S3 upload failed: ${response.status} ${await response.text()}`);
  }
}

describe("avatar upload pipeline (DEV_PLAN Phase 1 PR4)", () => {
  const env = buildTestEnv();
  const app = buildApp(env);
  const inject = injectAs(app, uniqueRemoteAddress());

  afterAll(async () => {
    await app.close();
  });

  async function newUserCookie(label: string) {
    const email = uniqueEmail(label);
    await signUpAndVerify(app, { email, password: PASSWORD });
    return signInCookie(app, { email, password: PASSWORD });
  }

  async function requestUploadUrl(cookie: string, bytes: Buffer) {
    const response = await inject({
      method: "POST",
      url: "/v1/me/avatar/upload-url",
      headers: { cookie },
      payload: { contentType: "image/jpeg", contentLength: bytes.length },
    });
    expect(response.statusCode).toBe(200);
    return response.json() as { url: string; key: string; headers: Record<string, string> };
  }

  it("uploads, processes, and sets a real avatar", async () => {
    const cookie = await newUserCookie("avatar-happy-path");
    const bytes = await tinyJpeg();

    const target = await requestUploadUrl(cookie, bytes);
    await uploadToS3(target, bytes);

    const complete = await inject({
      method: "POST",
      url: "/v1/me/avatar/complete",
      headers: { cookie },
      payload: { key: target.key },
    });
    expect(complete.statusCode).toBe(200);
    const body = complete.json();
    expect(body.avatarKey).toBeTypeOf("string");
    expect(body.avatarKey.endsWith(".webp")).toBe(true);

    const me = await inject({ method: "GET", url: "/v1/me", headers: { cookie } });
    expect(me.json().avatarKey).toBe(body.avatarKey);

    // Fetch the processed object straight from the public bucket and
    // confirm it's actually a 512x512 WebP with no EXIF (SECURITY.md
    // "strip all metadata").
    const publicUrl = `${env.S3_ENDPOINT}/${env.S3_BUCKET_PUBLIC}/${body.avatarKey}`;
    const objectResponse = await fetch(publicUrl);
    expect(objectResponse.status).toBe(200);
    const objectBytes = Buffer.from(await objectResponse.arrayBuffer());
    const metadata = await sharp(objectBytes).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBe(512);
    expect(metadata.height).toBe(512);
    expect(metadata.exif).toBeUndefined();
  });

  it("strips EXIF/GPS metadata from a photo that has it", async () => {
    const cookie = await newUserCookie("avatar-exif-strip");
    const bytes = await jpegWithExif();

    const target = await requestUploadUrl(cookie, bytes);
    await uploadToS3(target, bytes);

    const complete = await inject({
      method: "POST",
      url: "/v1/me/avatar/complete",
      headers: { cookie },
      payload: { key: target.key },
    });
    expect(complete.statusCode).toBe(200);

    const publicUrl = `${env.S3_ENDPOINT}/${env.S3_BUCKET_PUBLIC}/${complete.json().avatarKey}`;
    const objectBytes = Buffer.from(await (await fetch(publicUrl)).arrayBuffer());
    const metadata = await sharp(objectBytes).metadata();
    expect(metadata.exif).toBeUndefined();
  });

  it("rejects a renamed non-image file (fake magic bytes aside, real content isn't an image)", async () => {
    const cookie = await newUserCookie("avatar-fake-image");
    // Declared as image/jpeg at upload time, but the bytes aren't a JPEG —
    // exactly SECURITY.md's "renamed .exe as .jpg" case.
    const bytes = notAnImage();

    const target = await requestUploadUrl(cookie, bytes);
    await uploadToS3(target, bytes);

    const complete = await inject({
      method: "POST",
      url: "/v1/me/avatar/complete",
      headers: { cookie },
      payload: { key: target.key },
    });
    expect(complete.statusCode).toBe(400);
    expect(complete.json().error.code).toBe("invalid_image");

    const me = await inject({ method: "GET", url: "/v1/me", headers: { cookie } });
    expect(me.json().avatarKey).toBeNull();
  });

  it("rejects an upload-url request for a disallowed content type", async () => {
    const cookie = await newUserCookie("avatar-bad-content-type");
    const response = await inject({
      method: "POST",
      url: "/v1/me/avatar/upload-url",
      headers: { cookie },
      payload: { contentType: "application/pdf", contentLength: 1000 },
    });
    expect(response.statusCode).toBe(400);
  });

  it("rejects an upload-url request over the size limit", async () => {
    const cookie = await newUserCookie("avatar-too-big");
    const response = await inject({
      method: "POST",
      url: "/v1/me/avatar/upload-url",
      headers: { cookie },
      payload: { contentType: "image/jpeg", contentLength: 6 * 1024 * 1024 },
    });
    expect(response.statusCode).toBe(400);
  });

  it("rejects a quarantine key that doesn't belong to the caller (IDOR)", async () => {
    const victimCookie = await newUserCookie("avatar-idor-victim");
    const attackerCookie = await newUserCookie("avatar-idor-attacker");

    const victimTarget = await requestUploadUrl(victimCookie, await tinyJpeg());

    const response = await inject({
      method: "POST",
      url: "/v1/me/avatar/complete",
      headers: { cookie: attackerCookie },
      payload: { key: victimTarget.key },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("invalid_image");
  });
});
