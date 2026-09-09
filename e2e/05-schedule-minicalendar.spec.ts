import { test, expect } from "@playwright/test";
import { loginAsCoach } from "./fixtures/auth";

test("desktop schedule: clicking a session in the mini-calendar selects it in the detail panel", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await loginAsCoach(page);
  await page.goto("/schedule");
  // This page is genuinely slower to finish loading than most — bit us
  // twice while writing tests (looked "stuck" on skeletons at both 5s and
  // 8s waits, then rendered fine at 10s+). Wait for real content, not a
  // fixed timeout.
  await page.getByText("SESSIONS TODAY", { exact: false }).waitFor({ state: "visible", timeout: 20_000 });
  await page.waitForTimeout(500);

  // Right panel starts with nothing selected.
  await expect(page.getByText("Select a session", { exact: true })).toBeVisible();

  // Click the 2nd "09:30" chip in DOM order — the mini-calendar's session
  // pills render before "Today's Timeline" below, so this is Thursday's,
  // one column after today's (Wednesday). Not asserting an exact total
  // count here since "09:30" also appears in the timeline/detail text.
  const pills = page.getByText("09:30", { exact: false });
  await pills.nth(1).click();

  // Detail panel should now show that specific session (tomorrow, since the
  // 2nd "09:30" pill is one column after today's), not today's — computed
  // dynamically so this doesn't hardcode a date that goes stale.
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const expectedLabel = tomorrow.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  const detail = page.getByText(expectedLabel, { exact: false });
  await expect(detail).toBeVisible({ timeout: 5_000 });
  await expect(page.getByRole("button", { name: "Edit session", exact: true })).toBeVisible();
});
