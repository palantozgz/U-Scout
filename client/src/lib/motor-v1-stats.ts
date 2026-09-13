/**
 * Motor 1.0 — Fase 2: enriquecimiento con Nivel 2 (U Stats). Spec sección 24,
 * plan de El Arquitecto (2026-09-13).
 *
 * Módulo puro, sin `fetch`/red — mismo patrón que `motor-v1-archetype.ts`
 * (spec sección 4: testeable con Vitest sin red/browser). Recibe el contexto
 * de Nivel 2 ya resuelto por `GET /api/stats/player-nivel2-context/:externalId`
 * (`server/routes.ts`) + el `ScoutingReportV1` ya ensamblado por el núcleo
 * puro de `motor-v1.ts` + `EnrichedInputs` (dato auxiliar, mismo patrón que
 * `ensamblarReporteParaTexto`, spec 23.3) — y produce el enriquecimiento:
 * `capa3`, `statsDestacados`, `quietEdge`, discrepancias Nivel 1/2, `porque`
 * por output, y `confianza` real. NUNCA hace fetch — combina datos ya
 * resueltos por el llamador (capa de React/Express, no este archivo).
 *
 * Fórmulas cerradas por El Arquitecto, no a decidir de nuevo aquí (spec 24.3):
 * - Contracción bayesiana: pseudo-cuentas, k por métrica (12.3).
 * - Percentil: interpolación lineal a trozos sobre P50/P85/P95 reales.
 * - Discrepancia Nivel 1/2: mapeo cerrado de 3 señales, no genérico.
 * - Quiet edge: solo `tipo: "estadistico"` en esta pasada (21.5: no hay
 *   agregado real de Nivel 1 de otras jugadoras para medir "típico
 *   cualitativo" todavía).
 * - `porque`: plantilla corta citando la métrica más relevante según
 *   `situacionOrigen`. El ejemplo de 15.5 (split de mano/dirección) NO es
 *   implementable con el PBP real de la WCBA (5.3/24.1) — se sustituye por
 *   una cita de métrica agregada de temporada.
 * - `confianza`: alta si Nivel 1 real sin discrepancia, o Nivel 2 con
 *   volumen suficiente sin discrepancia y coherente; media si solo una
 *   fuente sólida o discrepancia sin resolver; baja si ninguna.
 */

import type {
  PlayerRealStats,
  StatConVolumen,
  StatDestacado,
  QuietEdge,
  DiscrepanciaNivel1Nivel2,
  DefenseOutput,
  CampoConCandidatos,
  SituacionAmenaza,
  SituacionSynergy,
  PosicionJugadora,
  ReporteModoCompletoV1,
} from "./motor-v1-types";

// ---------------------------------------------------------------------------------
// Contexto de Nivel 2 -- forma que devuelve GET /api/stats/player-nivel2-context.
// Definido aquí (no en stats-api.ts) porque este archivo es la fuente de verdad
// de qué necesita el enriquecimiento -- stats-api.ts solo hace el fetch y
// devuelve esta forma tal cual.
// ---------------------------------------------------------------------------------

export type Nivel2MetricKey =
  | "ppg" | "rpg" | "apg" | "spg" | "bpg"
  | "tovPct" | "tsPct" | "eFGPct" | "fg3Pct" | "ftPct" | "ftaRate" | "usgPct" | "pie";

export interface Nivel2Raw extends Record<Nivel2MetricKey, number | null> {}

export interface Nivel2Breakpoint {
  p50: number;
  p85: number;
  /** Puede faltar -- 10.1/10.2 bis publican "—" para P95 en spg/bpg/tovPct/
   *  eFGPct (muestra insuficiente en el extremo). Se extrapola en vez de
   *  inventar un P95 falso -- ver `percentilPorInterpolacion`. */
  p95: number | null;
}

export type Nivel2Breakpoints = Partial<Record<Nivel2MetricKey, Nivel2Breakpoint | null>>;

