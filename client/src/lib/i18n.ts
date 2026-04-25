// Re-export shim — all existing imports from "@/lib/i18n" continue to work unchanged
export type { Locale, I18nKey } from "./i18n-core";
export { t, getLocale, setLocale, useLocale } from "./i18n-core";
