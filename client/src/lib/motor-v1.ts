/**
 * Motor 1.0 — núcleo de cálculo (Fase 1, en progreso).
 *
 * Orquesta el motor calibrado de `motor-v2.1.ts` (que conserva — sección 3 de
 * la spec: taxonomía de situaciones, calibración contra literatura real, cap
 * anti-inflación) y lo reforma con el contrato de `motor-v1-types.ts`: cada
 * campo tocable como `CampoConCandidatos` (17.1, nunca solo el ganador), el
 * ranking de situaciones correctamente capado (bug de `motor-v4.ts` corregido,
 * ver spec sección 3), y el reporte final como unión discriminada por `modo`
 * (13.3, Capa 0 con acción exclusiva de modo sencillo).
 *
 * SIN acoplamiento a React/browser (sección 4 de la spec) — solo depende de
 * `motor-v2.1.ts` (puro) y de los tipos de `motor-v1-types.ts`.
 *
 * ## Lo que este archivo SÍ resuelve hoy
 * - `situacionesAmenaza()`: ranking de situaciones reusando el cap anti-inflación
 *   real de `motor-v2.1.ts` (NO el de `motor-v4.ts`, que no lo implementa).
 * - `campoConCandidatos()`: ganador + candidatos rankeados, para deny/force/allow
 *   y para hasta 2 slots de aware (con deduplicación por "mecanismo", igual
 *   criterio que ya usaba `motor-v4.ts` para evitar 2 avisos del mismo tipo).
 * - `ensamblarReporte()`: arma `ScoutingReportV1` (modo sencillo o completo)
 *   según el contrato cerrado de 14.2 bis.
 * - `frecuenciaObservada` real (no aproximada) para 7 de las 11 situaciones,
 *   leída directamente de `EnrichedInputs.*Freq` -- las otras 4
 *   (pnrRollMan/putback/offScreen/misc) no tienen campo propio y usan
 *   aproximación por score, ver `SITUACION_A_CAMPO_FRECUENCIA`.
 * - `manoDominante` real desde `EnrichedInputs.hand` (no hardcodeado).
 * - `archetypeKey`: **CERRADO 2026-09-11**, ver `motor-v1-archetype.ts` — diseño
 *   real sobre la taxonomía Synergy (grupo como restricción dura + agregación
 *   por ejes funcionales), no un crosswalk desde `motor-v4.ts`. El crosswalk
 *   provisional que había aquí antes producía `archetypeKey` fuera de grupo en
 *   3 de los 10 perfiles reales — verificado antes de reemplazarlo, no después.
 *
 * ## Lo que este archivo NO resuelve todavía — deuda explícita, no oculta
 * - Capa 3 (`PlayerRealStats`, Nivel 2/U Stats): no wireado — es Fase 2
 *   (vínculo con U Stats), no Fase 1. `capa3` queda `undefined` siempre por
 *   ahora.
 * - `confianza` en cada `DefenseOutput`: heurística provisional por score
 *   (score >= 0.7 alta, 0.4-0.7 media, <0.4 baja) — el diseño real de 13.2 la
 *   ata a consistencia Nivel 1 + volumen de muestra Nivel 2, que no existe
 *   todavía sin Capa 3. `[PENDIENTE]` revisar cuando Fase 2 aterrice.
 * - `porque` (15.5, "por qué" citando Nivel 2): vacío siempre por ahora, misma
 *   razón que Capa 3.
 * - `situacionOrigen`: mapeado desde los 12 buckets internos de v2.1 a las 11
 *   situaciones Synergy vía `SITUACION_A_SYNERGY` — el bucket `floater` no
 *   encaja limpiamente en ninguna de las 11 (es una variante de finalización
 *   que aparece tanto en ISO como en PnR en el código actual) y se mapea a
 *   `misc` como decisión conservadora, no una certeza. `[PENDIENTE]` revisar.
 * - Catálogo exacto de `OutputKey`: sigue sin cerrar (Nota 2 de 14.2 bis) —
 *   aquí se usan las keys ya existentes de `motor-v2.1.ts` sin traducir al
 *   naming nuevo todavía.
 */

import { UScoutMotor } from "./motor-v2.1";
import type {
  PlayerInputs,
  ClubContext,
  MotorOutput,
  MotorReport,
  EnrichedInputs,
  Position,
} from "./motor-v2.1";
import type {
  SituacionSynergy,
  DefenseOutput,
  OutputCandidato,
  CampoConCandidatos,
  SituacionAmenaza,
  OutputKey,
  ArchetypeKey,
  PosicionJugadora,
  ScoutingReportV1,
  ReporteModoSencilloV1,
  ReporteModoCompletoV1,
  IdentidadReporte,
} from "./motor-v1-types";
import { SOURCE_TO_SITUATION_PUBLICA } from "./motor-v1-source-map";
import { detectarArchetype, senalesDesdeEnriched } from "./motor-v1-archetype";

