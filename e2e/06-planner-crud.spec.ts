import { test, expect } from "@playwright/test";
import { loginAsCoach } from "./fixtures/auth";

// Full CRUD cycle on a single throwaway session in the desktop Planner:
// create -> edit (duration) -> move (native HTML5 drag-and-drop) -> delete.
// Uses the planner-cell-<slot>-<date> data-testid (see Schedule.tsx) rather
// than text/coordinate locators — an earlier version of this test relied on
// text matching and pixel coordinates, which repeatedly broke because a
// same-text phantom node sits at x≈-99053 (passes Playwright's :visible
// check) and because the grid re-renders in a way that shifts pixel
// coordinates from run to run. The testid is added specifically so this
// test (and any future one) can target a cell reliably.
test("planner: create, edit, drag-move, and delete a session", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await loginAsCoach(page);
  await page.goto("/schedule");
  await page.getByText("SESSIONS TODAY", { exact: false }).waitFor({ state: "visible", timeout: 20_000 });
  await page.getByRole("button", { name: "Planner", exact: true }).click();
  await page.waitForTimeout(1_500);

  // CREATE — in the real, empty Sun/Evening slot.
  const sunEvening = page.getByTestId("planner-cell-evening-2026-09-13");
  await expect(sunEvening).toBeVisible({ timeout: 10_000 });
  await sunEvening.getByText("+ Add session", { exact: true }).click();
  await page.waitForTimeout(600);
  const createRes = page.waitForResponse(
    (r) => /schedule_events/i.test(r.url()) && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Create session", exact: true }).click();
  const created = await (await createRes).json();
  expect(created.id).toBeTruthy();

  // EDIT — reopen the same cell, bump duration 90' -> 120'. Wait for the
  // cell's UI to actually swap from "+ Add session" to the created card
  // first — double-clicking too soon (before the query cache updates) hits
  // the stale empty-slot button and opens a second CREATE dialog instead.
  await expect(sunEvening.getByText("+ Add session", { exact: true })).not.toBeVisible({ timeout: 8_000 });
  await sunEvening.dblclick();
  await page.waitForTimeout(800);
  await expect(page.getByRole("button", { name: "Save changes", exact: true })).toBeVisible({ timeout: 5_000 });
  await page.getByRole("button", { name: /^120/ }).click();
  const saveRes = page.waitForResponse(
    (r) => /schedule_events/i.test(r.url()) && ["PATCH", "PUT"].includes(r.request().method()),
  );
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  const saved = await (await saveRes).json();
  expect(saved.ends_at).toContain("12:00:00"); // 10:00 + 120' = 12:00

  // MOVE — native HTML5 drag-and-drop to Sat/Evening (also empty).
  await page.waitForTimeout(800);
  const satEvening = page.getByTestId("planner-cell-evening-2026-09-12");
  const moveRes = page.waitForResponse(
    (r) => /schedule_events/i.test(r.url()) && ["PATCH", "PUT"].includes(r.request().method()),
  );
  await sunEvening.dragTo(satEvening);
  const moved = await (await moveRes).json();
  expect(moved.starts_at).toContain("2026-09-12");

  // DELETE — only reachable from "Today's Timeline", so drag it onto today
  // first, then use its "More" menu -> "Cancel session".
  await page.waitForTimeout(800);
  const todayEvening = page.getByTestId("planner-cell-evening-2026-09-10");
  const moveTodayRes = page.waitForResponse(
    (r) => /schedule_events/i.test(r.url()) && ["PATCH", "PUT"].includes(r.request().method()),
  );
  await satEvening.dragTo(todayEvening);
  await moveTodayRes;
  await page.waitForTimeout(800);

  await page.getByRole("button", { name: "List", exact: true }).click();
  await page.waitForTimeout(1_500);
  const moreButtons = page.getByRole("button", { name: "More", exact: true });
  await moreButtons.last().click();
  await page.waitForTimeout(500);
  await page.getByText("Cancel session", { exact: true }).click();
  await page.waitForTimeout(600);
  const deleteRes = page.waitForResponse(
    (r) => /schedule_events/i.test(r.url()) && r.request().method() === "DELETE",
  );
  await page.getByRole("button", { name: /Cancel session/i }).last().click();
  const deleteResponse = await deleteRes;
  expect(deleteResponse.status()).toBe(204);
});
