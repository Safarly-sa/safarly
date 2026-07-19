import { useEffect, useState } from "react";
import en from "../locales/en.json";
import ar from "../locales/ar.json";
import de from "../locales/de.json";
import it from "../locales/it.json";
import fr from "../locales/fr.json";
import ur from "../locales/ur.json";
import zh from "../locales/zh.json";
import ru from "../locales/ru.json";
import { I18nContext, type Language } from "./translation-context";

type Translations = Record<string, string>;

const LOCALES: Record<Language, Translations> = { en, ar, de, it, fr, ur, zh, ru };
const RTL_LANGS = new Set<Language>(["ar", "ur"]);
const SUPPORTED_LANGS = new Set<Language>(["en", "ar", "de", "it", "fr", "ur", "zh", "ru"]);

function detectLocale(): Language {
  const stored = localStorage.getItem("safarly-lang");
  if (stored && SUPPORTED_LANGS.has(stored as Language)) {
    return stored as Language;
  }
  // Map navigator.language (e.g. "de-AT", "zh-CN", "ar") to nearest supported locale
  const nav = (navigator.language || "en").split("-")[0].toLowerCase();
  if (SUPPORTED_LANGS.has(nav as Language)) {
    return nav as Language;
  }
  return "en";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>(detectLocale);

  useEffect(() => {
    localStorage.setItem("safarly-lang", language);
    document.documentElement.lang = language;
    document.documentElement.dir = RTL_LANGS.has(language) ? "rtl" : "ltr";
  }, [language]);

  const t = (key: string): string =>
    LOCALES[language][key] ?? LOCALES["en"][key] ?? key;

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}
