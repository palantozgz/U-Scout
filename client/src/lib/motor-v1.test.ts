/**
 * Tests directos de `motor-v1.ts` — a diferencia de `motor-v1-acceptance.test.ts`
 * (que caracteriza el comportamiento de los motores legacy como referencia),
 * estos tests corren contra la implementación real de Motor 1.0 y deben seguir
 * pasando según el núcleo de cálculo evolucione.
 */
import { describe, expect, it } from "vitest";
import { UScoutMotor } from "./motor-v2.1";
import { ensamblarReporte, situacionesAmenaza } from "./motor-v1";
import testProfilesRaw from "../../../scripts/test-profiles.json";

interface TestProfile {
  id: string;
  name: string;
  inputs: Record<string, unknown>;
  clubContext?: Record<string, unknown>;
}

const profiles = testProfilesRaw as unknown as TestProfile[];
const motor = new UScoutMotor();

describe("motor-v1 — situacionesAmenaza: cap anti-inflación correcto (regresión del bug de clamp072)", () => {
  it("p001 (iso+pnr primarias): iso y pnr NO se capan (quedan en 1.00), post SÍ se capa a 0.72", () => {
    const p001 = profiles.find((p) => p.id === "p001")!;
    const report = motor.generateReport(p001.inputs as any, p001.clubContext as any);
    const sits = situacionesAmenaza(report);

    const iso = sits.find((s) => s.situacion === "iso");
    const pnr = sits.find((s) => s.situacion === "pnrHandler");
    const post = sits.find((s) => s.situacion === "post");

    expect(iso?.score).toBe(1);
    expect(pnr?.score).toBe(1);
    expect(post?.score).toBe(0.72);
  });

  it("p004 (pnr+transition primarias): pnr y transition NO se capan, iso SÍ se capa a 0.72", () => {
    const p004 = profiles.find((p) => p.id === "p004")!;
    const report = motor.generateReport(p004.inputs as any, p004.clubContext as any);
    const sits = situacionesAmenaza(report);

    const pnr = sits.find((s) => s.situacion === "pnrHandler");
    const transition = sits.find((s) => s.situacion === "transition");
    const iso = sits.find((s) => s.situacion === "iso");

    expect(pnr?.score).toBe(1);
    expect(transition?.score).toBeCloseTo(0.95, 6);
    expect(iso?.score).toBe(0.72);
  });

  it("p008 (0 primarias): 'transition' supera 0.72 libremente, sin ningún cap", () => {
    const p008 = profiles.find((p) => p.id === "p008")!;
    const report = motor.generateReport(p008.inputs as any, p008.clubContext as any);
    const sits = situacionesAmenaza(report);
    const transition = sits.find((s) => s.situacion === "transition");
    expect(transition?.score).toBeGreaterThan(0.72);
  });

  it("p001: frecuenciaObservada es la REAL marcada por el staff (isoFreq/pnrFreq='P'), no una aproximación por score", () => {
    const p001 = profiles.find((p) => p.id === "p001")!;
    const report = motor.generateReport(p001.inputs as any, p001.clubContext as any);
    const sits = situacionesAmenaza(report);
    const iso = sits.find((s) => s.situacion === "iso");
    const pnr = sits.find((s) => s.situacion === "pnrHandler");
    const spotUp = sits.find((s) => s.situacion === "spotUp");
    // iso/pnr son las 2 primarias reales del perfil -> "P" real, no aproximado.
    expect(iso?.frecuenciaObservada).toBe("P");
    expect(pnr?.frecuenciaObservada).toBe("P");
    // spotUp: score=0.62 caería en "S" por la aproximación de score (>=0.5),
    // pero el input real la marca "Rara" -> debe devolver "R", no "S".
    expect(spotUp?.frecuenciaObservada).toBe("R");
  });

  it("las situaciones vienen ordenadas de mayor a menor score", () => {
    for (const profile of profiles) {
      const report = motor.generateReport(profile.inputs as any, profile.clubContext as any);
      const sits = situacionesAmenaza(report);
      for (let i = 1; i < sits.length; i++) {
        expect(sits[i - 1].score, `[${profile.name}]`).toBeGreaterThanOrEqual(sits[i].score);
      }
    }
  });
});

