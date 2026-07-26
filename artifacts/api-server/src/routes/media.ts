/**
 * POST /api/media/upload — stores a Trip Story image straight in Postgres
 * (see lib/media-storage.ts for why: no R2/S3 account needed). Body is JSON
 * with a base64 payload, same shape as the Lens vision route, and gets the
 * same route-scoped body-size bump rather than raising the global limit.
 *
 * GET /api/media/file/:id — the public read side; no session required, same
 * as story reads generally.
 */
import { Router, type IRouter } from "express";
import express from "express";
import { requireSession } from "../lib/session";
import { storeImage, getImage } from "../lib/media-storage";
import { isAllowedImageType, MAX_IMAGE_BYTES } from "../lib/media-validate";

const router: IRouter = Router();

const ID_PATTERN = /^[0-9a-f-]{36}$/i;

router.post(
  "/media/upload",
  // A larger body only on this route — see lens/analyze for the same pattern.
  // Base64 runs ~33% bigger than the raw bytes, so this comfortably covers
  // MAX_IMAGE_BYTES with headroom for JSON overhead.
  express.json({ limit: "6mb" }),
  requireSession,
  async (req, res) => {
    const contentType = typeof req.body?.contentType === "string" ? req.body.contentType : "";
    const dataBase64 = typeof req.body?.dataBase64 === "string" ? req.body.dataBase64 : "";

    if (!isAllowedImageType(contentType)) {
      res.status(400).json({ error: "Unsupported image type. Use JPEG, PNG, WebP or GIF." });
      return;
    }
    if (!dataBase64) {
      res.status(400).json({ error: "No image data received." });
      return;
    }

    const buffer = Buffer.from(dataBase64, "base64");
    if (buffer.byteLength > MAX_IMAGE_BYTES) {
      res.status(413).json({ error: "Image is too large." });
      return;
    }

    const id = await storeImage(req.user!.id, contentType, buffer);
    if (!id) {
      res.status(400).json({ error: "Couldn't store that image." });
      return;
    }

    const publicUrl = `${req.protocol}://${req.get("host")}/api/media/file/${id}`;
    res.status(201).json({ publicUrl });
  },
);

router.get<{ id: string }>("/media/file/:id", async (req, res) => {
  if (!ID_PATTERN.test(req.params.id)) {
    res.status(400).end();
    return;
  }

  const image = await getImage(req.params.id);
  if (!image) {
    res.status(404).end();
    return;
  }

  res.setHeader("Content-Type", image.contentType);
  // Ids are random UUIDs and rows are never updated in place — safe to cache indefinitely.
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.send(image.data);
});

export default router;
