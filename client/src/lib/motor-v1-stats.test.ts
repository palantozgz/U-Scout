/**
 * Tests de `motor-v1-stats.ts` (spec 24, Fase 2 -- El Arquitecto 2026-09-13).
 * Fixtures fijas, sin red -- mismo patrón que `motor-v1-archetype.test.ts`.
 */
import { describe, expect, it } from "vitest";
import {
  shrinkValor,
  percentilPorInterpolacion,
  construirStatConVolumen,
  construirPlayerRealStats,
  seleccionarStatsDestacados,
  seleccionarQuietEdge,
  detectarDiscrepancias,
  generarPorque,
  confianzaConNivel2,
  enriquecerReporteConNivel2,
  type Nivel2ContextResponse,
  type Nivel2Breakpoint,
} from "./motor-v1-stats";
import { ensamblarReporte } from "./motor-v1";
import type { PlayerRealStats, SituacionAmenaza, StatDestacado } from "./motor-v1-types";
import testProfilesRaw from "../../../scripts/test-profiles.json";

interface TestProfile { id: string; name: string; inputs: Record<string, unknown>; clubContext?: Record<string, unknown>; }
const profiles = testProfilesRaw as unknown as TestProfile[];

const BP_PPG: Nivel2Breakpoint = { p50: 6, p85: 12, p95: 15 };
const BP_USG: Nivel2Breakpoint = { p50: 18, p85: 24, p95: 29 };
const BP_FG3: Nivel2Breakpoint = { p50: 31, p85: 39, p95: 44 };
const BP_SIN_P95: Nivel2Breakpoint = { p50: 1, p85: 3, p95: null };

function ctxCompleto(overrides?: Partial<Nivel2ContextResponse>): Nivel2ContextResponse {
  return {
    externalId: "999",
    posicionGrupo: "alero",
    ventana: "temporada",
    games: 20,
    raw: {
      ppg: 14, rpg: 4, apg: 2, spg: 1, bpg: 0.3,
      tovPct: 15, tsPct: 58, eFGPct: 54, fg3Pct: 40, ftPct: 78, ftaRate: 0.3,
      usgPct: 22, pie: 6,
    },
    volumen: { games: 20, fgaSum: 120, fg3aSum: 60, ftaSum: 40 },
    breakpoints: {
      ppg: BP_PPG, rpg: BP_SIN_P95, apg: BP_SIN_P95, spg: BP_SIN_P95, bpg: BP_SIN_P95,
      tovPct: BP_SIN_P95, tsPct: { p50: 51, p85: 60, p95: 64 }, eFGPct: BP_SIN_P95,
      fg3Pct: BP_FG3, ftPct: { p50: 74, p85: 84, p95: null }, ftaRate: { p50: 0.25, p85: 0.45, p95: null },
      usgPct: BP_USG, pie: { p50: 3, p85: 8, p95: 13 },
    },
    ...overrides,
  };
}

describe("shrinkValor — contracción bayesiana", () => {
  it("con volumen alto, el valor contraído se acerca al observado", () => {
    const v = shrinkValor(40, 200, 31, 20); // fg3Pct, k=20, 200 intentos
    expect(v).toBeCloseTo(40 - (40 - 31) * (20 / 220), 1);
    expect(v).toBeGreaterThan(38); // cerca del observado, lejos de la media
  });
  it("con volumen bajo, el valor contraído se acerca a la media de grupo", () => {
    const v = shrinkValor(100, 2, 31, 20); // 2 intentos, 100% -- caso "3/3 en triples"
    expect(v).toBeLessThan(50); // se encoge muchísimo hacia la media (31)
    expect(v).toBeGreaterThan(31);
  });
  it("con volumen 0, el valor contraído ES la media de grupo (sin dato real, no hay nada que mezclar)", () => {
    expect(shrinkValor(100, 0, 31, 20)).toBeCloseTo(31, 6);
  });
});

