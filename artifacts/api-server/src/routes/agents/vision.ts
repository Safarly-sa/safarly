/**
 * Live Lens vision agent — menus, landmarks, and signage.
 *
 * SAFETY NOTE, please read before changing the menu path:
 *
 * This endpoint deliberately never receives the user's allergies and never
 * returns a safe/unsafe verdict. It reports what a dish *contains*; the browser
 * matches that against the user's stored allergies locally.
 *
 * Two reasons. First, allergies are health data — keeping them on the device
 * means they never enter a free-tier API whose terms permit training on inputs.
 * Second, it splits a safety-critical decision into a model judgement
 * ("does this dish contain sesame?") and a deterministic one ("does the user
 * avoid sesame?"), so the part that can be made reliable is reliable.
 *
 * The model can still misread a handwritten menu or miss an ingredient that
 * isn't named. Output is "possible allergens, confirm with staff" — never a
 * guarantee. Do not add a "safe to eat" state on top of this.
 */
import { Router, type IRouter } from "express";
import express from "express";
import { Type } from "@google/genai";
import {
  getGemini,
  GEMINI_MODEL,
  GeminiNotConfiguredError,
  parseJsonResponse,
} from "../../lib/gemini";
import { requireSession } from "../../lib/session";
import { enforceQuota } from "../../lib/agent-quota";
import { logger } from "../../lib/logger";

const router: IRouter = Router();

/**
 * Must mirror ALLERGEN_KEYS in artifacts/safarly/src/pages/lens.tsx. The model
 * is constrained to this closed set so the browser can match tokens exactly
 * rather than fuzzy-matching free text — the whole point of the local check.
 * Adding an allergen means updating both sides and the profile UI.
 */
const ALLERGEN_TOKENS = [
  "nuts",
  "dairy",
  "gluten",
  "sesame",
  "eggs",
  "shellfish",
] as const;

const MODES = ["menu", "place", "sign"] as const;
type Mode = (typeof MODES)[number];

/** ~8MB of base64 ≈ 6MB of image. Clients should downscale before upload. */
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic"];

const menuSchema = {
  type: Type.OBJECT,
  properties: {
    dishes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          nameOriginal: { type: Type.STRING, description: "Exactly as printed on the menu" },
          nameTranslated: { type: Type.STRING, description: "Translated into the target language" },
          description: { type: Type.STRING, description: "One short sentence on what the dish is" },
          ingredients: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Likely ingredients, in the target language",
          },
          allergenTokens: {
            type: Type.ARRAY,
            items: { type: Type.STRING, enum: [...ALLERGEN_TOKENS] },
            description:
              "Allergen categories this dish likely contains. Include one if the typical recipe contains it, even when the menu does not say so.",
          },
          uncertain: {
            type: Type.BOOLEAN,
            description: "True when the text was unclear or the dish is unfamiliar",
          },
          priceText: { type: Type.STRING, description: "Price as printed, or empty" },
        },
        required: [
          "nameOriginal",
          "nameTranslated",
          "description",
          "ingredients",
          "allergenTokens",
          "uncertain",
        ],
      },
    },
  },
  required: ["dishes"],
};

const placeSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    nameTranslated: { type: Type.STRING },
    category: { type: Type.STRING },
    culturalContext: {
      type: Type.STRING,
      description: "2-3 sentences of context a visitor would not know",
    },
    visitorTip: { type: Type.STRING },
    uncertain: { type: Type.BOOLEAN },
  },
  required: ["name", "nameTranslated", "category", "culturalContext", "uncertain"],
};

const signSchema = {
  type: Type.OBJECT,
  properties: {
    lines: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          original: { type: Type.STRING },
          translated: { type: Type.STRING },
        },
        required: ["original", "translated"],
      },
    },
    meaning: { type: Type.STRING, description: "What the sign is telling you, in one sentence" },
    uncertain: { type: Type.BOOLEAN },
  },
  required: ["lines", "meaning", "uncertain"],
};

function promptFor(mode: Mode, languageName: string): string {
  const shared = `You are helping a traveller in Saudi Arabia. Translate into ${languageName}. Be accurate over fluent. If the image is unreadable or does not show what is expected, set "uncertain" to true rather than inventing content.`;

  switch (mode) {
    case "menu":
      return `${shared}

Read every dish on this menu. For each one, report the likely ingredients and which allergen categories it contains, drawing on how the dish is normally prepared — menus rarely list allergens, so a dish containing tahini must still be tagged "sesame", and one cooked in ghee must still be tagged "dairy".

Do not state whether anything is safe to eat. Report only what dishes contain. Mark "uncertain" for any dish whose text you could not read clearly.`;

    case "place":
      return `${shared}

Identify this landmark or place. Give the cultural and historical context a visitor would not already know, and one practical tip (best time, etiquette, what to look for). If you cannot identify it confidently, say what kind of place it appears to be and set "uncertain" to true.`;

    case "sign":
      return `${shared}

Transcribe every line of text on this sign and translate each one. Then explain in a single sentence what the sign is telling the reader to do or know.`;
  }
}

const schemaFor: Record<Mode, object> = {
  menu: menuSchema,
  place: placeSchema,
  sign: signSchema,
};

/* ── POST /api/agents/vision ───────────────────────────────────────────── */
router.post(
  "/agents/vision",
  // A larger body only on this route; the global express.json limit stays at
  // 100kb so the rest of the API is not a soft DoS target.
  express.json({ limit: "9mb" }),
  requireSession,
  enforceQuota,
  async (req, res) => {
    const mode = req.body?.mode;
    const imageBase64 = req.body?.imageBase64;
    const mimeType = req.body?.mimeType;
    const languageName =
      typeof req.body?.languageName === "string" && req.body.languageName.trim()
        ? req.body.languageName.trim().slice(0, 40)
        : "English";

    if (!MODES.includes(mode)) {
      return res.status(400).json({ error: `mode must be one of: ${MODES.join(", ")}` });
    }
    if (typeof imageBase64 !== "string" || imageBase64.length === 0) {
      return res.status(400).json({ error: "imageBase64 is required." });
    }
    if (typeof mimeType !== "string" || !ALLOWED_MIME.includes(mimeType)) {
      return res.status(400).json({ error: `mimeType must be one of: ${ALLOWED_MIME.join(", ")}` });
    }
    if (imageBase64.length > MAX_IMAGE_BYTES) {
      return res.status(413).json({ error: "Image is too large. Please use a smaller photo." });
    }

    try {
      const ai = getGemini();
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: [
          {
            role: "user",
            parts: [
              { text: promptFor(mode as Mode, languageName) },
              { inlineData: { mimeType, data: imageBase64 } },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: schemaFor[mode as Mode],
          // Low, not zero: this is extraction, not creative writing, but menu
          // OCR benefits from a little flexibility on ambiguous glyphs.
          temperature: 0.2,
        },
      });

      const text = response.text;
      if (!text) {
        logger.error({ mode }, "Gemini returned an empty vision response");
        return res.status(502).json({ error: "The AI did not return a result. Try again." });
      }

      return res.json({ mode, result: parseJsonResponse(text) });
    } catch (err) {
      if (err instanceof GeminiNotConfiguredError) {
        logger.error("GEMINI_API_KEY is not set; agent routes are unavailable");
        return res.status(503).json({ error: "AI features are not configured on this server." });
      }
      logger.error({ err, mode }, "Vision agent failed");
      return res.status(502).json({ error: "Could not analyse that image. Try again." });
    }
  },
);

export default router;
