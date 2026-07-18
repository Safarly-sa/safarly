import { createContext, useContext } from "react";

export type Language = "en" | "ar";

export interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

// The context lives here so I18nProvider.tsx (component) and useTranslation
// (hook) can be in separate files — keeping Vite Fast Refresh happy.
export const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function useTranslation(): I18nContextType {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useTranslation must be used within an I18nProvider");
  }
  return context;
}
