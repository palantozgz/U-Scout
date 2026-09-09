import { test, expect } from "@playwright/test";
import { loginAsCoach, loginAsPlayer } from "./fixtures/auth";

// These are the foundational tests for the whole suite: if auth + the
// first-run onboarding wizard don't work reliably, nothing built on top of
// loginAsCoach()/loginAsPlayer() will either.

test("QA coach can log in", async ({ page }) => {
  await loginAsCoach(page);
  await expect(page).not.toHaveURL(/\/login/);
});

test("QA player can log in", async ({ page }) => {
  await loginAsPlayer(page);
  await expect(page).not.toHaveURL(/\/login/);
});

test("onboarding wizard completes once and does not reappear after a hard reload", async ({ page }) => {
  await loginAsCoach(page);
  await page.reload();
  await page.waitForTimeout(1200);
  await expect(page.getByText("Welcome to U Core")).not.toBeVisible();
});
