import { useEffect, useState } from "react";
import en from "../locales/en.json";
import ar from "../locales/ar.json";
import { I18nContext, type Language } from "./translation-context";

type Translations = Record<string, string>;

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    const stored = localStorage.getItem("safarly-lang");
    return (stored as Language) || "en";
  });

  useEffect(() => {
    localStorage.setItem("safarly-lang", language);
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  }, [language]);

  const t = (key: string): string => {
    const translations: Translations = language === "ar" ? ar : en;
    return translations[key] || key;
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}
