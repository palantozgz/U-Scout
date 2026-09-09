import { test, expect } from "@playwright/test";
import { loginAsPlayer, loginAsCoach } from "./fixtures/auth";

// Submits a real wellness check-in as QA player (upsert on user_id+entry_date,
// so re-running this test the same day just updates today's row rather than
// creating duplicates) and confirms it's reflected in the coach's staff
// Wellness view. Daily check-ins are the QA player account's normal expected
// use, so this intentionally does not delete the entry afterward.
test("player submits wellness check-in, coach sees it in staff view", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAsPlayer(page);
  await page.goto("/player/wellness");
  await page.getByText("Sleep quality", { exact: false })
    .or(page.getByText("Check-in submitted", { exact: false }))
    .first()
    .waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForTimeout(500);

  // Already submitted today (re-running this test same day) → reopen the form.
  const editBtn = page.getByRole("button", { name: "Edit check-in", exact: true });
  if (await editBtn.isVisible().catch(() => false)) {
    await editBtn.click();
    await page.waitForTimeout(500);
  }

  // Pick a score different from whatever's already selected (editing an
  // already-submitted entry with the *same* value doesn't dirty the form,
  // so Submit stays disabled) — alternate between 3 and 4 based on current state.
  const alreadyThree = await page.getByRole("radio", { name: "3", exact: true, checked: true }).count();
  const targetScore = alreadyThree > 0 ? "4" : "3";
  const targetRadios = page.getByRole("radio", { name: targetScore, exact: true });
  await expect(targetRadios).toHaveCount(4); // one per question: sleep/energy/soreness/readiness
  for (let i = 0; i < 4; i++) {
    await targetRadios.nth(i).click();
    await page.waitForTimeout(150);
  }

  const submitBtn = page.getByTestId("wellness-standalone-submit");
  await expect(submitBtn).toBeEnabled({ timeout: 5_000 });
  const submitRes = page.waitForResponse(
    (r) => /wellness_entries/i.test(r.url()) && ["POST", "PATCH", "PUT"].includes(r.request().method()),
  );
  await submitBtn.click();
  const res = await submitRes;
  expect(res.ok()).toBeTruthy();

  // Now confirm the coach's staff view reflects it.
  const coachPage = await page.context().browser()!.newContext().then((c) => c.newPage());
  await coachPage.setViewportSize({ width: 390, height: 844 });
  await loginAsCoach(coachPage);
  await coachPage.goto("/schedule");
  await coachPage.getByText("Wellness", { exact: true }).click();
  await coachPage.waitForTimeout(2000);
  // "Submitted %" reflects real-time submission state — more reliable than
  // asserting on "Highest Risk", which only shows watchouts for genuinely
  // risky scores (a 4/5 check-in correctly shows "No watchouts").
  await expect(coachPage.getByText("100%", { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(coachPage.getByText("1/1 submitted", { exact: false })).toBeVisible();
  await coachPage.close();
});
