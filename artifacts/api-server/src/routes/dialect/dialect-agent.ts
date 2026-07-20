/**
 * Dialect & Language Coach — evaluation feedback and situational dialogues.
 *
 * Deliberately does NOT replace the existing client-side pass/fail check
 * (arabicMatch() in dialect.tsx, a fast, free, offline word-overlap match
 * already reviewed and working). Calling an API for every single practice
 * attempt would be slower and quota-costly for a check that already works.
 * This agent adds what genuinely doesn't exist client-side: encouraging,
 * specific correction text, and mini-dialogues for a situation.
 *
 * Saudi regional dialects (Najdi, Hijazi, Janubi/Southern, Shamali/Northern,
 * Sharqi/Eastern) are low-resource for any current model compared to Modern
 * Standard Arabic or Egyptian/Levantine — this is likely the weakest of the
 * six agents. The prompt asks explicitly for the named dialect, not MSA, but
 * cannot guarantee the model actually knows the difference reliably. Flagged
 * to the user; a native speaker should spot-check output before this ships
 * to real users.
 */
import { getGemini, GEMINI_MODEL, parseJsonResponse } from "../../lib/gemini";
import {
  evaluateSchema,
  dialogueSchema,
  type DialectEvaluateRequest,
  type DialectEvaluateResult,
  type DialectDialogueRequest,
  type DialectDialogueResult,
} from "./dialect-types";
import { logger } from "../../lib/logger";

const DIALECT_LABEL: Record<string, string> = {
  najdi: "Najdi (Riyadh/central Saudi)",
  hijazi: "Hijazi (Jeddah/Makkah/Madinah)",
  janubi: "Janubi/Southern (Abha/Aseer)",
  shamali: "Shamali/Northern Saudi",
  sharqi: "Sharqi/Eastern (Dammam/Khobar)",
};

function evaluatePrompt(req: DialectEvaluateRequest): string {
  const label = DIALECT_LABEL[req.dialect] ?? req.dialect;
  return `A language learner is practising this ${label} Arabic phrase:

Arabic: ${req.targetArabic}
Transliteration: ${req.targetTransliteration}
Meaning: ${req.targetEnglish}

They said or typed: "${req.userAttempt}"

Judge generously — this is a beginner speaking a regional dialect, not reading perfect MSA. If it's a reasonable, recognisable attempt, mark it passed even if not perfect. If it clearly misses the phrase, mark it not passed and give ONE short, warm, specific tip (e.g. what sound or word to focus on) — never just "incorrect". Respond in ${req.languageName}.`;
}

function dialoguePrompt(req: DialectDialogueRequest): string {
  const label = DIALECT_LABEL[req.dialect] ?? req.dialect;
  return `Write a short (4-6 line) realistic dialogue in ${label} Arabic for this situation: "${req.situation}" — the kind of exchange a traveller in Saudi Arabia would actually have. Alternate between "local" and "traveller" speakers. Use real ${label} dialect words and phrasing, not Modern Standard Arabic — regional dialect is the whole point. For each line give the Arabic script, a transliteration, and the translation into ${req.languageName}.`;
}

const DEMO_EVALUATE: DialectEvaluateResult = {
  passed: false,
  feedback: "Close! Try softening the middle sound a little — it's more of a flowing 'ah' than a hard stop.",
  correctedArabic: "يا هلا",
  correctedTransliteration: "yā halā",
};

const DEMO_DIALOGUE: DialectDialogueResult = {
  lines: [
    { speaker: "local", arabic: "تفضل، وش تحب تطلب؟", transliteration: "tfaḍḍal, wish tḥibb tiṭlub?", translation: "Go ahead, what would you like to order?" },
    { speaker: "traveller", arabic: "أبي قهوة سعودية لو سمحت", transliteration: "abī gahwa sa'ūdiyya law samaḥt", translation: "I'd like Saudi coffee, please." },
    { speaker: "local", arabic: "تمام، وحده والا وحدتين؟", transliteration: "tamām, waḥda walla waḥdatēn?", translation: "Got it, one or two?" },
    { speaker: "traveller", arabic: "وحده بس، مشكور", transliteration: "waḥda bass, mashkūr", translation: "Just one, thank you." },
  ],
};

export async function runDialectEvaluate(
  req: DialectEvaluateRequest,
  demo: boolean,
): Promise<DialectEvaluateResult> {
  if (demo) {
    await new Promise((r) => setTimeout(r, 400));
    return DEMO_EVALUATE;
  }

  try {
    const ai = getGemini();
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts: [{ text: evaluatePrompt(req) }] }],
      config: { responseMimeType: "application/json", responseSchema: evaluateSchema, temperature: 0.4 },
    });
    if (!response.text) throw new Error("empty response");
    return parseJsonResponse<DialectEvaluateResult>(response.text);
  } catch (err) {
    logger.error({ err }, "Dialect evaluate failed");
    // A neutral, honest fallback beats surfacing a raw error mid-practice.
    return { passed: true, feedback: "I couldn't fully evaluate that attempt, but keep going — practice counts." };
  }
}

export async function runDialectDialogue(
  req: DialectDialogueRequest,
  demo: boolean,
): Promise<DialectDialogueResult> {
  if (demo) {
    await new Promise((r) => setTimeout(r, 600));
    return DEMO_DIALOGUE;
  }

  const ai = getGemini();
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: "user", parts: [{ text: dialoguePrompt(req) }] }],
    config: { responseMimeType: "application/json", responseSchema: dialogueSchema, temperature: 0.6 },
  });
  if (!response.text) throw new Error("empty response");
  return parseJsonResponse<DialectDialogueResult>(response.text);
}