export interface Nivel2ContextResponse {
  externalId: string;
  posicionGrupo: PosicionJugadora | null;
  ventana: "temporada";
  games: number;
  raw: Nivel2Raw;
  volumen: { games: number; fgaSum: number; fg3aSum: number; ftaSum: number };
  breakpoints: Nivel2Breakpoints | null;
}

// ---------------------------------------------------------------------------------
// Contracción bayesiana (spec 12.3) -- pseudo-cuentas, k por métrica (mitad
// del umbral mínimo de confianza que ya usa 10.1/10.2 bis para esa métrica).
// ---------------------------------------------------------------------------------

const K_POR_METRICA: Record<Nivel2MetricKey, number> = {
  fg3Pct: 20, // 10.1 exige >=30 intentos
  ftPct: 20,  // mismo criterio que fg3Pct (proxy foulDrawing/ftShooting, 15.4)
  tsPct: 25,  // 10.1 exige >=50 tiros
  eFGPct: 25,
  ppg: 8, rpg: 8, apg: 8, spg: 8, bpg: 8, // 10.1/10.2 bis exige >=8 partidos
  tovPct: 8, ftaRate: 8, usgPct: 8, pie: 8,
};

/** Volumen relevante por métrica -- games para las promedio-por-partido,
 *  intentos reales para los porcentajes de tiro. */
function volumenDe(metric: Nivel2MetricKey, volumen: Nivel2ContextResponse["volumen"]): number {
  if (metric === "fg3Pct") return volumen.fg3aSum;
  if (metric === "tsPct" || metric === "eFGPct") return volumen.fgaSum;
  if (metric === "ftPct") return volumen.ftaSum;
  return volumen.games;
}

/**
 * `valorContraído = (volumen·valorObservado + k·mediaGrupo) / (volumen + k)`
 * -- Beta-Binomial con pseudo-cuentas, la variante que 12.3 cita como "más
 * fácil de implementar". `mediaGrupo` = P50 del breakpoint (la mediana ES
 * el valor de referencia de grupo, no hace falta un campo aparte).
 */
export function shrinkValor(valorObservado: number, volumen: number, mediaGrupo: number, k: number): number {
  if (volumen + k <= 0) return mediaGrupo;
  return (volumen * valorObservado + k * mediaGrupo) / (volumen + k);
}

// ---------------------------------------------------------------------------------
// Percentil por interpolación lineal a trozos sobre los 3 puntos reales
// conocidos (P50/P85/P95) -- aproximación estándar cuando solo se conocen
// unos pocos cuantiles reales, no una CDF completa (spec 24.3).
// ---------------------------------------------------------------------------------

export function percentilPorInterpolacion(valor: number, bp: Nivel2Breakpoint): number {
  const { p50, p85, p95 } = bp;
  if (p85 === p50) return valor >= p50 ? 85 : 50; // grupo degenerado, evita división por 0
  if (valor <= p50) {
    if (p50 <= 0) return 50;
    return Math.max(0, Math.min(50, 50 * (valor / p50)));
  }
  if (valor <= p85) {
    return 50 + ((valor - p50) / (p85 - p50)) * 35;
  }
  // Por encima de P85: usa P95 real si existe; si no, extrapola con la misma
  // pendiente P50->P85 (documentado en el endpoint -- nunca un P95 inventado
  // en la capa de datos, la extrapolación vive aquí, explícita).
  const pendienteAlta = p95 != null && p95 > p85 ? (p95 - p85) / 10 : (p85 - p50) / 35;
  const tramoDesdeP95 = p95 != null ? 95 : 85;
  const base = p95 != null ? p95 : p85;
  if (valor <= base) {
    return 85 + ((valor - p85) / (base - p85 || 1)) * (tramoDesdeP95 - 85);
  }
  return Math.min(99, tramoDesdeP95 + (valor - base) / (pendienteAlta || 1));
}

