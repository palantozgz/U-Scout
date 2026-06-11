import { useState, useCallback, useEffect } from "react";
import { useClubGenderValue } from "./clubGenderContext";
import { candidateSpanishKeysForGender } from "./spanishClubGenderI18n";
import type { ClubGender } from "@shared/club-context";
// ─── i18n-core ────────────────────────────────────────────────────────────────
// en.ts is loaded dynamically (not statically imported) to keep it out of the
// main bundle. On Capacitor it's a local disk read (<10ms).
// import type gives us the key names for TypeScript without bundling the value.
import type enBundleType from "./locales/en";

export type Locale = "en" | "es" | "zh";
export type I18nKey = keyof typeof enBundleType;

// Runtime value — starts empty, populated by initLocale() before first render.
let enBundle: Record<string, string> = {};
let activeBundle: Record<string, string> = {};
let globalLocale: Locale = "en";
const listeners = new Set<() => void>();

async function loadLocale(locale: Locale): Promise<void> {
  if (locale === "en") {
    if (Object.keys(enBundle).length === 0) {
      const mod = await import("./locales/en");
      enBundle = mod.default as Record<string, string>;
    }
    activeBundle = { ...enBundle };
  } else if (locale === "es") {
    const mod = await import("./locales/es");
    activeBundle = mod.default as Record<string, string>;
  } else if (locale === "zh") {
    const mod = await import("./locales/zh");
    activeBundle = mod.default as Record<string, string>;
  }
  globalLocale = locale;
  try { localStorage.setItem("uscout_locale", locale); } catch {}
  listeners.forEach(fn => fn());
}

function readSavedLocale(): Locale {
  try {
    const saved = localStorage.getItem("uscout_locale") as Locale | null;
    if (saved && ["en", "es", "zh"].includes(saved)) return saved;
  } catch {}
  return "en";
}

/**
 * initLocale — must be called in main.tsx BEFORE ReactDOM.render().
 * Loads en.ts (always needed as fallback) + the user's saved locale.
 * On Capacitor this completes in <10ms (local disk reads).
 */
export async function initLocale(): Promise<void> {
  const saved = readSavedLocale();
  // Always load en first — it's the fallback for missing keys in other locales.
  const enMod = await import("./locales/en");
  enBundle = enMod.default as Record<string, string>;
  if (saved === "en") {
    activeBundle = { ...enBundle };
    globalLocale = "en";
  } else {
    // Load saved locale on top of en
    await loadLocale(saved);
  }
}

function translateWithClubGender(key: string, clubGender: ClubGender | null): string {
  const has = (k: string) => Object.prototype.hasOwnProperty.call(activeBundle, k);
  const resolvedKey =
    globalLocale === "es"
      ? candidateSpanishKeysForGender(key, clubGender).find(has) ?? key
      : key;
  return (
    activeBundle[resolvedKey] ??
    enBundle[resolvedKey] ??
    enBundle[key] ??
    key
  );
}

export function setLocale(locale: Locale) { loadLocale(locale); }
export function getLocale(): Locale { return globalLocale; }

// Static t() — outside React; returns key name as fallback if locale not loaded.
export function t(key: I18nKey): string {
  return translateWithClubGender(key as string, null);
}

// React hook — always use inside components
export function useLocale() {
  const [locale, setLocaleState] = useState<Locale>(globalLocale);
  const clubGender = useClubGenderValue();

  useEffect(() => {
    const update = () => setLocaleState(globalLocale);
    listeners.add(update);
    return () => { listeners.delete(update); };
  }, []);

  const changeLocale = useCallback(async (newLocale: Locale) => {
    await loadLocale(newLocale);
    setLocaleState(newLocale);
  }, []);

  const tFn = useCallback(
    (key: I18nKey): string => translateWithClubGender(key as string, clubGender),
    [locale, clubGender],
  );

  return { locale, changeLocale, t: tFn };
}
