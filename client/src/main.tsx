import { normalizeStoredTheme } from "./lib/theme";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initLocale } from "./lib/i18n-core";

// Apply saved theme before first render (prevents flash)
const _st = normalizeStoredTheme(
  typeof localStorage !== "undefined" ? localStorage.getItem("uscout-theme") : null,
);
const _r = document.documentElement;
_r.classList.remove("dark", "theme-office", "theme-oldschool");
if (_st === "gamenight") _r.classList.add("dark");
if (_st === "office") _r.classList.add("theme-office");
if (_st === "oldschool") _r.classList.add("theme-oldschool");

/**
 * Pre-load the active locale BEFORE React renders.
 * On Capacitor (local disk) this completes in <10ms.
 * On web it's a same-origin fetch, also <50ms.
 * We give it 3s max; if it somehow hangs, we render anyway with key fallbacks.
 */
const localeReady = Promise.race([
  initLocale(),
  new Promise<void>(resolve => setTimeout(resolve, 3_000)), // safety timeout
]);

localeReady.then(() => {
  createRoot(document.getElementById("root")!).render(<App />);
});
