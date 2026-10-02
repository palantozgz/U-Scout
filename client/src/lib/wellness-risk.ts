// Puntuación de riesgo de wellness de una jugadora para hoy (lógica pura, probada con vitest).
// Sacada de WellnessStaffTab.tsx el 2026-10-02 para poder probarla y cambiarla con seguridad.
//
// Cambios respecto a la versión anterior, con la evidencia que los justifica:
//  1) La ENERGÍA entra en el cálculo (en el índice de Hooper es la fatiga). Antes se recogía y no contaba.
//  2) La desviación personal exige PERSISTENCIA: hoy y el dato anterior (últimos 3 días) deben estar >= 1 punto por
//     debajo de su media. Un estudio de campo de 2026 (waterpolo masculino de élite, 216 observaciones, otro
//     cuestionario) halló un error estándar de ~0,6 y un cambio mínimo detectable al 95 % de ~1,6 con baja fiabilidad
//     entre atletas: una desviación de 1 punto en un solo día está dentro del ruido. Es una hipótesis (muestra
//     pequeña) que conviene revisar con los datos reales del club tras unas semanas de uso.
//  3) "Sin check-in" ya NO puntúa 100: antes una jugadora que no había respondido aparecía como la de mayor riesgo y,
//     con 6 o más sin responder, desplazaba de la lista de prioridad (5 filas) a las jugadoras con riesgo real.
//     Ahora se marca con `missingSubmission` y se ordena después del riesgo real.
//
// Los umbrales absolutos (<= 2 sobre 5) NO cambian: un valor muy bajo se marca siempre, sea cual sea el historial.

export type WellnessEntryLike = {
  sleep_quality: number;
  energy_level: number;
  muscle_soreness: number;
  mental_readiness: number;
};

export type WellnessHistoryEntry = WellnessEntryLike & { entry_date: string };

export type WellnessBaseline = {
  sleep: number | null;
  energy: number | null;
  readiness: number | null;
  soreness: number | null;
  n: number;
} | null;

/** Registros mínimos de historial (sin contar hoy) para fiarse de la media personal. */
export const MIN_BASELINE_ENTRIES = 5;
/** Caída respecto a su normal (en puntos de 1 a 5) a partir de la cual cuenta la desviación personal. */
export const DEVIATION_POINTS = 1.0;

const avg = (list: WellnessHistoryEntry[], field: keyof WellnessEntryLike): number =>
  list.reduce((acc, e) => acc + e[field], 0) / list.length;

/** Media de cada métrica sobre los registros dados (su "normal"). null si no hay ninguno. */
export function buildBaseline(list: WellnessHistoryEntry[]): WellnessBaseline {
  if (list.length === 0) return null;
  return {
    sleep: avg(list, "sleep_quality"),
    energy: avg(list, "energy_level"),
    readiness: avg(list, "mental_readiness"),
    soreness: avg(list, "muscle_soreness"),
    n: list.length,
  };
}

/** Puntos que hoy está por debajo de su normal (positivo = peor). */
const worseBy = (value: number, baselineAvg: number | null): number =>
  baselineAvg == null ? 0 : baselineAvg - value;

/**
 * Bonus por desviación personal. Solo cuenta si el dato anterior (últimos 3 días) también estaba por debajo de su
 * normal en `DEVIATION_POINTS` o más; sin dato anterior no suma nada (conservador).
 */
export function deviationBonus(todayValue: number, baselineAvg: number | null, previousValue: number | null): number {
  const w = worseBy(todayValue, baselineAvg);
  if (w < DEVIATION_POINTS) return 0;
  if (previousValue == null) return 0;
  if (worseBy(previousValue, baselineAvg) < DEVIATION_POINTS) return 0;
  return w >= 1.5 ? 20 : 10;
}

export type WellnessRisk = {
  score: number;
  lowReadiness: boolean;
  highSoreness: boolean;
  lowSleep: boolean;
  lowEnergy: boolean;
  missingSubmission: boolean;
};

export function computeWellnessRiskScore(
  entry: WellnessEntryLike | null | undefined,
  baseline: WellnessBaseline,
  previous: WellnessEntryLike | null = null,
): WellnessRisk {
  if (!entry) {
    return { score: 0, lowReadiness: false, highSoreness: false, lowSleep: false, lowEnergy: false, missingSubmission: true };
  }
  const lowReadiness = entry.mental_readiness <= 2;
  const highSoreness = entry.muscle_soreness <= 2;
  const lowSleep = entry.sleep_quality <= 2;
  const lowEnergy = entry.energy_level <= 2;

  const absoluteScore =
    (lowReadiness ? 40 : entry.mental_readiness === 3 ? 15 : 0) +
    (highSoreness ? 25 : 0) +
    (lowSleep ? 20 : 0) +
    (lowEnergy ? 20 : 0);

  const deviationScore =
    baseline && baseline.n >= MIN_BASELINE_ENTRIES
      ? deviationBonus(entry.mental_readiness, baseline.readiness, previous?.mental_readiness ?? null) +
        deviationBonus(entry.sleep_quality, baseline.sleep, previous?.sleep_quality ?? null) +
        deviationBonus(entry.muscle_soreness, baseline.soreness, previous?.muscle_soreness ?? null) +
        deviationBonus(entry.energy_level, baseline.energy, previous?.energy_level ?? null)
      : 0;

  return {
    score: absoluteScore + deviationScore,
    lowReadiness,
    highSoreness,
    lowSleep,
    lowEnergy,
    missingSubmission: false,
  };
}

/** Orden de la lista de prioridad: primero el riesgo real (de mayor a menor) y después quien no ha respondido. */
export function compareRisk(
  a: { score: number; missingSubmission: boolean },
  b: { score: number; missingSubmission: boolean },
): number {
  return Number(a.missingSubmission) - Number(b.missingSubmission) || b.score - a.score;
}

/** Dato anterior más reciente dentro de los últimos `days` días, sin contar hoy. null si no hay. */
export function pickPreviousEntry(
  list: WellnessHistoryEntry[],
  todayKey: string,
  oldestAllowedKey: string,
): WellnessHistoryEntry | null {
  let best: WellnessHistoryEntry | null = null;
  for (const e of list) {
    if (e.entry_date === todayKey || e.entry_date < oldestAllowedKey || e.entry_date > todayKey) continue;
    if (!best || e.entry_date > best.entry_date) best = e;
  }
  return best;
}
