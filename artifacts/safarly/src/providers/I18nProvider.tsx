import React, { createContext, useContext, useEffect, useState } from "react";
import en from "../locales/en.json";
import ar from "../locales/ar.json";

type Language = "en" | "ar";
type Translations = Record<string, string>;

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

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

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useTranslation must be used within an I18nProvider");
  }
  return context;
}