describe("percentilPorInterpolacion", () => {
  it("en P50 exacto da 50", () => {
    expect(percentilPorInterpolacion(6, BP_PPG)).toBeCloseTo(50, 6);
  });
  it("en P85 exacto da 85", () => {
    expect(percentilPorInterpolacion(12, BP_PPG)).toBeCloseTo(85, 6);
  });
  it("en P95 exacto da 95 (cuando el breakpoint SÍ tiene P95)", () => {
    expect(percentilPorInterpolacion(15, BP_PPG)).toBeCloseTo(95, 6);
  });
  it("por debajo de P50 interpola linealmente hacia 0", () => {
    const p = percentilPorInterpolacion(3, BP_PPG); // mitad de P50
    expect(p).toBeCloseTo(25, 1);
  });
  it("entre P50 y P85 interpola linealmente", () => {
    const p = percentilPorInterpolacion(9, BP_PPG); // punto medio 6..12
    expect(p).toBeCloseTo(67.5, 1);
  });
  it("por encima de P95 real, sigue creciendo pero acotado a 99", () => {
    const p = percentilPorInterpolacion(30, BP_PPG); // muy por encima de p95=15
    expect(p).toBeLessThanOrEqual(99);
    expect(p).toBeGreaterThan(95);
  });
  it("sin P95 (breakpoint tipo spg/bpg/tovPct/eFGPct), extrapola con la pendiente P50->P85 en vez de inventar un P95", () => {
    const enP85 = percentilPorInterpolacion(3, BP_SIN_P95);
    expect(enP85).toBeCloseTo(85, 6);
    const porEncima = percentilPorInterpolacion(5, BP_SIN_P95); // por encima de p85=3, sin p95
    expect(porEncima).toBeGreaterThan(85);
    expect(porEncima).toBeLessThanOrEqual(99);
  });
  it("grupo degenerado (p50===p85) no divide por cero", () => {
    const bp: Nivel2Breakpoint = { p50: 5, p85: 5, p95: null };
    expect(percentilPorInterpolacion(5, bp)).toBe(85);
    expect(percentilPorInterpolacion(3, bp)).toBe(50);
  });
});

describe("construirStatConVolumen / construirPlayerRealStats — degradación elegante", () => {
  it("con contexto completo, construye el StatConVolumen de una métrica real", () => {
    const ctx = ctxCompleto();
    const stat = construirStatConVolumen("ppg", ctx);
    expect(stat).not.toBeNull();
    expect(stat!.valor).toBe(14);
    expect(stat!.volumenIntentos).toBe(20); // games
    expect(stat!.percentil).toBeGreaterThan(50); // 14 > p50=6
    expect(stat!.ventana).toBe("temporada");
  });

  it("sin breakpoint de esa métrica (grupo sin dato o dato real ausente), devuelve null -- nunca un percentil inventado", () => {
    const ctx = ctxCompleto({ breakpoints: null });
    expect(construirStatConVolumen("ppg", ctx)).toBeNull();
  });

  it("construirPlayerRealStats: con las 12 métricas completas, devuelve el objeto completo", () => {
    const stats = construirPlayerRealStats(ctxCompleto());
    expect(stats).toBeDefined();
    expect(stats!.ppg.valor).toBe(14);
    expect(stats!.fg3Pct.valor).toBe(40);
  });

  it("construirPlayerRealStats: si falta UNA sola métrica, capa3 entero queda undefined -- nunca un objeto a medias", () => {
    const ctx = ctxCompleto();
    ctx.breakpoints!.bpg = null; // una sola métrica sin breakpoint
    expect(construirPlayerRealStats(ctx)).toBeUndefined();
  });

  it("jugadora sin grupo de posición (29/236 en 10.2 bis): capa3 undefined, no se inventa nada", () => {
    const ctx = ctxCompleto({ posicionGrupo: null, breakpoints: null });
    expect(construirPlayerRealStats(ctx)).toBeUndefined();
  });
});

describe("seleccionarStatsDestacados", () => {
  const stats = construirPlayerRealStats(ctxCompleto())!;

  it("solo incluye métricas con percentilAjustadoPorMuestra >= 85", () => {
    const destacados = seleccionarStatsDestacados(stats, 3);
    for (const d of destacados) expect(d.stat.percentilAjustadoPorMuestra).toBeGreaterThanOrEqual(85);
  });

  it("nunca incluye tovPct como destacado (spec 10.3 punto 6 -- TOV alto no es una fortaleza)", () => {
    const ctxTovAlto = ctxCompleto({ raw: { ...ctxCompleto().raw, tovPct: 40 } });
    const s = construirPlayerRealStats(ctxTovAlto)!;
    const destacados = seleccionarStatsDestacados(s, 3);
    expect(destacados.some((d) => d.campo === "tovPct")).toBe(false);
  });

  it("respeta el máximo (modo sencillo: 1, el más extremo)", () => {
    // fg3Pct=40 está más cerca del extremo alto que ppg=14 en este fixture
    const destacados = seleccionarStatsDestacados(stats, 1);
    expect(destacados.length).toBeLessThanOrEqual(1);
  });

  it("nivel 'elite' a partir de P95 ajustado, 'destacado' entre P85 y P95", () => {
    const ctxElite = ctxCompleto({ raw: { ...ctxCompleto().raw, ppg: 20 } }); // muy por encima de p95=15
    const s = construirPlayerRealStats(ctxElite)!;
    const d = seleccionarStatsDestacados(s, 3).find((x) => x.campo === "ppg");
    expect(d?.nivel).toBe("elite");
  });
});

