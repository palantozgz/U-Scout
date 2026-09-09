import { test, expect } from "@playwright/test";
import { loginAsCoach } from "./fixtures/auth";

// PRECONDITION: QA coach must be temporarily head_coach for this test to
// even reach the toggles (My Club redirects non-head_coach roles away).
// Grant it the same way Pablo does for manual QA (SQL in Supabase — see
// ways-of-working memory for the exact statements), run this file, then
// revert club_members.role/user_roles/auth user_metadata back to "coach"
// and verify with a read, same as after any other manual privilege grant.
//
// Real Jiangxi club data: U Scout / U Stats / U Playbook are deliberately
// disabled right now (preseason phase), only Schedule & Wellness is on.
// This test only ever touches "U Playbook" (currently OFF) and always
// restores it to OFF before finishing. It waits for the actual PATCH
// /api/club network response (the toggle is optimistic-UI, see
// usePatchClub() in club-api.ts) before reloading to check persistence —
// reloading right after the click races the request and can leave the
// real club in the wrong state, which happened once while writing this
// test and was fixed by hand in Supabase. Never touches "Schedule &
// Wellness" (currently ON and in real use).
function playbookSwitch(page: import("@playwright/test").Page) {
  const label = page.getByText("U Playbook", { exact: true });
  const row = label.locator("xpath=ancestor::div[.//button[@role='switch']][1]");
  return row.locator('button[role="switch"]');
}

test("head coach can toggle a club module on and off instantly", async ({ page }) => {
  await loginAsCoach(page);
  await page.goto("/coach/club");
  await page.waitForTimeout(2500);
  await page.getByText("Modules", { exact: true }).scrollIntoViewIfNeeded();

  const sw = playbookSwitch(page);
  await expect(sw).toBeVisible({ timeout: 10_000 });

  // Sanity: must start OFF (real prod state). If this ever fails, someone
  // enabled U Playbook for real since this test was written — stop rather
  // than assume and flip it off ourselves.
  await expect(sw).toHaveAttribute("aria-checked", "false");

  const patchOn = page.waitForResponse(
    (r) => r.url().includes("/api/club") && r.request().method() === "PATCH",
  );
  await sw.click();
  // Instant optimistic UI feedback — this is the actual UX being tested.
  await expect(sw).toHaveAttribute("aria-checked", "true", { timeout: 2_000 });
  const patchOnRes = await patchOn;
  expect(patchOnRes.ok()).toBeTruthy();

  // Now that the write has actually landed, reload to prove it's really
  // persisted server-side and not just optimistic local UI state.
  await page.reload();
  await page.waitForTimeout(2500);
  await page.getByText("Modules", { exact: true }).scrollIntoViewIfNeeded();
  const swAfterReload = playbookSwitch(page);
  await expect(swAfterReload).toHaveAttribute("aria-checked", "true", { timeout: 10_000 });

  // Revert immediately, same wait-for-network discipline.
  const patchOff = page.waitForResponse(
    (r) => r.url().includes("/api/club") && r.request().method() === "PATCH",
  );
  await swAfterReload.click();
  await expect(swAfterReload).toHaveAttribute("aria-checked", "false", { timeout: 2_000 });
  const patchOffRes = await patchOff;
  expect(patchOffRes.ok()).toBeTruthy();

  await page.reload();
  await page.waitForTimeout(2500);
  await page.getByText("Modules", { exact: true }).scrollIntoViewIfNeeded();
  const swFinal = playbookSwitch(page);
  await expect(swFinal).toHaveAttribute("aria-checked", "false", { timeout: 10_000 });
});
