/**
 * Tests de `motor-v1-archetype.ts` — el diseño real de archetypeKey (El
 * Arquitecto, 2026-09-11). Dos niveles: unitarios contra `detectarArchetype()`
 * con fixtures controladas, e integración contra `ensamblarReporte()` con los
 * 3 perfiles sintéticos que cubren los archetypes que no tenían ninguna
 * muestra real (`scripts/test-profiles.json`, p011-p013).
 */
import { describe, expect, it } from "vitest";
import { detectarArchetype, type SenalesArchetype } from "./motor-v1-archetype";
import { ensamblarReporte } from "./motor-v1";
import type { ArchetypeKey, SituacionAmenaza } from "./motor-v1-types";
import testProfilesRaw from "../../../scripts/test-profiles.json";

interface TestProfile {
  id: string;
  name: string;
  inputs: Record<string, unknown>;
  clubContext?: Record<string, unknown>;
}
const profiles = testProfilesRaw as unknown as TestProfile[];

const SENALES_VACIAS: SenalesArchetype = {
  vision: 3,
  usage: "role",
  pnrPri: null,
  isoDec: null,
  dhoRole: null,
  deepRange: false,
  spotUpAction: null,
  indirectFreq: null,
  transRole: null,
  screenerAction: null,
  popRange: null,
  cutType: null,
  offBallCutAction: null,
  orebThreat: null,
  contactFinish: null,
  postProfile: null,
  postEff: null,
  postMovesCount: 0,
  highPostPasaACortador: false,
  ath: 3,
};

function sit(situacion: SituacionAmenaza["situacion"], score: number): SituacionAmenaza {
  return { situacion, score, frecuenciaObservada: score >= 0.85 ? "P" : score >= 0.5 ? "S" : "R" };
}

describe("detectarArchetype — grupo BASE", () => {
  it("sin carga on-ball (usage=role, onBall bajo) -> manejadora_secundaria", () => {
    const r = detectarArchetype([sit("spotUp", 0.6)], "base", SENALES_VACIAS);
    expect(r.key).toBe("manejadora_secundaria");
  });

  it("primary + pnrPri=SF + isoDec=F (score-first) -> armadora_anotadora, no crea", () => {
    const senales: SenalesArchetype = { ...SENALES_VACIAS, usage: "primary", pnrPri: "SF", isoDec: "F", vision: 5 };
    const r = detectarArchetype([sit("iso", 0.9), sit("pnrHandler", 0.8)], "base", senales);
    expect(r.key).toBe("armadora_anotadora");
  });

  it("primary + pnrPri=PF + dhoRole=giver (pass-first) -> armadora_creadora", () => {
    const senales: SenalesArchetype = { ...SENALES_VACIAS, usage: "primary", pnrPri: "PF", dhoRole: "giver", vision: 5 };
    const r = detectarArchetype([sit("pnrHandler", 0.9), sit("iso", 0.2)], "base", senales);
    expect(r.key).toBe("armadora_creadora");
  });

  it("señales de creadora/anotadora casi canceladas (isoDec=P +2 crea vs pnrPri=SF +2 anot): el desempate situacional (>=) favorece anotadora -- verificado, no asumido", () => {
    // s(iso) === s(pnrHandler) hace que la bonificación situacional
    // "s.iso >= s.pnrHandler" (+0.5 anot) se dispare y la simétrica de crea
    // no -- por eso un "empate" de señales explícitas no es un empate real
    // en el resultado. Documentado aquí en vez de asumido sin comprobar.
    const senales: SenalesArchetype = { ...SENALES_VACIAS, usage: "primary", isoDec: "P", pnrPri: "SF" };
    const r = detectarArchetype([sit("iso", 0.4), sit("pnrHandler", 0.4)], "base", senales);
    expect(r.key).toBe("armadora_anotadora");
  });
});

