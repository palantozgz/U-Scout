import { defineConfig, devices } from "@playwright/test";

// E2E suite for U Core. Runs against a live Supabase-backed environment
// (production by default) using the two QA accounts — see e2e/fixtures/auth.ts.
// Set BASE_URL to point at a different environment if one ever exists.
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
    baseURL: process.env.BASE_URL || "https://u-scout-production.up.railway.app",
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
