import { test, expect } from "@playwright/test";
import { loginAsCoach, gotoInApp } from "./fixtures/auth";

// Cubre el flujo real de creacion de ficha de practica -> asistente rapido
// (QuickScout, situacion ISO completa) -> verificacion de que el motor
// real (ensamblarReporte) ya puntua la ficha, sin pasar por Film Room
// (eso requiere status "submitted" en scout_versions via un flujo de envio
// distinto que QuickScout NO toca -- ver PROMPT_NUEVA_SESION más abajo).
//
// Limpieza: borra la ficha de práctica creada al final (misma convencion
// que 06-planner-crud.spec.ts) -- estos son datos reales y compartidos del
// club QA de Jiangxi, no se dejan huerfanos entre runs.
test("quick scout: crea ficha de práctica, completa el asistente ISO, verifica que persiste", async ({ page }) => {
  await loginAsCoach(page);
  await gotoInApp(page, "/coach/my-scout");

  const uniqueName = `E2E QuickScout ${Date.now()}`;

  // Crear ficha de práctica.
  await page.getByTestId("myscout-add-player").click();
  await page.getByTestId("myscout-new-player-name").fill(uniqueName);
  await page.getByTestId("myscout-new-player-number").fill("99");

  const createRes = page.waitForResponse(
    (r) => r.url().endsWith("/api/players") && r.request().method() === "POST",
  );
  await page.getByTestId("myscout-new-player-save").click();
  const created = await (await createRes).json();
  const playerId = created.id as string;
  expect(playerId).toBeTruthy();

  // handleCreate navega directa a /coach/player/:id -- confirmamos.
  await page.waitForURL(`**/coach/player/${playerId}`, { timeout: 15_000 });

  // Saltar al asistente rápido para esta ficha.
  await gotoInApp(page, `/coach/quick-scout/${playerId}`);

  // Paso 0 — situación: ISO.
  await page.getByTestId("quickscout-situation-iso").click();
  await page.getByTestId("quickscout-next").click();

  // Paso 1 — dirección dominante.
  await page.getByTestId("quickscout-isoDir-Right").click();
  await page.getByTestId("quickscout-next").click();

  // Paso 2 — decisión.
  await page.getByTestId("quickscout-isoDec-Finish").click();
  await page.getByTestId("quickscout-next").click();

  // Paso 3 — atletismo.
  await page.getByTestId("quickscout-isoAth-3").click();
  await page.getByTestId("quickscout-next").click();

  // Paso 4 (último) — reacción al closeout, y finalizar.
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
  // puntúa la situación ISO que acabamos de rellenar, no solo que el PATCH
  // respondió 200.
  await gotoInApp(page, "/coach/my-scout");
  const sandboxToggle = page.getByTestId("myscout-sandbox-toggle");
  await sandboxToggle.waitFor({ state: "visible", timeout: 10_000 });
  // Puede que ya esté abierto de un run anterior en el mismo perfil de
  // navegador -- si el botón de la ficha ya es visible, no hace falta
  // volver a pulsar (y pulsar cuando ya está abierto lo cerraría).
  const reportButton = page.getByTestId(`myscout-sandbox-report-${playerId}`);
  if (!(await reportButton.isVisible().catch(() => false))) {
    await sandboxToggle.click();
  }
  await expect(reportButton).toBeVisible({ timeout: 10_000 });

  // Limpieza -- borra la ficha de práctica para no dejar basura en el club
  // QA compartido. El coach QA es quien la creó (createdByUserId), así que
  // pasa el chequeo de propiedad del endpoint tras el fix de seguridad de
  // hoy (server/routes.ts, DELETE /api/players/:id).
  const deleteRes = await page.request.delete(`/api/players/${playerId}`);
  expect(deleteRes.status()).toBe(204);
});
