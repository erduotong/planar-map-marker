import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import en from "./locales/en"
import zhCN from "./locales/zh-CN"

export type Language = "zh-CN" | "en"

export const LANGUAGE_STORAGE_KEY = "planar-map-marker:language"

/**
 * Test hook: vitest runs domain tests in a node environment without a DOM, so
 * src/test/setup.ts pins the language on globalThis before any module imports
 * this file.
 */
const TEST_LANGUAGE = (globalThis as { __TEST_LANGUAGE__?: Language })
  .__TEST_LANGUAGE__

function detectLanguage(): Language {
  if (TEST_LANGUAGE === "zh-CN" || TEST_LANGUAGE === "en") return TEST_LANGUAGE
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY)
    if (stored === "zh-CN" || stored === "en") return stored
  } catch {
    // Preference just won't survive a reload; fall through to detection.
  }
  return typeof navigator !== "undefined" &&
    navigator.language.toLowerCase().startsWith("zh")
    ? "zh-CN"
    : "en"
}

export function setLanguage(language: Language) {
  void i18n.changeLanguage(language)
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
  } catch {
    // Preference just won't survive a reload; not worth surfacing.
  }
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    "zh-CN": { translation: zhCN },
  },
  lng: detectLanguage(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
})

// Keep the <html lang> attribute in sync so screen readers and fonts pick the
// right language. Runs before first paint (imported from main.tsx). The DOM
// guards keep this importable in vitest's node environment.
i18n.on("languageChanged", (language) => {
  if (typeof document !== "undefined") document.documentElement.lang = language
})
if (typeof document !== "undefined")
  document.documentElement.lang = i18n.language

export default i18n
