import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { storage } from "@/src/utils/storage";

import en from "./locales/en";
import hi from "./locales/hi";
import te from "./locales/te";

export const LANG_KEY = "karigar_lang";

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, hi: { translation: hi }, te: { translation: te } },
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  returnNull: false,
});

export async function loadSavedLanguage() {
  const saved = await storage.getItem(LANG_KEY, "");
  if (saved && typeof saved === "string") {
    await i18n.changeLanguage(saved);
  }
  return saved;
}

export async function setLanguage(code: string) {
  await storage.setItem(LANG_KEY, code);
  await i18n.changeLanguage(code);
}

export default i18n;
