import { useState, useCallback, useEffect } from "react";
import { useClubGenderValue } from "./clubGenderContext";
import { candidateSpanishKeysForGender } from "./spanishClubGenderI18n";
import type { ClubGender } from "@shared/club-context";
import enBundle from "./locales/en";

export type Locale = "en" | "es" | "zh";
export type I18nKey = keyof typeof enBundle;

let activeBundle: Record<string, string> = { ...enBundle };
let globalLocale: Locale = "en";
const listeners = new Set<() => void>();

async function loadLocale(locale: Locale): Promise<void> {
  if (locale === "en") {
    activeBundle = { ...enBundle };
  } else if (locale === "es") {
    const mod = await import("./locales/es");
    activeBundle = mod.default;
  } else if (locale === "zh") {
    const mod = await import("./locales/zh");
    activeBundle = mod.default;
  }
  globalLocale = locale;
  try { localStorage.setItem("uscout_locale", locale); } catch {}
  listeners.forEach(fn => fn());
}

function loadSavedLocale(): Locale {
  try {
    const saved = localStorage.getItem("uscout_locale") as Locale | null;
    if (saved && ["en", "es", "zh"].includes(saved)) return saved;
  } catch {}
  return "en";
}

// Bootstrap: EN is sync (already imported), ES/ZH load async if needed
const savedLocale = loadSavedLocale();
if (savedLocale !== "en") {
  loadLocale(savedLocale);
} else {
  globalLocale = "en";
}

function translateWithClubGender(key: string, clubGender: ClubGender | null): string {
  const has = (k: string) => Object.prototype.hasOwnProperty.call(activeBundle, k);
  const resolvedKey =
    globalLocale === "es"
      ? candidateSpanishKeysForGender(key, clubGender).find(has) ?? key
      : key;
  return (
    activeBundle[resolvedKey] ??
    (enBundle as Record<string, string>)[resolvedKey] ??
    (enBundle as Record<string, string>)[key] ??
    key
  );
}

export function setLocale(locale: Locale) { loadLocale(locale); }
export function getLocale(): Locale { return globalLocale; }

// Static t() — outside React; returns EN as fallback if locale not loaded yet
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
