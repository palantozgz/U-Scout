import { normalizeStoredTheme } from "./lib/theme";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Apply saved theme before first render (prevents flash)
const _st = normalizeStoredTheme(
  typeof localStorage !== "undefined" ? localStorage.getItem("uscout-theme") : null,
);
const _r = document.documentElement;
_r.classList.remove("dark", "theme-office", "theme-oldschool");
if (_st === "gamenight") _r.classList.add("dark");
if (_st === "office") _r.classList.add("theme-office");
if (_st === "oldschool") _r.classList.add("theme-oldschool");

createRoot(document.getElementById("root")!).render(<App />);