describe("detectarArchetype — grupo INTERIOR", () => {
  it("gate de hub: vision>=4 + pnrPri=PF -> interior_creadora, aunque post domine", () => {
    const senales: SenalesArchetype = { ...SENALES_VACIAS, vision: 5, pnrPri: "PF" };
    const r = detectarArchetype([sit("post", 1.0), sit("pnrHandler", 0.5)], "interior", senales);
    expect(r.key).toBe("interior_creadora");
  });

  it("gate de hub NO se activa con vision baja aunque haya señal de distribución -- evita falsos positivos", () => {
    const senales: SenalesArchetype = { ...SENALES_VACIAS, vision: 2, pnrPri: "PF" };
    const r = detectarArchetype([sit("post", 1.0)], "interior", senales);
    expect(r.key).not.toBe("interior_creadora");
    expect(r.key).toBe("interior_poste");
  });

  it("sin gate de hub, post domina -> interior_poste", () => {
    const r = detectarArchetype([sit("post", 1.0), sit("putback", 0.5)], "interior", SENALES_VACIAS);
    expect(r.key).toBe("interior_poste");
  });

  it("sin gate de hub, deepRange=true y screenerAction=pop+three -> interior_abridora, no importa que post exista", () => {
    const senales: SenalesArchetype = { ...SENALES_VACIAS, deepRange: true, screenerAction: "pop", popRange: "three" };
    const r = detectarArchetype([sit("post", 0.3), sit("pnrRollMan", 0.2)], "interior", senales);
    expect(r.key).toBe("interior_abridora");
  });

  it("sin deepRange ni popRange=three, interior_abridora queda inelegible (gate duro) aunque spotUp sea alto", () => {
    const r = detectarArchetype([sit("spotUp", 0.9), sit("post", 0.1)], "interior", SENALES_VACIAS);
    expect(r.key).not.toBe("interior_abridora");
  });

  it("pnrRollMan alto + transRole=rim_run -> interior_finalizadora", () => {
    const senales: SenalesArchetype = { ...SENALES_VACIAS, transRole: "rim_run" };
    const r = detectarArchetype([sit("pnrRollMan", 0.9), sit("transition", 0.8), sit("post", 0.2)], "interior", senales);
    expect(r.key).toBe("interior_finalizadora");
  });

  it("transition alta pero transRole NO es rim_run/leak -> se amortigua a la mitad, no basta para ganar sola", () => {
    const senales: SenalesArchetype = { ...SENALES_VACIAS, transRole: "trail" };
    const r = detectarArchetype([sit("transition", 0.96), sit("post", 0.5), sit("pnrRollMan", 0.3)], "interior", senales);
    // 0.5 * 0.96 = 0.48, por debajo de post(0.5) -- post debería ganar aquí.
    expect(r.key).toBe("interior_poste");
  });
});

describe("detectarArchetype — grupo ALERO", () => {
  it("iso alto + contactFinish=seeks -> alero_penetradora", () => {
    const senales: SenalesArchetype = { ...SENALES_VACIAS, contactFinish: "seeks", isoDec: "F", ath: 5 };
    const r = detectarArchetype([sit("iso", 0.9), sit("cut", 0.5)], "alero", senales);
    expect(r.key).toBe("alero_penetradora");
  });

  it("spotUp alto + deepRange=true -> alero_tiradora", () => {
    const senales: SenalesArchetype = { ...SENALES_VACIAS, deepRange: true, spotUpAction: "shoot" };
    const r = detectarArchetype([sit("spotUp", 0.9)], "alero", senales);
    expect(r.key).toBe("alero_tiradora");
  });

  it("transition alta con transRole=trail no es penetración -- caso real Klay Thompson, verificado contra motor-v2.1", () => {
    // Reproduce exactamente la situación de p005: transition alta, transRole
    // 'trail', sin iso/pnr real. Sin el condicional de transRole, el score de
    // transición se contaría como penetración y ganaría alero_penetradora.
    const senales: SenalesArchetype = { ...SENALES_VACIAS, transRole: "trail", deepRange: true };
    const r = detectarArchetype([sit("transition", 0.91), sit("cut", 0.68)], "alero", senales);
    expect(r.key).not.toBe("alero_penetradora");
  });

  it("offScreen/handoff altos + indirectFreq=P + cutType=curl -> alero_movimiento", () => {
    const senales: SenalesArchetype = { ...SENALES_VACIAS, indirectFreq: "P", cutType: "curl", dhoRole: "receiver", deepRange: true };
    const r = detectarArchetype([sit("offScreen", 0.8), sit("handoff", 0.6), sit("cut", 0.5)], "alero", senales);
    expect(r.key).toBe("alero_movimiento");
  });

  it("cutType=backdoor sin iso/pnr/post -> alero_movimiento, NUNCA alero_penetradora -- bug real corregido 2026-09-12", () => {
    // Un corte a la espalda del defensor (backdoor) es la acción sin balón
    // por definición -- explota que el defensor mira al balón, no un regate.
    // Reproduce test-profiles.json p019 (cortadora pura, usage:'role',
    // sin iso/pnr/post): antes de esta corrección, 'backdoor' contaba como
    // penetración y el perfil salía alero_penetradora, lo contrario de lo
    // que es.
    const senales: SenalesArchetype = { ...SENALES_VACIAS, cutType: "backdoor" };
    const r = detectarArchetype([sit("cut", 0.73), sit("transition", 0.34)], "alero", senales);
    expect(r.key).toBe("alero_movimiento");
  });

  it("cutType=basket SÍ cuenta como penetración (corte recto al aro, no backdoor)", () => {
    const senales: SenalesArchetype = { ...SENALES_VACIAS, cutType: "basket", contactFinish: "seeks", ath: 5 };
    const r = detectarArchetype([sit("cut", 0.73)], "alero", senales);
    expect(r.key).toBe("alero_penetradora");
  });
});