describe("seleccionarQuietEdge — solo tipo estadistico en esta pasada", () => {
  it("alero: rpg/bpg altos SÍ cualifican (tabla de 'atípico' correcta), pero apg NO está en su tabla", () => {
    // alero: solo "apg" es atípico según ATIPICO_POR_GRUPO -- probamos que
    // una jugadora alero con apg alto sí puede salir como quiet edge.
    const ctx = ctxCompleto({ raw: { ...ctxCompleto().raw, apg: 8 }, breakpoints: { ...ctxCompleto().breakpoints, apg: { p50: 1, p85: 2.5, p95: 3.5 } } });
    const stats = construirPlayerRealStats(ctx)!;
    const destacados: StatDestacado[] = []; // apg no está en destacados en este caso
    const qe = seleccionarQuietEdge(stats, "alero", destacados);
    expect(qe?.seleccion.tipo).toBe("estadistico");
    if (qe?.seleccion.tipo === "estadistico") expect(qe.seleccion.campo).toBe("apg");
    expect(qe?.motivo).toBe("inesperado_para_posicion");
  });

  it("nunca repite un campo que ya está en statsDestacados (no añade información nueva, principio P2)", () => {
    const ctx = ctxCompleto({ raw: { ...ctxCompleto().raw, apg: 8 }, breakpoints: { ...ctxCompleto().breakpoints, apg: { p50: 1, p85: 2.5, p95: 3.5 } } });
    const stats = construirPlayerRealStats(ctx)!;
    const yaDestacado: StatDestacado[] = [{ campo: "apg", stat: stats.apg, nivel: "elite" }];
    const qe = seleccionarQuietEdge(stats, "alero", yaDestacado);
    expect(qe).toBeUndefined();
  });

  it("sin ningún candidato que supere el umbral 70, devuelve undefined -- nunca forzado", () => {
    const stats = construirPlayerRealStats(ctxCompleto())!; // apg normal en este fixture
    const qe = seleccionarQuietEdge(stats, "alero", []);
    expect(qe).toBeUndefined();
  });
});

describe("detectarDiscrepancias — mapeo cerrado de 3 señales, soloAviso siempre true", () => {
  const stats = construirPlayerRealStats(ctxCompleto({ raw: { ...ctxCompleto().raw, usgPct: 30, ppg: 20, fg3Pct: 44 } }))!;

  it("señal 1: sin carga on-ball marcada pero USG% real alto", () => {
    const situaciones: SituacionAmenaza[] = [
      { situacion: "iso", score: 0, frecuenciaObservada: "N" },
      { situacion: "pnrHandler", score: 0, frecuenciaObservada: "R" },
      { situacion: "post", score: 0, frecuenciaObservada: "N" },
      { situacion: "spotUp", score: 0.5, frecuenciaObservada: "P" },
    ];
    const d = detectarDiscrepancias(situaciones, stats);
    expect(d.some((x) => x.campoNivel2 === "usgPct")).toBe(true);
    expect(d.every((x) => x.soloAviso === true)).toBe(true);
  });

  it("señal 2: ninguna situación Primaria pero PPG real alto", () => {
    const situaciones: SituacionAmenaza[] = [
      { situacion: "iso", score: 0, frecuenciaObservada: "S" },
      { situacion: "spotUp", score: 0, frecuenciaObservada: "R" },
    ];
    const d = detectarDiscrepancias(situaciones, stats);
    expect(d.some((x) => x.campoNivel2 === "ppg")).toBe(true);
  });

  it("señal 3: spotUp marcado Nunca pero 3P% real alto con volumen real", () => {
    const situaciones: SituacionAmenaza[] = [
      { situacion: "iso", score: 0.5, frecuenciaObservada: "P" },
      { situacion: "spotUp", score: 0, frecuenciaObservada: "N" },
    ];
    const d = detectarDiscrepancias(situaciones, stats);
    expect(d.some((x) => x.campoNivel2 === "fg3Pct")).toBe(true);
  });

  it("sin señales reales, no dispara nada", () => {
    const situaciones: SituacionAmenaza[] = [
      { situacion: "iso", score: 0.8, frecuenciaObservada: "P" },
      { situacion: "spotUp", score: 0.5, frecuenciaObservada: "P" },
    ];
    const statsNormales = construirPlayerRealStats(ctxCompleto())!;
    expect(detectarDiscrepancias(situaciones, statsNormales)).toHaveLength(0);
  });
});

