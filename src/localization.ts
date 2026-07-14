import { createInstance, type TFunction } from "i18next";
import english from "./locales/en.json" with { type: "json" };
import russian from "./locales/ru.json" with { type: "json" };

export const SUPPORTED_LOCALES = ["en", "ru"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export type Translate = TFunction;

const i18n = createInstance();
i18n.init({
  fallbackLng: "en",
  initAsync: false,
  interpolation: { escapeValue: false },
  resources: {
    en: { translation: english },
    ru: { translation: russian },
  },
  returnNull: false,
});

export function localeFromLanguageCode(
  languageCode: null | string | undefined
): Locale {
  const language = languageCode?.trim().toLowerCase().split("-", 1)[0];
  return language === "ru" ? "ru" : "en";
}

export function getTranslator(locale: Locale): Translate {
  return i18n.getFixedT(locale);
}