describe("detectarArchetype — propiedades generales", () => {
  it("el resultado siempre respeta el prefijo del grupo pedido, para cualquier combinación de señales", () => {
    const GRUPO_DE: Record<string, string> = {
      armadora_creadora: "base", armadora_anotadora: "base", manejadora_secundaria: "base",
      alero_penetradora: "alero", alero_tiradora: "alero", alero_movimiento: "alero",
      interior_creadora: "interior", interior_poste: "interior",
      interior_abridora: "interior", interior_finalizadora: "interior",
    };
    const situacionesDeMuestra: SituacionAmenaza[] = [
      sit("iso", 0.9), sit("post", 0.8), sit("spotUp", 0.7), sit("pnrRollMan", 0.6),
    ];
    for (const posicion of ["base", "alero", "interior"] as const) {
      const r = detectarArchetype(situacionesDeMuestra, posicion, {
        ...SENALES_VACIAS, usage: "primary", vision: 5, pnrPri: "PF", deepRange: true,
      });
      expect(GRUPO_DE[r.key], `posicion=${posicion} -> ${r.key}`).toBe(posicion);
    }
  });

  it("perfil vacío (todas las señales por defecto) no crashea en ningún grupo -- nunca undefined ni excepción", () => {
    // NO se asume un nivel de confianza uniforme entre grupos: verificado que
    // difiere (base: "alta" -- onBall=0 es evidencia fuerte de "no iniciadora";
    // interior: "baja"; alero: "media" -- las 3 fórmulas de margen tienen
    // escalas distintas, deuda ya reconocida en spec 21 / El Arquitecto §6.4
    // como "propuesta razonada, no medida". Este test solo bloquea que la
    // función explote con datos vacíos, no la calibración exacta.
    for (const posicion of ["base", "alero", "interior"] as const) {
      const r = detectarArchetype([], posicion, SENALES_VACIAS);
      expect(r.key).toBeTruthy();
      expect(["alta", "media", "baja"]).toContain(r.confianza);
    }
  });
});

describe("archetypeKey — cobertura completa del catálogo de 14.3 vía perfiles sintéticos (p011-p013)", () => {
  const CASOS: [string, string][] = [
    ["p011", "interior_abridora"],
    ["p012", "alero_penetradora"],
    ["p013", "alero_movimiento"],
  ];
  for (const [id, esperado] of CASOS) {
    it(`${id} -> ${esperado} (antes de este perfil, ningún dato real cubría este archetype)`, () => {
      const profile = profiles.find((p) => p.id === id)!;
      const reporte = ensamblarReporte(profile.inputs as any, profile.clubContext as any, {
        jugadoraId: profile.id,
        modo: "completo",
      });
      expect(reporte.identidad.archetypeKey, profile.name).toBe(esperado);
    });
  }

  it("los 10 archetypeKey del catálogo de 14.3 tienen ya al menos un perfil de test que los produce", () => {
    const TODOS = new Set<ArchetypeKey>([
      "armadora_creadora", "armadora_anotadora", "manejadora_secundaria",
      "alero_penetradora", "alero_tiradora", "alero_movimiento",
      "interior_creadora", "interior_poste", "interior_abridora", "interior_finalizadora",
    ]);
    const producidos = new Set(
      profiles.map((p) => {
        const r = ensamblarReporte(p.inputs as any, p.clubContext as any, { jugadoraId: p.id, modo: "completo" });
        return r.identidad.archetypeKey;
      }),
    );
    const faltantes = Array.from(TODOS).filter((k) => !producidos.has(k));
    expect(faltantes, `archetypes sin ningún perfil de test: ${faltantes.join(", ")}`).toEqual([]);
  });
});

