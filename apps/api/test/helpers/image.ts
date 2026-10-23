import sharp from "sharp";

export async function tinyJpeg(): Promise<Buffer> {
  return sharp({
    create: { width: 16, height: 16, channels: 3, background: { r: 200, g: 100, b: 50 } },
  })
    .jpeg()
    .toBuffer();
}

// A JPEG carrying EXIF metadata (camera make + GPS-shaped tags), to verify
// the pipeline actually strips it rather than merely not adding new
// metadata of its own.
export async function jpegWithExif(): Promise<Buffer> {
  return sharp({
    create: { width: 16, height: 16, channels: 3, background: { r: 10, g: 200, b: 10 } },
  })
    .withExif({
      IFD0: {
        Make: "TestCam",
        GPSLatitude: "37/1,47/1,0/1",
        GPSLongitude: "122/1,25/1,0/1",
      },
    })
    .jpeg()
    .toBuffer();
}

// Arbitrary non-image bytes with a `.jpg`-shaped Content-Type at upload
// time (SECURITY.md's "renamed .exe as .jpg" case) — no real magic bytes.
export function notAnImage(): Buffer {
  return Buffer.from("MZ\x90\x00this is not a real image, just a renamed binary");
}