describe("generarPorque — cita métrica real, nunca el ejemplo de split direccional (no implementable, spec 24.1)", () => {
  const stats = construirPlayerRealStats(ctxCompleto({ raw: { ...ctxCompleto().raw, usgPct: 26, fg3Pct: 42 } }))!;

  it("iso/pnrHandler/post citan usgPct o tsPct si superan el umbral", () => {
    const texto = generarPorque("iso", stats);
    expect(texto).toBeDefined();
    expect(texto).toMatch(/USG%|TS%/);
  });

  it("spotUp/offScreen citan fg3Pct", () => {
    const texto = generarPorque("spotUp", stats);
    expect(texto).toContain("3P%");
  });

  it("situación sin proxy razonable (ej. transition) devuelve undefined -- nunca fuerza una cita débil", () => {
    expect(generarPorque("transition", stats)).toBeUndefined();
  });

  it("sin stats (Nivel 2 no disponible), siempre undefined", () => {
    expect(generarPorque("iso", undefined)).toBeUndefined();
  });

  it("por debajo del umbral 70, no cita nada aunque haya dato", () => {
    const statsBajos = construirPlayerRealStats(ctxCompleto({ raw: { ...ctxCompleto().raw, usgPct: 10, tsPct: 40 } }))!;
    expect(generarPorque("iso", statsBajos)).toBeUndefined();
  });
});

describe("confianzaConNivel2", () => {
  const stats = construirPlayerRealStats(ctxCompleto({ raw: { ...ctxCompleto().raw, usgPct: 26 } }))!;

  it("Nivel 1 real (P/S) + Nivel 2 con volumen + sin discrepancia = alta", () => {
    expect(confianzaConNivel2("iso", "P", stats, [])).toBe("alta");
  });

  it("con discrepancia sin resolver sobre esa métrica, nunca sube a alta (tope en media)", () => {
    // usgPct alto de verdad (40, no 26) para que la discrepancia SÍ dispare
    // tras la contracción bayesiana -- con solo 20 partidos de volumen (k=8),
    // 26 se contrae a ~P83, por debajo del umbral de 85 (ver el test de
    // "señal 1" de detectarDiscrepancias, que ya usa 30 con éxito).
    const statsConDiscrepancia = construirPlayerRealStats(ctxCompleto({ raw: { ...ctxCompleto().raw, usgPct: 40 } }))!;
    const discrepancia = detectarDiscrepancias(
      [{ situacion: "iso", score: 0, frecuenciaObservada: "N" }, { situacion: "pnrHandler", score: 0, frecuenciaObservada: "N" }, { situacion: "post", score: 0, frecuenciaObservada: "N" }],
      statsConDiscrepancia,
    );
    expect(discrepancia.length).toBeGreaterThan(0); // confirma que el fixture sí dispara antes de probar el tope
    expect(confianzaConNivel2("iso", "P", statsConDiscrepancia, discrepancia)).toBe("media");
  });

  it("sin Nivel 1 real ni Nivel 2 (frecuencia R/N, sin stats), baja", () => {
    expect(confianzaConNivel2("iso", "N", undefined, [])).toBe("baja");
  });
});

describe("enriquecerReporteConNivel2 — integración con un perfil real del fixture", () => {
  it("sin contexto Nivel 2 (jugadora sin vínculo WCBA), el reporte vuelve exactamente igual", () => {
    const p001 = profiles.find((p) => p.id === "p001")!;
    const reporte = ensamblarReporte(p001.inputs as any, p001.clubContext as any, { jugadoraId: p001.id, modo: "completo" });
    if (reporte.modo !== "completo") throw new Error("esperaba completo");
    const resultado = enriquecerReporteConNivel2(reporte, undefined);
    expect(resultado).toBe(reporte); // misma referencia, sin tocar nada
    expect(resultado.capa3).toBeUndefined();
  });

  it("con contexto Nivel 2 completo, rellena capa3/statsDestacados y porque/confianza en los outputs", () => {
    const p001 = profiles.find((p) => p.id === "p001")!;
    const reporte = ensamblarReporte(p001.inputs as any, p001.clubContext as any, { jugadoraId: p001.id, modo: "completo" });
    if (reporte.modo !== "completo") throw new Error("esperaba completo");

    const ctx = ctxCompleto({ posicionGrupo: reporte.identidad.posicion });
    const enriquecido = enriquecerReporteConNivel2(reporte, ctx);

    expect(enriquecido.capa3).toBeDefined();
    expect(enriquecido.identidad.statsDestacados).toBeDefined();
    // el reporte original NO se muta
    expect(reporte.capa3).toBeUndefined();

    if (enriquecido.capa2.deny) {
      // confianza ya no es la heurística provisional por score -- puede
      // seguir siendo la misma categoría, pero el campo `porque` debe existir
      // como posibilidad (string u undefined, nunca lanzar).
      expect(["alta", "media", "baja"]).toContain(enriquecido.capa2.deny.ganador.confianza);
    }
  });
});
