/**
 * shotVsDriveTendency — PROTOTIPO, no usado todavía por ninguna pantalla.
 *
 * Deriva el semáforo "tiro vs. penetración" (punto 7 de la sesión del
 * 2026-09-07) a partir de datos que el motor v4 YA calcula — no inventa
 * ninguna entrada de scouting nueva. Combina las preferencias de finalización
 * ya observadas (isoStrongHandFinish/isoWeakHandFinish, pnrFinishLeft/Right,
 * offBallCutAction, spotUpAction, dhoAction) ponderadas por cuánto pesa esa
 * situación en el perfil real de la jugadora (RankedSituation.score de
 * motor-v4) — un finish de ISO importa mucho para una anotadora de ISO,
 * poco para una especialista en catch-and-shoot.
 *
 * Devuelve "insufficient_data" en vez de forzar un color cuando no hay
 * señales suficientes — importante porque, a 2026-09-07, 304 de 309
 * jugadoras en producción no tienen ninguna ficha de scouting rellenada
 * (solo datos de importación WCBA), así que la mayoría de fichas mostrarán
 * este estado hasta que se les haga scouting real.
 *
 * Umbrales (-0.3 / +0.3) y mapeo de colores: sin decidir todavía — placeholder
 * para que Pablo los ajuste con casos reales antes de llevarlo a UI.
 */

import type { EnrichedInputs } from "./motor-v2.1";
import type { RankedSituation } from "./motor-v4";

export type ShotDriveLabel = "shooter_lean" | "balanced" | "driver_lean" | "insufficient_data";

export interface ShotDriveTendency {
  label: ShotDriveLabel;
  /** -1 (tiradora pura) .. +1 (penetradora pura). null cuando insufficient_data. */
  index: number | null;
  /** Suma de pesos situacionales realmente usados — señal aproximada de cobertura/confianza. */
  coverage: number;
  /** Cuántas señales entraron en el cálculo, para depuración/revisión manual. */
  signalsUsed: number;
}

function situationScore(situations: RankedSituation[], prefix: string): number {
  let max = 0;
  for (const s of situations) {
    if (s.id === prefix || s.id.startsWith(prefix)) max = Math.max(max, s.score);
  }
  return max;
}

// -1 = tiro puro, +1 = penetración pura, valores intermedios para acciones semi-drive (floater).
const ISO_FINISH_VALUE: Record<string, number> = {
  drive: 1,
  floater: 0.4,
  pullup: -1,
  pass: 0, // un pase no es señal de tiro ni de penetración
};

const PNR_FINISH_VALUE: Record<string, number> = {
  "Drive to Rim": 1,
  Floater: 0.4,
  "Pull-up": -1,
  "Mid-range": -0.7,
};

const OFFBALL_CUT_VALUE: Record<string, number> = {
  catch_and_drive: 1,
  curl: 0.3, // suele acabar en tiro pero con movimiento hacia el aro primero
  catch_and_shoot: -1,
  flare: -1,
};

const SPOT_ACTION_VALUE: Record<string, number> = {
  shoot: -1,
  pump: 0.5, // el pump-fake es preludio de atacar el aro
  either: 0,
};

const DHO_ACTION_VALUE: Record<string, number> = {
  drive: 1,
  shoot: -1,
  pass: 0,
};

interface Signal {
  value: number;
  situationPrefix: string;
}

export function computeShotDriveTendency(
  inputs: EnrichedInputs,
  situations: RankedSituation[],
): ShotDriveTendency {
  const signals: Signal[] = [];

  if (inputs.isoStrongHandFinish && ISO_FINISH_VALUE[inputs.isoStrongHandFinish] !== undefined) {
    signals.push({ value: ISO_FINISH_VALUE[inputs.isoStrongHandFinish], situationPrefix: "iso" });
  }
  if (inputs.isoWeakHandFinish && ISO_FINISH_VALUE[inputs.isoWeakHandFinish] !== undefined) {
    signals.push({ value: ISO_FINISH_VALUE[inputs.isoWeakHandFinish], situationPrefix: "iso" });
  }
  if (inputs.pnrFinishLeft && PNR_FINISH_VALUE[inputs.pnrFinishLeft] !== undefined) {
    signals.push({ value: PNR_FINISH_VALUE[inputs.pnrFinishLeft], situationPrefix: "pnr" });
  }
  if (inputs.pnrFinishRight && PNR_FINISH_VALUE[inputs.pnrFinishRight] !== undefined) {
    signals.push({ value: PNR_FINISH_VALUE[inputs.pnrFinishRight], situationPrefix: "pnr" });
  }
  if (inputs.offBallCutAction && OFFBALL_CUT_VALUE[inputs.offBallCutAction] !== undefined) {
    signals.push({ value: OFFBALL_CUT_VALUE[inputs.offBallCutAction], situationPrefix: "off_ball" });
  }
  if (inputs.spotUpAction && SPOT_ACTION_VALUE[inputs.spotUpAction] !== undefined) {
    signals.push({ value: SPOT_ACTION_VALUE[inputs.spotUpAction], situationPrefix: "catch_shoot" });
  }
  if (inputs.dhoAction && DHO_ACTION_VALUE[inputs.dhoAction] !== undefined) {
    signals.push({ value: DHO_ACTION_VALUE[inputs.dhoAction], situationPrefix: "dho" });
  }

  if (signals.length === 0) {
    return { label: "insufficient_data", index: null, coverage: 0, signalsUsed: 0 };
  }

  let weightedSum = 0;
  let totalWeight = 0;
  for (const sig of signals) {
    const situScore = situationScore(situations, sig.situationPrefix);
    // Piso de 0.15: una señal aislada (p.ej. solo isoWeakHandFinish observado) no debe
    // descartarse del todo aunque situations[] no traiga esa situación con peso alto —
    // pero situaciones que SÍ son relevantes para la jugadora pesan más.
    const w = Math.max(situScore, 0.15);
    weightedSum += sig.value * w;
    totalWeight += w;
  }

  const index = weightedSum / totalWeight;
  const label: ShotDriveLabel = index <= -0.3 ? "shooter_lean" : index >= 0.3 ? "driver_lean" : "balanced";

  return { label, index, coverage: totalWeight, signalsUsed: signals.length };
}
