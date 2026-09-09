import { test, expect } from "@playwright/test";
import { loginAsCoach } from "./fixtures/auth";

// Real Jiangxi club has no week templates right now — this test creates one
// throwaway template and always deletes it via the real UI before finishing,
// verifying deletion with the actual DELETE network response (not just a
// hopeful .catch(() => false) — a first version of this test silently left
// a template behind in production because of exactly that mistake).
test("create, view, and delete a week template", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAsCoach(page);
  await page.goto("/schedule");
  await page.waitForTimeout(3000);
  await page.getByText("Planner", { exact: true }).click();
  await page.waitForTimeout(1500);
  await page.getByTestId("schedule-week-templates").click();
  await page.waitForTimeout(1000);

  const templateName = `QA E2E template ${Date.now()}`;
  const createRes = page.waitForResponse(
    (r) => r.url().includes("/api/club/week-templates") && r.request().method() === "POST",
  );
  await page.getByText("Save current week as template", { exact: false }).click();
  await page.waitForTimeout(500);
  await page.locator('input[placeholder]').first().fill(templateName);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const createdRes = await createRes;
  expect(createdRes.ok()).toBeTruthy();

  // Confirm it actually shows up in the list (not just that the API accepted it).
  await expect(page.getByText(templateName, { exact: true })).toBeVisible({ timeout: 8_000 });

  const deleteBtn = page.getByRole("button", { name: "Delete", exact: true });
  await expect(deleteBtn).toBeVisible({ timeout: 8_000 });
  const deleteRes = page.waitForResponse(
    (r) => r.url().includes("/api/club/week-templates") && r.request().method() === "DELETE",
  );
  await deleteBtn.click();
  const deletedRes = await deleteRes;
  expect(deletedRes.ok()).toBeTruthy();
  await expect(page.getByText(templateName, { exact: true })).not.toBeVisible({ timeout: 8_000 });
});