describe("archetypeModificador — segunda dimensión excepcional (spec 14.3 bis, El Arquitecto 2026-09-12)", () => {
  it("p003 Curry (amenaza off-ball real, offScreen=0.92) -> de_movimiento", () => {
    const p003 = profiles.find((p) => p.id === "p003")!;
    const r = ensamblarReporte(p003.inputs as any, p003.clubContext as any, { jugadoraId: p003.id, modo: "completo" });
    expect(r.identidad.archetypeModificador).toBe("de_movimiento");
  });

  it("p005 Klay -- el caso que motivó el encargo: alero_tiradora + de_movimiento", () => {
    const p005 = profiles.find((p) => p.id === "p005")!;
    const r = ensamblarReporte(p005.inputs as any, p005.clubContext as any, { jugadoraId: p005.id, modo: "completo" });
    expect(r.identidad.archetypeKey).toBe("alero_tiradora");
    expect(r.identidad.archetypeModificador).toBe("de_movimiento");
  });

  it("p004 Giannis (transition=0.95, transRole=fill/pusher, deny nace de pnrHandler) -> a_la_contra", () => {
    const p004 = profiles.find((p) => p.id === "p004")!;
    const r = ensamblarReporte(p004.inputs as any, p004.clubContext as any, { jugadoraId: p004.id, modo: "completo" });
    expect(r.identidad.archetypeModificador).toBe("a_la_contra");
  });

  it("p008 Gobert: transición alta PERO deny.ganador ya nace de transición -> modificador suprimido (invariante anti-P2 más importante del diseño)", () => {
    const p008 = profiles.find((p) => p.id === "p008")!;
    const r = ensamblarReporte(p008.inputs as any, p008.clubContext as any, { jugadoraId: p008.id, modo: "completo" });
    if (r.modo !== "completo") throw new Error("esperaba modo completo");
    if (!r.capa2.deny) throw new Error("p008 debería tener deny real (transición alta)");
    expect(r.capa2.deny.ganador.situacionOrigen).toBe("transition");
    expect(r.identidad.archetypeModificador).toBeUndefined();
  });

  it("p013 (movement shooter sintético): señal de movimiento real, PERO archetypeKey ya es alero_movimiento -> modificador suprimido (anti-redundancia con la propia key)", () => {
    const p013 = profiles.find((p) => p.id === "p013")!;
    const r = ensamblarReporte(p013.inputs as any, p013.clubContext as any, { jugadoraId: p013.id, modo: "completo" });
    expect(r.identidad.archetypeKey).toBe("alero_movimiento");
    expect(r.identidad.archetypeModificador).toBeUndefined();
  });

  it("presupuesto cognitivo (spec 16.3b): el modificador dispara en como mucho un tercio de los perfiles -- si una regla futura lo dispara en más, este test debe fallar el build", () => {
    let conModificador = 0;
    for (const p of profiles) {
      const r = ensamblarReporte(p.inputs as any, p.clubContext as any, { jugadoraId: p.id, modo: "completo" });
      if (r.identidad.archetypeModificador) conModificador++;
    }
    expect(conModificador, `${conModificador}/${profiles.length} perfiles con modificador`).toBeLessThanOrEqual(Math.ceil(profiles.length / 3));
  });

  it("p011 (stretch five sintético, híbrido roll/pop genuino) -> archetypeConfianza 'baja', no un adjetivo inventado", () => {
    const p011 = profiles.find((p) => p.id === "p011")!;
    const r = ensamblarReporte(p011.inputs as any, p011.clubContext as any, { jugadoraId: p011.id, modo: "completo" });
    expect(r.identidad.archetypeConfianza).toBe("baja");
    expect(r.identidad.archetypeModificador).toBeUndefined();
  });

  it("es estrictamente aditivo: archetypeKey no cambia para ningún perfil frente a la tabla de oro ya verificada", () => {
    // Mismos 7 casos ya fijados en el describe "diseño real sobre Synergy" de
    // arriba -- si esto falla, el modificador rompió algo del cálculo base.
    const ORO: [string, string][] = [
      ["p001", "armadora_anotadora"], ["p002", "interior_creadora"],
      ["p004", "interior_finalizadora"], ["p006", "interior_poste"],
      ["p007", "armadora_creadora"], ["p009", "interior_creadora"], ["p010", "alero_tiradora"],
    ];
    for (const [id, esperado] of ORO) {
      const p = profiles.find((x) => x.id === id)!;
      const r = ensamblarReporte(p.inputs as any, p.clubContext as any, { jugadoraId: id, modo: "completo" });
      expect(r.identidad.archetypeKey, id).toBe(esperado);
    }
  });
});