describe("motor-v1 — ensamblarReporte: forma del contrato (14.2 bis)", () => {
  it("modo completo: deny siempre tiene ganador + candidatos; force/allow, cuando existen, también (incluido el ganador en rank 0)", () => {
    for (const profile of profiles) {
      const reporte = ensamblarReporte(profile.inputs as any, profile.clubContext as any, {
        jugadoraId: profile.id,
        modo: "completo",
      });
      if (reporte.modo !== "completo") throw new Error("esperaba modo completo");
      const campos = [reporte.capa2.deny, reporte.capa2.force, reporte.capa2.allow].filter(
        (c): c is NonNullable<typeof c> => c !== undefined,
      );
      for (const campo of campos) {
        expect(campo.candidatos.length, `[${profile.name}]`).toBeGreaterThan(0);
        expect(campo.candidatos[0].rank, `[${profile.name}]`).toBe(0);
        expect(campo.candidatos[0].output.key, `[${profile.name}]`).toBe(campo.ganador.key);
      }
    }
  });

  it("allow se deriva del deny menos amenazante cuando no hay ningún output allow real -- regresión de scripts/compare-motors.ts", () => {
    // p007 (Haliburton): motor-v2.1 no genera ningún output category='allow'
    // con weight>0 para este perfil, pero SÍ tiene una situación de deny
    // genuinamente baja (iso) -- motor-v4 deriva 'allow_iso' de ahí; la
    // primera versión de motor-v1 no lo hacía y perdía el allow entero.
    const p007 = profiles.find((p) => p.id === "p007")!;
    const reporte = ensamblarReporte(p007.inputs as any, p007.clubContext as any, {
      jugadoraId: p007.id,
      modo: "completo",
    });
    if (reporte.modo !== "completo") throw new Error("esperaba modo completo");
    expect(reporte.capa2.allow).toBeDefined();
    expect(reporte.capa2.allow?.ganador.key).toBe("allow_iso");
  });

  it("force/allow son genuinamente opcionales -- verificado con los perfiles reales donde faltan (no un fallback disfrazado)", () => {
    // p003 (Steph Curry) no tiene force real en motor-v2.1 -- verificado
    // directamente contra rawOutputs antes de escribir este test.
    const p003 = profiles.find((p) => p.id === "p003")!;
    const reporte = ensamblarReporte(p003.inputs as any, p003.clubContext as any, {
      jugadoraId: p003.id,
      modo: "completo",
    });
    if (reporte.modo !== "completo") throw new Error("esperaba modo completo");
    expect(reporte.capa2.force).toBeUndefined();
    // Y no se coló el fallback viejo (force === deny disfrazado):
    expect(reporte.capa2.force).not.toEqual(reporte.capa2.deny);
  });

  it("modo completo: capa2.aware nunca tiene más de 2 slots", () => {
    for (const profile of profiles) {
      const reporte = ensamblarReporte(profile.inputs as any, profile.clubContext as any, {
        jugadoraId: profile.id,
        modo: "completo",
      });
      if (reporte.modo !== "completo") throw new Error("esperaba modo completo");
      expect(reporte.capa2.aware.length, `[${profile.name}]`).toBeLessThanOrEqual(2);
    }
  });

  it("modo completo: identidad NUNCA lleva accionPrincipal (TypeScript ya lo garantiza; esto verifica en runtime)", () => {
    const p001 = profiles.find((p) => p.id === "p001")!;
    const reporte = ensamblarReporte(p001.inputs as any, p001.clubContext as any, {
      jugadoraId: p001.id,
      modo: "completo",
    });
    expect("accionPrincipal" in reporte).toBe(false);
  });

  it("modo sencillo: SÍ lleva accionPrincipal, y es igual al ganador de deny en modo completo para el mismo perfil", () => {
    const p001 = profiles.find((p) => p.id === "p001")!;
    const sencillo = ensamblarReporte(p001.inputs as any, p001.clubContext as any, {
      jugadoraId: p001.id,
      modo: "sencillo",
    });
    const completo = ensamblarReporte(p001.inputs as any, p001.clubContext as any, {
      jugadoraId: p001.id,
      modo: "completo",
    });
    if (sencillo.modo !== "sencillo" || completo.modo !== "completo") {
      throw new Error("modos inesperados");
    }
    expect(sencillo.accionPrincipal.ganador.key).toBe(completo.capa2.deny.ganador.key);
  });

  it("identidad.archetypeKey es siempre uno de los 10 valores del catálogo de 14.3", () => {
    const VALIDOS = new Set([
      "armadora_creadora", "armadora_anotadora", "manejadora_secundaria",
      "alero_penetradora", "alero_tiradora", "alero_movimiento",
      "interior_creadora", "interior_poste", "interior_abridora", "interior_finalizadora",
    ]);
    for (const profile of profiles) {
      const reporte = ensamblarReporte(profile.inputs as any, profile.clubContext as any, {
        jugadoraId: profile.id,
        modo: "completo",
      });
      expect(VALIDOS.has(reporte.identidad.archetypeKey), `[${profile.name}] -> ${reporte.identidad.archetypeKey}`).toBe(true);
    }
  });

  it("identidad.manoDominante refleja EnrichedInputs.hand real (p001 es zurda -> 'I'), no un hardcode", () => {
    const p001 = profiles.find((p) => p.id === "p001")!;
    const reporte = ensamblarReporte(p001.inputs as any, p001.clubContext as any, {
      jugadoraId: p001.id,
      modo: "completo",
    });
    expect((p001.inputs as any).hand).toBe("L");
    expect(reporte.identidad.manoDominante).toBe("I");
  });

  it("capa3 queda undefined (Nivel 2 / U Stats es Fase 2, no Fase 1)", () => {
    const p001 = profiles.find((p) => p.id === "p001")!;
    const reporte = ensamblarReporte(p001.inputs as any, p001.clubContext as any, {
      jugadoraId: p001.id,
      modo: "completo",
    });
    if (reporte.modo !== "completo") throw new Error("esperaba modo completo");
    expect(reporte.capa3).toBeUndefined();
  });
});

