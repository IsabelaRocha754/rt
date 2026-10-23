import sharp from "sharp";

export type DetectedImageType = "jpeg" | "png" | "webp" | "heic";

const HEIC_BRANDS = ["heic", "heix", "hevc", "heim", "heis", "hevm", "hevs", "mif1", "msf1"];

// SECURITY.md "Restrict file uploads" > magic-byte check — runs before
// sharp ever touches the bytes. Checks the file's actual header, not its
// declared Content-Type or extension, so a renamed `.exe` never reaches
// the decoder.
export function detectImageType(buffer: Buffer): DetectedImageType | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "png";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(4, 8).toString("ascii") === "ftyp" &&
    HEIC_BRANDS.includes(buffer.subarray(8, 12).toString("ascii"))
  ) {
    return "heic";
  }
  return null;
}

export class InvalidImageError extends Error {}

// Decodes, re-encodes to WebP, and strips all metadata (EXIF/GPS included
// — sharp only keeps metadata when `.withMetadata()` is called, which this
// never does). `.rotate()` with no arguments bakes in the EXIF orientation
// before that metadata is gone, so the image doesn't end up sideways.
//
// A corrupted or non-image file that happened to pass `detectImageType`
// (a crafted header on arbitrary bytes) fails here instead — sharp throws
// on anything it can't actually decode, which this turns into our own
// `InvalidImageError` for the caller to treat the same way as a magic-byte
// mismatch.
export async function processImage(
  buffer: Buffer,
  size: number,
): Promise<{ bytes: Buffer; contentType: string }> {
  try {
    const bytes = await sharp(buffer)
      .rotate()
      .resize(size, size, { fit: "cover" })
      .webp({ quality: 85 })
      .toBuffer();
    return { bytes, contentType: "image/webp" };
  } catch (error) {
    throw new InvalidImageError(error instanceof Error ? error.message : "image decode failed");
  }
}
