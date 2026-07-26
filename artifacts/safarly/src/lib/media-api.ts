/**
 * Trip Story image upload — POSTs a base64 payload to the server, which
 * stores it directly in Postgres (see artifacts/api-server/src/lib/media-storage.ts
 * for why: no R2/S3 account or payment method needed). Images only; video
 * stays paste-a-link, same as TikTok always was.
 *
 * Reuses prepareImageForUpload's client-side downscale (JPEG, ≤1600px,
 * q0.82) — the same trick vision.ts already relies on to keep the payload
 * small, so a modern phone photo doesn't blow the server's body-size limit.
 */
import { prepareImageForUpload } from "./image";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

export type UploadResult =
  | { ok: true; url: string; type: "image" }
  | { ok: false; error: string };

export async function uploadMediaFile(file: File): Promise<UploadResult> {
  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "Only image uploads are supported — paste a video link instead." };
  }

  let prepared;
  try {
    prepared = await prepareImageForUpload(file);
  } catch {
    return { ok: false, error: "Couldn't read that image. Try a different file." };
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/media/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ contentType: prepared.mimeType, dataBase64: prepared.base64 }),
    });
  } catch {
    return { ok: false, error: "Can't reach the Safarly server. Make sure the API is running, then try again." };
  }

  if (!res.ok) {
    let error = `Something went wrong (${res.status}).`;
    try {
      error = (await res.json()).error ?? error;
    } catch {
      /* Non-JSON body — fall through to status text. */
    }
    return { ok: false, error };
  }

  const { publicUrl } = await res.json();
  return { ok: true, url: publicUrl, type: "image" };
}