const motor = new UScoutMotor();

// ---------------------------------------------------------------------------------
// Crosswalk: 12 buckets internos de v2.1 -> 11 situaciones Synergy (spec 12.1)
// ---------------------------------------------------------------------------------

const SITUACION_A_SYNERGY: Record<string, SituacionSynergy> = {
  iso: "iso",
  pnr: "pnrHandler",
  screener: "pnrRollMan",
  post: "post",
  transition: "transition",
  spot: "spotUp",
  dho: "handoff",
  cut: "cut",
  oreb: "putback",
  offball: "offScreen",
  // 'floater' no es una de las 11 categorías Synergy -- aparece tanto en ISO
  // como en PnR en el código actual (EditorIsoHandFinish y pnr_floater_unified).
  // Decisión conservadora: misc, hasta que se decida un mapeo mejor.
  floater: "misc",
  misc: "misc",
};

function mapearSituacion(v21Bucket: string): SituacionSynergy {
  return SITUACION_A_SYNERGY[v21Bucket] ?? "misc";
}

function mapearPosicion(pos: Position): PosicionJugadora {
  if (pos === "PG" || pos === "SG") return "base";
  if (pos === "SF") return "alero";
  return "interior"; // PF | C -- mismo criterio que 10.2 bis (función, no posición nominal)
}

/**
 * BUG REAL QUE HUBO AQUÍ (encontrado y corregido en la misma sesión, 2026-09-11):
 * la primera versión de este archivo tenía una función `clamp072()` que forzaba
 * TODO score a un techo de 0.72 -- incluidas las situaciones PRIMARIAS, que
 * deben quedar SIN capar (verificado con datos reales: perfil "Luka Doncic",
 * iso=1.000 y pnr=1.000 sin capar, post=0.720 exactamente capado por ser
 * no-primaria). El cap anti-inflación de motor-v2.1.ts (sección 3 de la spec)
 * NO es un techo global de 0.72 -- es un techo que solo aplica a situaciones
 * NO primarias cuando hay 2+ primarias, y ya viene correctamente calculado en
 * `report.threatScores`/`rawOutputs`. No hace falta (ni es correcto) volver a
 * clampar aquí -- el valor de v2.1 ya es el definitivo, se usa tal cual (sin
 * wrapper: `score: o.weight` directamente). Se deja este comentario en vez de
 * borrar el rastro, para que quien retome esto no repita el mismo error de
 * lectura del contrato.
 */

function brandOutputKey(key: string): OutputKey {
  return key as OutputKey;
}

function confianzaProvisional(score: number): "alta" | "media" | "baja" {
  if (score >= 0.7) return "alta";
  if (score >= 0.4) return "media";
  return "baja";
}

function aDefenseOutput(o: MotorOutput): DefenseOutput {
  const situacion = mapearSituacion(V21_SOURCE_A_BUCKET(o.source));
  return {
    key: brandOutputKey(o.key),
    categoria: o.category,
    situacionOrigen: situacion,
    score: o.weight,
    confianza: confianzaProvisional(o.weight),
    // porque: sin Nivel 2 wireado todavía -- deuda explícita, ver cabecera.
  };
}

// motor-v2.1.ts no exporta SOURCE_TO_SITUATION (es privado al módulo), así que
// no podemos reusarlo directamente. Reconstruimos SOLO el paso source->bucket
// necesario aquí a partir de una copia pública de la misma tabla (ver
// motor-v1-source-map.ts para la justificación de duplicarla).
function V21_SOURCE_A_BUCKET(source: string): string {
  return SOURCE_TO_SITUATION_PUBLICA[source] ?? "misc";
}

// ---------------------------------------------------------------------------------
// Situaciones (capa 1) -- usa el cap anti-inflación REAL de v2.1 (threatScores),
// no el de motor-v4.ts (que no lo implementa -- bug documentado en spec sección 3).
// ---------------------------------------------------------------------------------

/**
 * 7 de las 11 situaciones Synergy tienen un campo *Freq directo en
 * EnrichedInputs (verificado, motor-v2.1.ts:161-167) -- ahí se usa la
 * frecuencia REAL marcada por el staff, no una aproximación. Las otras 4
 * (pnrRollMan/screener, putback/oreb, offScreen/offball, misc) no tienen un
 * campo de frecuencia propio en el input actual -- se quedan con la
 * aproximación por score hasta que exista un campo real que leer.
 */
