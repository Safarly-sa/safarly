/**
 * Shared Gemini client.
 *
 * The key lives here, server-side, and never reaches the browser. Vite inlines
 * `import.meta.env.*` into the client bundle at build time, so a key referenced
 * anywhere in `artifacts/safarly` would ship to every visitor and be scrapeable
 * from the JS. The frontend calls our own API endpoints instead (`/api/lens/*`,
 * `/api/trip/*`, `/api/concierge/*`, `/api/dialect/*`, `/api/translate`).
 */
import { GoogleGenAI } from "@google/genai";
import { logger } from "./logger";

/**
 * Gemini 2.5 Flash on the free tier: 10 RPM / 250 RPD, vision included.
 * Flash rather than Pro because Pro's free tier is 5 RPM / 100 RPD, which is
 * too tight for six agents; Flash rather than Flash-Lite because menu OCR and
 * Arabic dialect work are the two jobs where model quality shows most.
 */
export const GEMINI_MODEL = "gemini-2.5-flash";

let client: GoogleGenAI | null = null;

export class GeminiNotConfiguredError extends Error {
  constructor() {
    super("GEMINI_API_KEY is not set.");
    this.name = "GeminiNotConfiguredError";
  }
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function getGemini(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new GeminiNotConfiguredError();
  // Built lazily so the server still boots (and /health still answers) without
  // a key configured — only the agent routes should fail.
  if (!client) client = new GoogleGenAI({ apiKey });
  return client;
}

/**
 * Gemini can wrap JSON in ```json fences even when asked not to, and a single
 * stray fence turns a good response into a parse error. Strips fences, then
 * falls back to the outermost {...} span.
 */
export function parseJsonResponse<T>(raw: string): T {
  const text = raw.trim();

  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  const candidate = fenced ? fenced[1] : text;

  try {
    return JSON.parse(candidate) as T;
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1)) as T;
    }
    logger.error({ preview: text.slice(0, 200) }, "Gemini returned unparseable JSON");
    throw new Error("The AI returned a malformed response.");
  }
}