/** Combina shrinkage + percentil en un `StatConVolumen` completo, o `null` si
 *  no hay breakpoint real de grupo contra el que medir (jugadora sin grupo
 *  de posición asignado, 29/236 en 10.2 bis -- degradación elegante, nunca
 *  un percentil inventado). */
export function construirStatConVolumen(
  metric: Nivel2MetricKey,
  ctx: Nivel2ContextResponse,
): StatConVolumen | null {
  const valorObservado = ctx.raw[metric];
  const bp = ctx.breakpoints?.[metric];
  if (valorObservado == null || !bp) return null;
  const volumen = volumenDe(metric, ctx.volumen);
  const k = K_POR_METRICA[metric];
  const valorContraido = shrinkValor(valorObservado, volumen, bp.p50, k);
  return {
    valor: valorObservado,
    percentil: percentilPorInterpolacion(valorObservado, bp),
    percentilAjustadoPorMuestra: percentilPorInterpolacion(valorContraido, bp),
    volumenIntentos: volumen,
    ventana: ctx.ventana === "temporada" ? "temporada" : "ultimos_12",
  };
}

// ---------------------------------------------------------------------------------
// capa3 (PlayerRealStats) -- solo se rellena si TODAS las 12 métricas del
// contrato tienen dato real; si falta una, `capa3` se queda `undefined`
// entero (es opcional en `ReporteModoCompletoV1`) -- nunca un objeto a medias
// con un campo inventado.
// ---------------------------------------------------------------------------------

const CAMPOS_PLAYER_REAL_STATS: { campo: keyof PlayerRealStats; metric: Nivel2MetricKey }[] = [
  { campo: "ppg", metric: "ppg" },
  { campo: "rpg", metric: "rpg" },
  { campo: "apg", metric: "apg" },
  { campo: "spg", metric: "spg" },
  { campo: "bpg", metric: "bpg" },
  { campo: "fg3Pct", metric: "fg3Pct" },
  { campo: "efgPct", metric: "eFGPct" },
  { campo: "tsPct", metric: "tsPct" },
  { campo: "usgPct", metric: "usgPct" },
  { campo: "tovPct", metric: "tovPct" },
  { campo: "ftPct", metric: "ftPct" },
  { campo: "ftaRate", metric: "ftaRate" },
];

export function construirPlayerRealStats(ctx: Nivel2ContextResponse): PlayerRealStats | undefined {
  const parcial: Partial<PlayerRealStats> = {};
  for (const { campo, metric } of CAMPOS_PLAYER_REAL_STATS) {
    const stat = construirStatConVolumen(metric, ctx);
    if (!stat) return undefined; // degradación elegante -- capa3 completo o ausente
    parcial[campo] = stat;
  }
  return parcial as PlayerRealStats;
}

// ---------------------------------------------------------------------------------
// statsDestacados (spec 10.3) -- percentilAjustadoPorMuestra >= 85, ordenado
// por cuánto superan el umbral, máximo 3 (completo) / 1 (sencillo, el más
// extremo). TOV no es un "destacado" positivo (10.3 punto 6) -- se excluye
// aquí a propósito, nunca aparece como chip de fortaleza.
// ---------------------------------------------------------------------------------

export function seleccionarStatsDestacados(stats: PlayerRealStats, max: number): StatDestacado[] {
  const candidatos = (["ppg", "rpg", "apg", "spg", "bpg", "fg3Pct", "efgPct", "tsPct", "usgPct"] as const)
    .map((campo) => ({ campo, stat: stats[campo] }))
    .filter((c) => c.stat.percentilAjustadoPorMuestra >= 85)
    .sort((a, b) => b.stat.percentilAjustadoPorMuestra - a.stat.percentilAjustadoPorMuestra);

  return candidatos.slice(0, max).map(({ campo, stat }) => ({
    campo,
    stat,
    nivel: stat.percentilAjustadoPorMuestra >= 95 ? "elite" : "destacado",
  }));
}

