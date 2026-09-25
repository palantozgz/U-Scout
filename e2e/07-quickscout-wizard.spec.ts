import { test, expect, type Page } from "@playwright/test";
import { loginAsCoach, gotoInApp } from "./fixtures/auth";

// Cubre el flujo real de creacion de ficha de practica -> asistente rapido
// (QuickScout, situacion ISO completa) -> verificacion de que el motor
// real (ensamblarReporte) ya puntua la ficha, sin pasar por Film Room
// (eso requiere status "submitted" en scout_versions via un flujo de envio
// distinto que QuickScout NO toca).
//
// Limpieza: borra la ficha de práctica creada en un `finally` -- estos son
// datos reales y compartidos del club QA de Jiangxi, no se dejan huerfanos
// aunque el test falle a mitad.
//
// Timeout: 120s en vez de los 45s globales. En produccion POST /api/players
// ha tardado 12-17s medidos en logs de Railway (2026-09-25) -- latencia de
// servidor, no del test; con 45s el flujo completo no cabia.

// La app autentica con Bearer token de Supabase (no cookies), asi que
// page.request.* va sin credenciales y devuelve 401. El DELETE se lanza
// desde dentro de la pagina con el token de la sesion real.
async function deleteAsSessionUser(page: Page, playerId: string): Promise<number> {
  return page.evaluate(async (id) => {
    const key = Object.keys(localStorage).find((k) => /^sb-.*-auth-token$/.test(k));
    const token = key ? JSON.parse(localStorage.getItem(key) || "{}").access_token : undefined;
    const r = await fetch(`/api/players/${id}`, {
      method: "DELETE",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return r.status;
  }, playerId);
}

test("quick scout: crea ficha de práctica, completa el asistente ISO, verifica que persiste", async ({ page }) => {
  test.setTimeout(120_000);
  await loginAsCoach(page);
  await gotoInApp(page, "/coach/my-scout");

  const uniqueName = `E2E QuickScout ${Date.now()}`;

  // Crear ficha de práctica.
  await page.getByTestId("myscout-add-player").click();
  await page.getByTestId("myscout-new-player-name").fill(uniqueName);
  await page.getByTestId("myscout-new-player-number").fill("99");
  const createRes = page.waitForResponse(
    (r) => r.url().endsWith("/api/players") && r.request().method() === "POST",
    { timeout: 40_000 },
  );
  await page.getByTestId("myscout-new-player-save").click();
  const created = await (await createRes).json();
  const playerId = created.id as string;
  expect(playerId).toBeTruthy();

  try {
    // handleCreate navega directa a /coach/player/:id -- confirmamos.
    await page.waitForURL(`**/coach/player/${playerId}`, { timeout: 15_000 });

    // Saltar al asistente rápido para esta ficha.
    await gotoInApp(page, `/coach/quick-scout/${playerId}`);

    await page.getByTestId("quickscout-situation-iso").click();
    await page.getByTestId("quickscout-next").click();
    await page.getByTestId("quickscout-isoDir-Right").click();
    await page.getByTestId("quickscout-next").click();
    await page.getByTestId("quickscout-isoDec-Finish").click();
    await page.getByTestId("quickscout-next").click();
    await page.getByTestId("quickscout-isoAth-3").click();
    await page.getByTestId("quickscout-next").click();
    await page.getByTestId(`quickscout-isoCloseout-Catch & Shoot`).click();

    const finishRes = page.waitForResponse(
      (r) => r.url().endsWith(`/api/players/${playerId}`) && r.request().method() === "PATCH",
    );
    await page.getByTestId("quickscout-finish").click();
    const finishResponse = await finishRes;
    expect(finishResponse.ok()).toBeTruthy();
    const updated = await finishResponse.json();
    expect(updated.inputs?.isoFrequency).toBe("Primary");

    await page.waitForURL(`**/coach/player/${playerId}`, { timeout: 15_000 });

    // De vuelta en Mi Scout: la ficha de práctica debe pasar de "Fill profile"
    // a "View report" -- prueba de que el motor real (ensamblarReporte) ya
    // puntúa la situación ISO que acabamos de rellenar.
    await gotoInApp(page, "/coach/my-scout");
    const sandboxToggle = page.getByTestId("myscout-sandbox-toggle");
    await sandboxToggle.waitFor({ state: "visible", timeout: 10_000 });
    const reportButton = page.getByTestId(`myscout-sandbox-report-${playerId}`);
    if (!(await reportButton.isVisible().catch(() => false))) {
      await sandboxToggle.click();
    }
    await expect(reportButton).toBeVisible({ timeout: 10_000 });
  } finally {
    expect(await deleteAsSessionUser(page, playerId)).toBe(204);
  }
});