describe("motor-v1 — archetypeKey: diseño real sobre Synergy (El Arquitecto, 2026-09-11), no crosswalk legacy", () => {
  const GRUPO_DE: Record<string, string> = {
    armadora_creadora: "base", armadora_anotadora: "base", manejadora_secundaria: "base",
    alero_penetradora: "alero", alero_tiradora: "alero", alero_movimiento: "alero",
    interior_creadora: "interior", interior_poste: "interior",
    interior_abridora: "interior", interior_finalizadora: "interior",
  };

  it("el archetypeKey SIEMPRE respeta el grupo de identidad.posicion -- el bug real que motivó el rediseño", () => {
    for (const profile of profiles) {
      const reporte = ensamblarReporte(profile.inputs as any, profile.clubContext as any, {
        jugadoraId: profile.id,
        modo: "completo",
      });
      const grupoEsperado = reporte.identidad.posicion;
      const grupoReal = GRUPO_DE[reporte.identidad.archetypeKey];
      expect(grupoReal, `[${profile.name}] archetypeKey=${reporte.identidad.archetypeKey} posicion=${grupoEsperado}`).toBe(grupoEsperado);
    }
  });

  // Tabla de oro -- valores exactos verificados contra las señales reales de
  // cada perfil (ver motor-v1-archetype.test.ts para el detalle del porqué
  // de cada uno). Aquí se prueban a través de ensamblarReporte() completo,
  // no solo la función detectarArchetype() aislada.
  const CASOS: [string, string][] = [
    ["p001", "armadora_anotadora"],   // Luka: pnrPri=SF + isoDec=F pesan más que vision=5
    ["p002", "interior_creadora"],    // Jokic: gate de hub (vision=5, pnrPri=PF, pass_to_cutter)
    ["p004", "interior_finalizadora"],// Giannis: interior que ataca PnR de frente, no armadora
    ["p006", "interior_poste"],       // Embiid: sin señales de hub, post domina
    ["p007", "armadora_creadora"],    // Haliburton: pnrPri=PF + dhoRole=giver
    ["p009", "interior_creadora"],    // Draymond: gate de hub (vision=5, usage=role) -- el caso que
                                       // ninguna situación por sí sola captaba (playmaking sin volumen)
    ["p010", "alero_tiradora"],       // 3&D wing: caso base del grupo alero
  ];

  for (const [id, esperado] of CASOS) {
    it(`${id} -> ${esperado} (verificado con señales reales, no aspiracional)`, () => {
      const profile = profiles.find((p) => p.id === id)!;
      const reporte = ensamblarReporte(profile.inputs as any, profile.clubContext as any, {
        jugadoraId: profile.id,
        modo: "completo",
      });
      expect(reporte.identidad.archetypeKey, profile.name).toBe(esperado);
    });
  }

  it("es determinista: dos llamadas al mismo perfil dan el mismo archetypeKey", () => {
    const p001 = profiles.find((p) => p.id === "p001")!;
    const a = ensamblarReporte(p001.inputs as any, p001.clubContext as any, { jugadoraId: p001.id, modo: "completo" });
    const b = ensamblarReporte(p001.inputs as any, p001.clubContext as any, { jugadoraId: p001.id, modo: "completo" });
    if (a.modo !== "completo" || b.modo !== "completo") throw new Error("esperaba modo completo");
    expect(a.identidad.archetypeKey).toBe(b.identidad.archetypeKey);
  });
});
