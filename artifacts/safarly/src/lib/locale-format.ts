import type { Language } from "@/providers/translation-context";

/**
 * BCP-47 tag used for Intl.DateTimeFormat / toLocaleDateString calls.
 * Centralised because the app previously duplicated `language === "ar" ?
 * "ar-SA" : "en-GB"` in three places, which silently rendered every non-Arabic
 * locale (de, it, fr, ur, zh, ru) in British English date formatting.
 */
const LOCALE_TAG: Record<Language, string> = {
  en: "en-GB",
  ar: "ar-SA",
  de: "de-DE",
  it: "it-IT",
  fr: "fr-FR",
  ur: "ur-PK",
  zh: "zh-CN",
  ru: "ru-RU",
  tr: "tr-TR",
  es: "es-ES",
  pt: "pt-PT",
};

export function localeTag(language: Language): string {
  return LOCALE_TAG[language];
}