// ---------------------------------------------------------------------------------
// Quiet edge (spec 13.2/24.3) -- SOLO tipo "estadistico" en esta pasada. La
// tabla de "atípico para el grupo" es la misma que ya usan los ejemplos de
// 10.2 bis como prueba del problema (una base con rebote, un interior con
// asistencias/triples) -- no una heurística nueva sin respaldo.
// ---------------------------------------------------------------------------------

const ATIPICO_POR_GRUPO: Record<PosicionJugadora, (keyof PlayerRealStats)[]> = {
  base: ["rpg", "bpg"],
  alero: ["apg"],
  interior: ["apg", "fg3Pct"],
};

export function seleccionarQuietEdge(
  stats: PlayerRealStats,
  posicion: PosicionJugadora,
  statsDestacados: StatDestacado[],
): QuietEdge | undefined {
  const yaDestacados = new Set(statsDestacados.map((d) => d.campo));
  const candidatos = ATIPICO_POR_GRUPO[posicion]
    .filter((campo) => !yaDestacados.has(campo))
    .map((campo) => ({ campo, stat: stats[campo] }))
    .filter((c) => c.stat.percentilAjustadoPorMuestra >= 70)
    .sort((a, b) => b.stat.percentilAjustadoPorMuestra - a.stat.percentilAjustadoPorMuestra);

  if (candidatos.length === 0) return undefined;
  const elegido = candidatos[0];
  return {
    seleccion: { tipo: "estadistico", campo: elegido.campo, stat: elegido.stat },
    motivo: "inesperado_para_posicion",
  };
}

// ---------------------------------------------------------------------------------
// Discrepancia Nivel 1 vs Nivel 2 (spec 5.4/13.1/24.3) -- mapeo cerrado de 3
// señales, NUNCA autocorrige (soloAviso: true a nivel de tipo).
// ---------------------------------------------------------------------------------

const UMBRAL_DISCREPANCIA = 85;

export function detectarDiscrepancias(
  situaciones: SituacionAmenaza[],
  stats: PlayerRealStats,
): DiscrepanciaNivel1Nivel2[] {
  const discrepancias: DiscrepanciaNivel1Nivel2[] = [];
  const freq = (s: SituacionSynergy) => situaciones.find((x) => x.situacion === s)?.frecuenciaObservada ?? "N";

  // Señal 1: iso/pnrHandler/post todas N/R, pero USG% real alto -- alguien
  // con ese volumen de posesiones no puede ser un rol tan secundario.
  const sinCargaOnBall = (["iso", "pnrHandler", "post"] as const).every((s) => {
    const f = freq(s);
    return f === "N" || f === "R";
  });
  if (sinCargaOnBall && stats.usgPct.percentilAjustadoPorMuestra >= UMBRAL_DISCREPANCIA) {
    discrepancias.push({
      campoNivel1: "iso/pnrHandler/post.frecuencia",
      valorNivel1: "N/R en las tres",
      campoNivel2: "usgPct",
      valorNivel2: stats.usgPct,
      motivo: `El staff no marca ninguna situación de creación primaria, pero su USG% real está en P${Math.round(stats.usgPct.percentilAjustadoPorMuestra)} de su posición — revisar si falta marcar una situación primaria.`,
      soloAviso: true,
    });
  }

  // Señal 2: ninguna situación marcada "P" (sin primaria), pero PPG real alto.
  const sinPrimaria = situaciones.every((s) => s.frecuenciaObservada !== "P");
  if (sinPrimaria && stats.ppg.percentilAjustadoPorMuestra >= UMBRAL_DISCREPANCIA) {
    discrepancias.push({
      campoNivel1: "situaciones.frecuencia",
      valorNivel1: "ninguna Primaria",
      campoNivel2: "ppg",
      valorNivel2: stats.ppg,
      motivo: `El staff no marca ninguna situación como Primaria, pero su PPG real está en P${Math.round(stats.ppg.percentilAjustadoPorMuestra)} de su posición — revisar si hay una situación primaria sin marcar.`,
      soloAviso: true,
    });
  }

  // Señal 3: spotUp nunca marcado, pero 3P% real alto con volumen real.
  if (freq("spotUp") === "N" && stats.fg3Pct.percentilAjustadoPorMuestra >= UMBRAL_DISCREPANCIA && stats.fg3Pct.volumenIntentos >= 20) {
    discrepancias.push({
      campoNivel1: "spotUp.frecuencia",
      valorNivel1: "N",
      campoNivel2: "fg3Pct",
      valorNivel2: stats.fg3Pct,
      motivo: `El staff marca "Nunca" en spot-up, pero su 3P% real está en P${Math.round(stats.fg3Pct.percentilAjustadoPorMuestra)} de su posición (${stats.fg3Pct.volumenIntentos} intentos) — revisar si de verdad nunca tira desde fuera.`,
      soloAviso: true,
    });
  }

  return discrepancias;
}

