import { type Page, expect } from "@playwright/test";

// QA-only accounts, real production accounts scoped to the Jiangxi test club.
// See CLAUDE_CONTEXT.md / ways-of-working memory for the full rules around them.
export const QA_COACH = {
  email: "ucore.qa.coach@gmail.com",
  password: "QaCoach2026!",
};

export const QA_PLAYER = {
  email: "ucore.qa.player@gmail.com",
  password: "QaPlayer2026!",
};

/**
 * First-time onboarding (language -> theme -> tutorial) shows for any
 * account/browser profile that hasn't completed it yet (tracked in
 * localStorage under `uscout_onboarding_v2:<userId>` — see
 * client/src/lib/onboarding-state.ts). Playwright always starts with a
 * clean profile, so this shows on every test run.
 *
 * NOTE for future-me: this is NOT a bug in the app. It genuinely renders
 * ~1 tick after auth/profile resolve. An earlier version of this helper
 * used a short isVisible() probe for just the first step and blind
 * .click() calls after — that intermittently missed the "English" step
 * (checked before it mounted), silently left onboarding incomplete for
 * the rest of the test, and looked exactly like a "flag doesn't persist"
 * bug on reload. It wasn't — confirmed by re-running the flow with
 * explicit waitFor() on every step 3/3 times clean. Keep the explicit
 * waitFor on every step here; don't "simplify" it back to isVisible().
 */
export async function completeOnboardingIfPresent(page: Page) {
  const englishOption = page.getByText("English", { exact: true });
  const isPresent = await englishOption
    .waitFor({ state: "visible", timeout: 8_000 })
    .then(() => true)
    .catch(() => false);
  if (!isPresent) return;

  await englishOption.click();
  const nextBtn = page.getByRole("button", { name: "Next" });
  await nextBtn.waitFor({ state: "visible", timeout: 8_000 });
  await nextBtn.click();

  const skipBtn = page.getByText("Skip tour", { exact: true });
  await skipBtn.waitFor({ state: "visible", timeout: 8_000 });
  await skipBtn.click();

  // Let the localStorage write + onDone() state update settle before
  // whatever navigation the caller does next.
  await page.waitForTimeout(400);
}

/**
 * Logs in through the real /login form (not a localStorage/token shortcut) so
 * the test exercises the same path a real user does, then clears the
 * first-run onboarding wizard so the rest of the app is reachable.
 */
export async function loginAs(page: Page, creds: { email: string; password: string }) {
  await page.goto("/login");
  const emailInput = page.locator('input[type="email"]');
  const passwordInput = page.locator('input[type="password"]');
  await expect(emailInput).toBeVisible();
  await emailInput.fill(creds.email);
  await passwordInput.fill(creds.password);
  await passwordInput.press("Enter");
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });
  await completeOnboardingIfPresent(page);
}

export async function loginAsCoach(page: Page) {
  await loginAs(page, QA_COACH);
}

export async function loginAsPlayer(page: Page) {
  await loginAs(page, QA_PLAYER);
}

/**
 * Use for any in-app navigation instead of page.goto() when there's a risk
 * the onboarding wizard could reappear. Not expected once genuinely
 * completed — this is just a safety net for a hard reload mid-test.
 */
export async function gotoInApp(page: Page, path: string) {
  await page.goto(path);
  await completeOnboardingIfPresent(page);
}
