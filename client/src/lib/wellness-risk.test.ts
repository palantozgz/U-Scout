import { describe, expect, it } from "vitest";
import {
  buildBaseline,
  compareRisk,
  computeWellnessRiskScore,
  deviationBonus,
  pickPreviousEntry,
  type WellnessEntryLike,
  type WellnessHistoryEntry,
} from "./wellness-risk";

const ok: WellnessEntryLike = { sleep_quality: 4, energy_level: 4, muscle_soreness: 4, mental_readiness: 4 };
const h = (date: string, over: Partial<WellnessEntryLike> = {}): WellnessHistoryEntry => ({ ...ok, ...over, entry_date: date });

describe("computeWellnessRiskScore: umbrales absolutos", () => {
  it("todo bien -> 0", () => {
    expect(computeWellnessRiskScore(ok, null).score).toBe(0);
  });
  it("preparación mental <= 2 suma 40; igual a 3 suma 15", () => {
    expect(computeWellnessRiskScore({ ...ok, mental_readiness: 2 }, null)).toMatchObject({ score: 40, lowReadiness: true });
    expect(computeWellnessRiskScore({ ...ok, mental_readiness: 3 }, null).score).toBe(15);
  });
  it("dolor muscular <= 2 suma 25 y sueño <= 2 suma 20", () => {
    expect(computeWellnessRiskScore({ ...ok, muscle_soreness: 1 }, null)).toMatchObject({ score: 25, highSoreness: true });
    expect(computeWellnessRiskScore({ ...ok, sleep_quality: 2 }, null)).toMatchObject({ score: 20, lowSleep: true });
  });
  it("la energía baja (<= 2) suma 20: antes no contaba", () => {
    expect(computeWellnessRiskScore({ ...ok, energy_level: 2 }, null)).toMatchObject({ score: 20, lowEnergy: true });
    expect(computeWellnessRiskScore({ ...ok, energy_level: 3 }, null).score).toBe(0);
  });
  it("suma varios factores", () => {
    const r = computeWellnessRiskScore({ sleep_quality: 1, energy_level: 1, muscle_soreness: 1, mental_readiness: 1 }, null);
    expect(r.score).toBe(40 + 25 + 20 + 20);
  });
});

describe("computeWellnessRiskScore: sin check-in", () => {
  it("no puntúa como riesgo, solo se marca como ausente", () => {
    expect(computeWellnessRiskScore(null, null)).toMatchObject({ score: 0, missingSubmission: true });
    expect(computeWellnessRiskScore(undefined, null)).toMatchObject({ score: 0, missingSubmission: true });
  });
  it("una respuesta real nunca está marcada como ausente", () => {
    expect(computeWellnessRiskScore(ok, null).missingSubmission).toBe(false);
  });
});

describe("deviationBonus: exige persistencia", () => {
  it("un solo día peor (sin dato anterior) no suma", () => {
    expect(deviationBonus(2.0, 3.5, null)).toBe(0);
  });
  it("hoy 1,5 peor pero el dato anterior estaba dentro de su normal (0,5 peor) -> 0", () => {
    expect(deviationBonus(2.0, 3.5, 3.0)).toBe(0);
  });
  it("hoy y el dato anterior >= 1 punto peor: 1,5 o más suma 20", () => {
    expect(deviationBonus(2.0, 3.5, 2.4)).toBe(20);
  });
  it("hoy y el anterior >= 1 punto peor pero hoy menos de 1,5 suma 10", () => {
    expect(deviationBonus(2.4, 3.5, 2.4)).toBe(10);
  });
  it("menos de 1 punto peor no suma, aunque el anterior fuera peor", () => {
    expect(deviationBonus(3.0, 3.5, 2.0)).toBe(0);
  });
  it("sin media personal no suma", () => {
    expect(deviationBonus(1, null, 1)).toBe(0);
  });
});

describe("computeWellnessRiskScore: desviación personal", () => {
  const baseline = { sleep: 4.5, energy: 4.5, readiness: 4.5, soreness: 4.5, n: 10 };

  it("con historial suficiente y persistencia suma por la desviación", () => {
    const today = { ...ok, sleep_quality: 3, energy_level: 4, muscle_soreness: 4, mental_readiness: 4 }; // sueño 1,5 peor
    const previous = { ...ok, sleep_quality: 3 };
    expect(computeWellnessRiskScore(today, baseline, previous).score).toBe(20);
  });

  it("sin dato anterior no suma por desviación", () => {
    const today = { ...ok, sleep_quality: 3 };
    expect(computeWellnessRiskScore(today, baseline, null).score).toBe(0);
  });

  it("la energía también cuenta en la desviación", () => {
    const today = { ...ok, energy_level: 3 };
    const previous = { ...ok, energy_level: 3 };
    expect(computeWellnessRiskScore(today, baseline, previous).score).toBe(20);
  });

  it("con menos de 5 registros de historial no se personaliza", () => {
    const today = { ...ok, sleep_quality: 3 };
    const previous = { ...ok, sleep_quality: 3 };
    expect(computeWellnessRiskScore(today, { ...baseline, n: 4 }, previous).score).toBe(0);
  });

  it("los umbrales absolutos siguen marcando aunque no haya historial ni persistencia", () => {
    expect(computeWellnessRiskScore({ ...ok, mental_readiness: 1 }, baseline, null).score).toBeGreaterThanOrEqual(40);
  });
});

describe("buildBaseline", () => {
  it("sin registros -> null", () => {
    expect(buildBaseline([])).toBeNull();
  });
  it("media por métrica incluida la energía", () => {
    const b = buildBaseline([h("2026-10-01", { energy_level: 2 }), h("2026-10-02", { energy_level: 4 })]);
    expect(b).toMatchObject({ energy: 3, sleep: 4, readiness: 4, soreness: 4, n: 2 });
  });
});

describe("compareRisk", () => {
  it("el riesgo real va antes que quien no ha respondido, aunque este último tuviera más puntos", () => {
    const rows = [
      { id: "ausente", score: 100, missingSubmission: true },
      { id: "riesgo-bajo", score: 15, missingSubmission: false },
      { id: "riesgo-alto", score: 60, missingSubmission: false },
    ];
    expect(rows.sort(compareRisk).map((r) => r.id)).toEqual(["riesgo-alto", "riesgo-bajo", "ausente"]);
  });
  it("con 6 sin responder y 1 con riesgo real, el riesgo real queda en las 5 primeras", () => {
    const rows = [
      ...Array.from({ length: 6 }, (_, i) => ({ id: `a${i}`, score: 0, missingSubmission: true })),
      { id: "real", score: 40, missingSubmission: false },
    ];
    const top5 = rows.sort(compareRisk).slice(0, 5).map((r) => r.id);
    expect(top5[0]).toBe("real");
  });
});

describe("pickPreviousEntry", () => {
  const list = [h("2026-09-28"), h("2026-09-30"), h("2026-10-01"), h("2026-10-02")];
  it("coge el dato más reciente anterior a hoy dentro de la ventana", () => {
    expect(pickPreviousEntry(list, "2026-10-02", "2026-09-29")?.entry_date).toBe("2026-10-01");
  });
  it("ignora hoy y lo que queda fuera de la ventana", () => {
    expect(pickPreviousEntry([h("2026-10-02"), h("2026-09-28")], "2026-10-02", "2026-09-29")).toBeNull();
  });
  it("sin datos devuelve null", () => {
    expect(pickPreviousEntry([], "2026-10-02", "2026-09-29")).toBeNull();
  });
});
