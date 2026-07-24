/**
 * Maps a UI language code to the English name of that language.
 *
 * The agent routes take a `languageName` string and put it straight into a
 * prompt ("Respond in {languageName}"), so these are deliberately the English
 * exonyms — "German", not "Deutsch". Models follow an English instruction more
 * reliably than one naming the target language in the target language.
 *
 * Shared rather than per-page: Live Lens and trip enrichment both send it, and
 * two copies of this map would drift the moment a locale is added.
 */

import type { Language } from "@/providers/translation-context";

export const LANGUAGE_NAMES: Record<Language, string> = {
  en: "English", ar: "Arabic", de: "German", fr: "French",
  it: "Italian", ru: "Russian", ur: "Urdu", zh: "Chinese",
  tr: "Turkish", es: "Spanish", pt: "Portuguese",
};

/** Falls back to English for anything unrecognised — never sends an empty instruction. */
export function languageNameOf(language: string): string {
  return LANGUAGE_NAMES[language as Language] ?? "English";
}