const SITUACION_A_CAMPO_FRECUENCIA: Partial<Record<SituacionSynergy, string>> = {
  iso: "isoFreq",
  pnrHandler: "pnrFreq",
  post: "postFreq",
  transition: "transFreq",
  spotUp: "spotUpFreq",
  handoff: "dhoFreq",
  cut: "cutFreq",
};

export function situacionesAmenaza(report: MotorReport): SituacionAmenaza[] {
  const enriched = report.inputs as EnrichedInputs;
  return (report.threatScores ?? [])
    .map((t): SituacionAmenaza => {
      const situacion = mapearSituacion(t.situation);
      const campoFreq = SITUACION_A_CAMPO_FRECUENCIA[situacion];
      const freqReal = campoFreq ? ((enriched as any)[campoFreq] as string | null) : null;

      let frecuenciaObservada: SituacionAmenaza["frecuenciaObservada"];
      if (freqReal === "P" || freqReal === "S" || freqReal === "R" || freqReal === "N") {
        frecuenciaObservada = freqReal;
      } else {
        // Sin campo directo (pnrRollMan/putback/offScreen/misc) o valor nulo:
        // aproximación por score -- deuda explícita, ver comentario del mapa
        // de arriba.
        frecuenciaObservada = t.score >= 0.85 ? "P" : t.score >= 0.5 ? "S" : "R";
      }

      return { situacion, score: t.score, frecuenciaObservada };
    })
    .sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------------------------
// CampoConCandidatos -- deny/force/allow (winner+alternatives ya existe en
// motor-v4.ts con la forma correcta; se reimplementa aquí sin depender de v4
// para no heredar su buildSituations roto en el mismo import).
// ---------------------------------------------------------------------------------

function campoDesdeRawOutputs(
  rawOutputs: MotorOutput[],
  categoria: "deny" | "force" | "allow" | "aware",
): CampoConCandidatos | undefined {
  const sorted = rawOutputs
    .filter((o) => o.category === categoria && o.weight > 0)
    .sort((a, b) => b.weight - a.weight);
  if (sorted.length === 0) return undefined;

  const candidatos: OutputCandidato[] = sorted.map((o, i) => ({
    output: aDefenseOutput(o),
    score: o.weight,
    rank: i,
  }));

  return { ganador: candidatos[0].output, candidatos };
}

/** Hasta 2 slots de aware, deduplicados por "mecanismo" (mismo criterio de
 *  motor-v4.ts buildAlerts) para no repetir dos avisos del mismo tipo. */
function slotsAware(rawOutputs: MotorOutput[]): CampoConCandidatos[] {
  const mecanismo = (key: string): string => {
    if (/stepback|pull_up|pullup/.test(key)) return "shooting_off_dribble";
    if (/post|duck_in/.test(key)) return "post_action";
    if (/trans|transition|leak/.test(key)) return "transition";
    if (/oreb|putback/.test(key)) return "offensive_rebound";
    if (/connector|passer|vision/.test(key)) return "playmaking";
    if (/screen|slip/.test(key)) return "screen_action";
    if (/pressure|trap|blitz/.test(key)) return "pressure_defense";
    if (/clutch|freeze/.test(key)) return "clutch";
    if (/contact|foul/.test(key)) return "contact";
    return "general";
  };

  const aware = rawOutputs
    .filter((o) => o.category === "aware" && o.weight > 0)
    .sort((a, b) => b.weight - a.weight);

  const porMecanismo = new Map<string, MotorOutput[]>();
  for (const o of aware) {
    const m = mecanismo(o.key);
    if (!porMecanismo.has(m)) porMecanismo.set(m, []);
    porMecanismo.get(m)!.push(o);
  }

  const grupos = Array.from(porMecanismo.values())
    .sort((a, b) => b[0].weight - a[0].weight)
    .slice(0, 2); // máximo 2 AWARE (spec 13.3/7, tupla acotada en 14.2 bis)

  return grupos.map((grupo) => {
    const candidatos: OutputCandidato[] = grupo.map((o, i) => ({
      output: aDefenseOutput(o),
      score: o.weight,
      rank: i,
    }));
    return { ganador: candidatos[0].output, candidatos };
  });
}

// ---------------------------------------------------------------------------------
// archetypeKey -- CERRADO 2026-09-11: diseño real sobre la taxonomía Synergy,
// delegado en El Arquitecto y verificado contra los 10 perfiles reales antes
// de implementarlo (ver motor-v1-archetype.ts para el algoritmo completo y
// spec 21.4 punto 1 para el razonamiento). Sustituye al crosswalk provisional
// que tenía esta sección -- ya no depende de leer ningún archetype legacy de
// motor-v4.ts, que es exactamente la deuda que quedaba abierta.
// ---------------------------------------------------------------------------------

// ---------------------------------------------------------------------------------
// Ensamblado del reporte (spec 13.3, 14.2 bis)
// ---------------------------------------------------------------------------------

export interface EnsamblarReporteOpts {
  jugadoraId: string;
  modo: "sencillo" | "completo";
  wcbaExternalId?: string;
  emparejamientoDefensivo?: string;
}

export function ensamblarReporte(
  inputs: PlayerInputs,
  clubContext: ClubContext | undefined,
  opts: EnsamblarReporteOpts,
): ScoutingReportV1 {
  const report = motor.generateReport(inputs, clubContext);
  const rawOutputs = report.rawOutputs ?? [];
  const enriched = report.inputs as EnrichedInputs;

  const posicion = mapearPosicion((enriched as any).pos as Position);
  // Se calcula aquí (antes del branching de modo) porque detectarArchetype()
  // también la necesita -- se reusa la misma lista en capa1 más abajo, nunca
  // se recalcula dos veces.
  const situaciones = situacionesAmenaza(report);
  const archetypeKey = detectarArchetype(
    situaciones,
    posicion,
    senalesDesdeEnriched(enriched),
  ).key;

  const identidad: IdentidadReporte = {
    nombre: (enriched as any).name ?? "",
    posicion,
    alturaCm: (enriched as any).heightCm ?? 0,
    pesoKg: (enriched as any).weightKg ?? 0,
    // Corregido: v2.1 no tiene 'postDominantHand' (ese es un campo de
    // mock-data.ts, no del motor) -- el dato real es EnrichedInputs.hand
    // ('R'|'L', verificado motor-v2.1.ts:155). No hay valor 'Ambidiestra' en
    // el input real hoy -- se deja como posibilidad del tipo, no del dato.
    manoDominante: (enriched as any).hand === "L" ? "I" : "D",
    numero: (enriched as any).number ?? "",
    fotoUrl: (enriched as any).imageUrl,
    esEstrella: (enriched as any).starPlayer ?? undefined,
    archetypeKey,
    statsDestacados: [], // Capa 3 / Nivel 2 no wireado todavía (Fase 2)
    quietEdge: undefined, // idem
  };

  const deny = campoDesdeRawOutputs(rawOutputs, "deny");
  const force = campoDesdeRawOutputs(rawOutputs, "force");
  const allow = campoDesdeRawOutputs(rawOutputs, "allow");
  const awareSlots = slotsAware(rawOutputs);

  if (!deny) {
    throw new Error(
      `ensamblarReporte: no se pudo calcular 'deny' para jugadoraId=${opts.jugadoraId} -- el motor no generó ningún output deny con weight > 0.`,
    );
  }

  if (opts.modo === "sencillo") {
    const reporte: ReporteModoSencilloV1 = {
      version: "1.0",
      jugadoraId: opts.jugadoraId,
      wcbaExternalId: opts.wcbaExternalId,
      identidad,
      emparejamientoDefensivo: opts.emparejamientoDefensivo,
      modo: "sencillo",
      accionPrincipal: deny,
    };
    return reporte;
  }

  const reporte: ReporteModoCompletoV1 = {
    version: "1.0",
    jugadoraId: opts.jugadoraId,
    wcbaExternalId: opts.wcbaExternalId,
    identidad,
    emparejamientoDefensivo: opts.emparejamientoDefensivo,
    modo: "completo",
    capa1: {
      situaciones,
      emparejamientoDefensivo: opts.emparejamientoDefensivo,
    },
    capa2: {
      deny,
      // CORREGIDO 2026-09-11: la primera versión forzaba un fallback a `deny`
      // cuando force/allow faltaban, asumiendo (mal) que era un caso raro.
      // Verificado contra los 10 perfiles reales: force falta en 4/10, allow
      // en 2/10 -- no es un caso raro, es una fracción real. `force`/`allow`
      // son opcionales en el contrato (motor-v1-types.ts) precisamente por
      // esto -- se omiten aquí cuando el motor no generó ningún output real,
      // nunca se sustituyen por otro campo.
      ...(force ? { force } : {}),
      ...(allow ? { allow } : {}),
      aware:
        awareSlots.length === 0
          ? []
          : awareSlots.length === 1
            ? [awareSlots[0]]
            : [awareSlots[0], awareSlots[1]],
    },
    capa3: undefined, // Fase 2
  };
  return reporte;
}
