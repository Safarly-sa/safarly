/**
 * Client-side image downscale before upload.
 *
 * The vision agent bills per image and the API enforces an 8MB base64 cap
 * (artifacts/api-server/src/routes/agents/vision.ts) — a modern phone photo is
 * routinely 4-12MB, so sending it unmodified would either blow the limit or
 * waste tokens on resolution the model does not need to read a menu or a sign.
 * Downscaling here also means slow connections upload less.
 */

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

export interface PreparedImage {
  base64: string;
  mimeType: "image/jpeg";
}

/** Resizes so the longer edge is at most MAX_DIMENSION, then re-encodes as JPEG. */
export async function prepareImageForUpload(file: File): Promise<PreparedImage> {
  const bitmap = await loadBitmap(file);
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, MAX_DIMENSION);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not supported in this browser.");
    ctx.drawImage(bitmap, 0, 0, width, height);

    const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
    return { base64, mimeType: "image/jpeg" };
  } finally {
    bitmap.close();
  }
}

function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  if (width <= max && height <= max) return { width, height };
  const scale = max / Math.max(width, height);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

async function loadBitmap(file: File): Promise<ImageBitmap> {
  // createImageBitmap handles EXIF-rotated JPEGs and HEIC-via-browser-support
  // without the manual <img> load + orientation dance.
  return createImageBitmap(file);
}
