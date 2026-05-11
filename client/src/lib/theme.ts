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

  // Sync native iOS background color (covers the 34px home indicator area outside WKWebView)
  // Uses the bg-card color of each theme to match the nav bar
  const themeColors: Record<Theme, string> = {
    gamenight: "#131318",  // card: 228 16% 9%
    office:    "#ffffff",  // card: 0 0% 100%
    oldschool: "#3D2410",  // card: 30 50% 15%
  };
  const color = themeColors[theme];
  // Capacitor StatusBar plugin — sets background color of native UI areas
  try {
    const cap = (window as any).Capacitor;
    if (cap?.isNativePlatform?.()) {
      cap.Plugins?.StatusBar?.setBackgroundColor?.({ color });
    }
  } catch { /* ignore if plugin not available */ }
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
