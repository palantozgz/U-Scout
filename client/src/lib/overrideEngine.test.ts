import { describe, expect, it } from "vitest";
import { detectPatterns, type ReportOverride } from "./overrideEngine";

// Nivel B / "el decantador" (spec 38/39). Cubre el hallazgo C.0 de El
// Arquitecto: detectPatterns() contaba jugadoras distintas, no entrenadores
// distintos -- un solo entrenador repitiendo la misma sustitución en varias
// jugadoras del mismo arquetipo no debe "promocionar" nada por sí solo.

function ov(over: Partial<ReportOverride> & { playerId: string; coachId: string }): ReportOverride {
  return {
    slide: "defense",
    itemKey: "deny.instruction",
    action: "replace",
    archetypeKey: "armadora_creadora",
    replacementKey: "deny_weak_hand",
    replacementValue: "Deny weak hand",
    originalScore: 0.6,
    replacementScore: 0.55,
    ...over,
  };
}

describe("detectPatterns", () => {
  it("un solo entrenador repitiendo la misma sustitución en varias jugadoras NO forma un patrón", () => {
    const overrides: ReportOverride[] = [
      ov({ playerId: "p1", coachId: "c1" }),
      ov({ playerId: "p2", coachId: "c1" }),
      ov({ playerId: "p3", coachId: "c1" }),
      ov({ playerId: "p4", coachId: "c1" }),
      ov({ playerId: "p5", coachId: "c1" }),
    ];
    const patterns = detectPatterns(overrides, 3);
    expect(patterns).toHaveLength(0);
  });

  it("3 entrenadores distintos coincidiendo (umbral por defecto) SÍ forman un patrón", () => {
    const overrides: ReportOverride[] = [
      ov({ playerId: "p1", coachId: "c1" }),
      ov({ playerId: "p2", coachId: "c2" }),
      ov({ playerId: "p3", coachId: "c3" }),
    ];
    const patterns = detectPatterns(overrides, 3);
    expect(patterns).toHaveLength(1);
    expect(patterns[0]).toMatchObject({
      archetypeKey: "armadora_creadora",
      fieldKey: "deny.instruction",
      preferredValue: "deny_weak_hand",
      count: 3, // entrenadores, no jugadoras
      distinctPlayers: 3,
      confidence: 1,
    });
  });

  it("agrupa por replacementKey (estable), no por replacementValue (texto locale-dependiente)", () => {
    const overrides: ReportOverride[] = [
      ov({ playerId: "p1", coachId: "c1", replacementKey: "deny_weak_hand", replacementValue: "Deny weak hand" }),
      ov({ playerId: "p2", coachId: "c2", replacementKey: "deny_weak_hand", replacementValue: "Niega mano débil" }),
      ov({ playerId: "p3", coachId: "c3", replacementKey: "deny_weak_hand", replacementValue: "封堵弱手" }),
    ];
    const patterns = detectPatterns(overrides, 3);
    expect(patterns).toHaveLength(1);
    expect(patterns[0].count).toBe(3);
  });

  it("un mismo entrenador votando dos veces por la misma jugadora (re-override) no infla el conteo de entrenadores", () => {
    const overrides: ReportOverride[] = [
      ov({ playerId: "p1", coachId: "c1" }),
      ov({ playerId: "p1", coachId: "c1" }), // repetido, mismo coach+player
      ov({ playerId: "p2", coachId: "c2" }),
    ];
    const patterns = detectPatterns(overrides, 3);
    expect(patterns).toHaveLength(0); // solo 2 entrenadores distintos, no 3
  });

  it("ignora overrides con action distinto de 'replace', o sin archetypeKey/replacementValue", () => {
    const overrides: ReportOverride[] = [
      ov({ playerId: "p1", coachId: "c1", action: "hide", replacementValue: undefined }),
      ov({ playerId: "p2", coachId: "c2", archetypeKey: undefined }),
      ov({ playerId: "p3", coachId: "c3" }),
    ];
    const patterns = detectPatterns(overrides, 3);
    expect(patterns).toHaveLength(0);
  });

  it("umbral configurable: con threshold=2, 2 entrenadores distintos ya forman un patrón", () => {
    const overrides: ReportOverride[] = [
      ov({ playerId: "p1", coachId: "c1" }),
      ov({ playerId: "p2", coachId: "c2" }),
    ];
    const patterns = detectPatterns(overrides, 2);
    expect(patterns).toHaveLength(1);
    expect(patterns[0].count).toBe(2);
    expect(patterns[0].confidence).toBe(1);
  });
});