// ---------------------------------------------------------------------------------
// `porque` (spec 15.5/24.3) -- plantilla corta citando la métrica más
// relevante según `situacionOrigen`. El ejemplo original de 15.5 (split de
// mano/dirección, "finaliza 61% mejor por derecha") NO es implementable con
// el PBP real de la WCBA (5.3) -- se cita una métrica agregada real en su
// lugar, nunca la comparación direccional que no existe.
// ---------------------------------------------------------------------------------

const METRICA_POR_SITUACION: Partial<Record<SituacionSynergy, (keyof PlayerRealStats)[]>> = {
  iso: ["usgPct", "tsPct"],
  pnrHandler: ["usgPct", "tsPct"],
  post: ["usgPct", "tsPct"],
  spotUp: ["fg3Pct"],
  offScreen: ["fg3Pct"],
  cut: ["efgPct"],
  putback: ["efgPct"],
};

const UMBRAL_PORQUE = 70;

export function generarPorque(situacionOrigen: SituacionSynergy, stats: PlayerRealStats | undefined): string | undefined {
  if (!stats) return undefined;
  const candidatos = METRICA_POR_SITUACION[situacionOrigen];
  if (!candidatos) return undefined; // sin proxy razonable -- nunca forzar una cita débil (spec 24.3)
  for (const campo of candidatos) {
    const stat = stats[campo];
    if (stat.percentilAjustadoPorMuestra >= UMBRAL_PORQUE) {
      const etiqueta: Record<string, string> = {
        usgPct: "USG%", tsPct: "TS%", fg3Pct: "3P%", efgPct: "eFG%",
      };
      return `${etiqueta[campo]} real: ${stat.valor.toFixed(1)}% (P${Math.round(stat.percentilAjustadoPorMuestra)} en su posición).`;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------------
// confianza real (spec 13.2/24.3) -- reemplaza confianzaProvisional(score)
// de motor-v1.ts para los outputs que sí tienen datos de Nivel 2 disponibles.
// ---------------------------------------------------------------------------------

export function confianzaConNivel2(
  situacionOrigen: SituacionSynergy,
  frecuenciaObservada: "P" | "S" | "R" | "N",
  stats: PlayerRealStats | undefined,
  discrepancias: DiscrepanciaNivel1Nivel2[],
): "alta" | "media" | "baja" {
  const nivel1Real = frecuenciaObservada === "P" || frecuenciaObservada === "S";
  const metricas = METRICA_POR_SITUACION[situacionOrigen] ?? [];
  const nivel2ConVolumen = Boolean(
    stats && metricas.some((campo) => {
      const s = stats[campo];
      const trustFloor = campo === "fg3Pct" || campo === "ftPct" ? 20 : campo === "tsPct" || campo === "efgPct" ? 25 : 8;
      return s.volumenIntentos >= trustFloor;
    }),
  );
  const hayDiscrepancia = discrepancias.some(
    (d) => d.campoNivel1.startsWith(situacionOrigen) || metricas.includes(d.campoNivel2 as keyof PlayerRealStats),
  );

  if (hayDiscrepancia) return "media"; // tope -- nunca "alta" con contradicción abierta
  if ((nivel1Real && !hayDiscrepancia) || (nivel2ConVolumen && !hayDiscrepancia)) {
    return nivel1Real && nivel2ConVolumen ? "alta" : nivel1Real || nivel2ConVolumen ? "alta" : "media";
  }
  return "baja";
}

// ---------------------------------------------------------------------------------
// Orquestador -- combina todo lo anterior sobre un ReporteModoCompletoV1 ya
// ensamblado. No hace fetch. Devuelve un reporte nuevo (no muta el original).
// ---------------------------------------------------------------------------------

function enriquecerOutput(
  output: DefenseOutput,
  posicion: PosicionJugadora,
  stats: PlayerRealStats | undefined,
  situaciones: SituacionAmenaza[],
  discrepancias: DiscrepanciaNivel1Nivel2[],
): DefenseOutput {
  const situ = situaciones.find((s) => s.situacion === output.situacionOrigen);
  const frecuencia = situ?.frecuenciaObservada ?? "N";
  return {
    ...output,
    porque: generarPorque(output.situacionOrigen, stats),
    confianza: confianzaConNivel2(output.situacionOrigen, frecuencia, stats, discrepancias),
  };
}

function enriquecerCampo(
  campo: CampoConCandidatos | undefined,
  posicion: PosicionJugadora,
  stats: PlayerRealStats | undefined,
  situaciones: SituacionAmenaza[],
  discrepancias: DiscrepanciaNivel1Nivel2[],
): CampoConCandidatos | undefined {
  if (!campo) return undefined;
  const candidatos = campo.candidatos.map((c) => ({
    ...c,
    output: enriquecerOutput(c.output, posicion, stats, situaciones, discrepancias),
  }));
  return { ganador: candidatos[0].output, candidatos };
}

/**
 * Enriquece un `ReporteModoCompletoV1` ya ensamblado con Nivel 2 -- rellena
 * `capa3`, `identidad.statsDestacados`/`quietEdge`, y `porque`/`confianza`
 * por output. Si `nivel2` es `undefined` (jugadora sin vínculo a WCBA), el
 * reporte vuelve tal cual, sin cambios -- Nivel 2 es contexto opcional, nunca
 * obligatorio (spec 5.1).
 */
export function enriquecerReporteConNivel2(
  reporte: ReporteModoCompletoV1,
  nivel2: Nivel2ContextResponse | undefined,
  statsDestacadosMax = 3,
): ReporteModoCompletoV1 {
  if (!nivel2) return reporte;
  const stats = construirPlayerRealStats(nivel2);
  if (!stats) return reporte; // degradación elegante -- sin capa3 completo, no se toca nada

  const discrepancias = detectarDiscrepancias(reporte.capa1.situaciones, stats);
  const statsDestacados = seleccionarStatsDestacados(stats, statsDestacadosMax);
  const quietEdge = seleccionarQuietEdge(stats, reporte.identidad.posicion, statsDestacados);
  const posicion = reporte.identidad.posicion;
  const situaciones = reporte.capa1.situaciones;

  return {
    ...reporte,
    identidad: { ...reporte.identidad, statsDestacados, quietEdge },
    capa2: {
      ...reporte.capa2,
      deny: enriquecerCampo(reporte.capa2.deny, posicion, stats, situaciones, discrepancias),
      force: enriquecerCampo(reporte.capa2.force, posicion, stats, situaciones, discrepancias),
      allow: enriquecerCampo(reporte.capa2.allow, posicion, stats, situaciones, discrepancias),
      aware: reporte.capa2.aware.map(
        (a) => enriquecerCampo(a, posicion, stats, situaciones, discrepancias)!,
      ) as typeof reporte.capa2.aware,
    },
    capa3: stats,
  };
}
