import { useState, useEffect } from "react";

export type Theme = "gamenight" | "office" | "oldschool";

const STORAGE_KEY = "uscout-theme";
const DEFAULT_THEME: Theme = "gamenight";

/** Migrate pre-rename localStorage values */
const LEGACY_THEME_MAP: Record<string, Theme> = {
  game: "gamenight",
  work: "office",
  classic: "oldschool",
};

export function normalizeStoredTheme(raw: string | null): Theme {
  if (raw === "gamenight" || raw === "office" || raw === "oldschool") return raw;
  if (raw && raw in LEGACY_THEME_MAP) return LEGACY_THEME_MAP[raw]!;
  return DEFAULT_THEME;
}

/** Apply theme classes on `<html>` (used by onboarding before `useTheme` mounts). */
export function applyThemeToDocument(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("dark", "theme-office", "theme-oldschool");
  if (theme === "gamenight") root.classList.add("dark");
  if (theme === "office") root.classList.add("theme-office");
  if (theme === "oldschool") root.classList.add("theme-oldschool");
}

function applyTheme(theme: Theme) {
  applyThemeToDocument(theme);
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = normalizeStoredTheme(
      typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null,
    );
    return stored;
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    const initial = normalizeStoredTheme(raw);
    if (raw !== null && raw !== initial) {
      try {
        localStorage.setItem(STORAGE_KEY, initial);
      } catch {
        /* ignore */
      }
    }
    applyTheme(initial);
    setThemeState(initial);
  }, []);

  const setTheme = (t: Theme) => {
    localStorage.setItem(STORAGE_KEY, t);
    setThemeState(t);
    applyTheme(t);
  };

  return { theme, setTheme };
}
