import { defineConfig, devices } from "@playwright/test";

// E2E suite for U Core. Runs against a live Supabase-backed environment
// (production by default) using the two QA accounts — see e2e/fixtures/auth.ts.
// Set BASE_URL to point at a different environment if one ever exists.
const PROD_URL = "https://u-scout-production.up.railway.app";
const resolvedBaseURL = process.env.BASE_URL || PROD_URL;

// Guarda de seguridad: los E2E mutan datos reales del club QA en produccion
// (ver e2e/fixtures/auth.ts). Antes esto corria contra produccion por
// defecto sin ningun aviso -- ahora hace falta confirmarlo explicitamente.
if (resolvedBaseURL === PROD_URL && process.env.E2E_CONFIRM_PROD !== "yes") {
  throw new Error(
    "[e2e] BASE_URL apunta a produccion (" + PROD_URL + ") y esto mutara datos " +
    "reales del club QA. Si es intencional, vuelve a correr con " +
    "E2E_CONFIRM_PROD=yes npx playwright test ...",
  );
}

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  // Tests share real data in the Jiangxi QA club — never run them in parallel
  // workers or they will race on the same rows.
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "e2e/report" }]],
  use: {
    baseURL: resolvedBaseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
