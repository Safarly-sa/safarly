import { Type } from "@google/genai";

/** Mirrors DialectKey in artifacts/safarly/src/pages/dialect.tsx. */
export const DIALECTS = ["najdi", "hijazi", "janubi", "shamali", "sharqi"] as const;
export type Dialect = (typeof DIALECTS)[number];

export interface DialectEvaluateRequest {
  dialect: Dialect;
  targetArabic: string;
  targetTransliteration: string;
  targetEnglish: string;
  /** Already transcribed client-side via the Web Speech API, or typed — the server never sees audio. */
  userAttempt: string;
  languageName: string;
}

export interface DialectEvaluateResult {
  passed: boolean;
  feedback: string;
  correctedArabic?: string;
  correctedTransliteration?: string;
}

export interface DialectLine {
  speaker: "local" | "traveller";
  arabic: string;
  transliteration: string;
  translation: string;
}

export interface DialectDialogueRequest {
  dialect: Dialect;
  situation: string;
  languageName: string;
}

export interface DialectDialogueResult {
  lines: DialectLine[];
}

export const evaluateSchema = {
  type: Type.OBJECT,
  properties: {
    passed: { type: Type.BOOLEAN, description: "True if the attempt is a reasonable, understandable try at the phrase — be lenient, this is a learner" },
    feedback: { type: Type.STRING, description: "One or two short, encouraging sentences. If it didn't pass, say what to adjust — never just 'wrong'." },
    correctedArabic: { type: Type.STRING, description: "Only if passed is false: the correct Arabic script, for reference" },
    correctedTransliteration: { type: Type.STRING, description: "Only if passed is false: the correct transliteration" },
  },
  required: ["passed", "feedback"],
};

export const dialogueSchema = {
  type: Type.OBJECT,
  properties: {
    lines: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          speaker: { type: Type.STRING, enum: ["local", "traveller"] },
          arabic: { type: Type.STRING, description: "In the requested Saudi regional dialect, not Modern Standard Arabic" },
          transliteration: { type: Type.STRING },
          translation: { type: Type.STRING },
        },
        required: ["speaker", "arabic", "transliteration", "translation"],
      },
    },
  },
  required: ["lines"],
};
