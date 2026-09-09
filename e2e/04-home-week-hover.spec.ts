import { test, expect } from "@playwright/test";
import { loginAsCoach } from "./fixtures/auth";

test("desktop home: hovering a day in This Week shows that day's sessions", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await loginAsCoach(page);
  await page.goto("/home");
  // Give the week/session data time to actually load — hovering before it
  // does just shows a premature "No sessions" state, not a real bug (this
  // bit us once while writing this test).
  await page.getByText("SESSIONS THIS WEEK", { exact: false }).waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForTimeout(1000);

  await page.getByRole("button", { name: "Wed" }).hover();
  await page.waitForTimeout(600);
  const card = page.getByText("WEDNESDAY, SEP 9", { exact: false });
  await expect(card).toBeVisible({ timeout: 8_000 });
  // Should list the day's real sessions, not a "No sessions" placeholder.
  await expect(page.getByText("No sessions", { exact: true })).not.toBeVisible();
});
