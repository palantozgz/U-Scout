import type { RenderedInstruction } from "./reportTextRenderer";
import type { RenderedReportV1 } from "./reportTextRendererV1";

export interface ReportOverride {
  id?: string;
  playerId: string;
  coachId: string;
  slide: string;
  itemKey: string;
  action: "hide" | "replace" | "approve_as_is";
  replacementValue?: string;
  /** AÑADIDO 2026-09-14 (Nivel B/decantador, spec 38/39): el `OutputKey` real
   *  de la alternativa elegida (p.ej. "force_weak_hand"), no su texto
   *  renderizado. `replacementValue` es locale-dependiente y, en campos
   *  direccionales, también depende de la jugadora (spec 23.1) -- agrupar
   *  patrones de calibración por texto nunca detectaría el mismo patrón de
   *  fondo entre dos jugadoras con dirección distinta. Opcional: ausente en
   *  overrides guardados antes de este cambio (fallback a `replacementValue`
   *  en el agrupamiento, ver `detectPatterns`). */
  replacementKey?: string;
  originalScore?: number;
  replacementScore?: number;
  archetypeKey?: string;
  locale?: string;
  approvedAt?: string;
  createdAt?: string;
}

export interface ReportApprovalState {
  playerId: string;
  coachId: string;
  approvedAt: string | null;
  overrides: ReportOverride[];
}

export interface ReportDiscrepancy {
  itemKey: string;
  slide: string;
  coachA: { coachId: string; value: string };
  coachB: { coachId: string; value: string };
}

export interface DetectedPattern {
  fieldKey: string;
  archetypeKey: string;
  preferredValue: string;
  /** Entrenadores distintos que coinciden en este patrón -- la señal real
   *  de consenso (Nivel B/decantador, spec 38/39). */
  count: number;
  confidence: number;
  /** Jugadoras distintas donde se observó el patrón -- dato secundario,
   *  nunca el número principal (corregido 2026-09-14, hallazgo C.0 de El
   *  Arquitecto: antes `count` medía jugadoras, no entrenadores -- un solo
   *  entrenador repitiendo la misma sustitución en 3 jugadoras del mismo
   *  arquetipo "promocionaba" un patrón que en realidad era su preferencia
   *  personal, justo el riesgo que Nivel B existe para no ser). */
  distinctPlayers: number;
}

/**
 * Aplica overrides sobre `RenderedReportV1` (spec 23, PR-B) -- adaptado a la
 * unión discriminada real de `ScoutingReportV1` (modo sencillo no tiene
 * `situations`/`alerts`, y su
 * único campo tocable es `accionPrincipal`, equivalente al `deny` de modo
 * completo -- mismo `itemKey` de convención, "deny.instruction").
 * `detectDiscrepancies`/`detectPatterns`/`buildOverrideRecord` NO cambian --
 * son agnósticas al motor, solo operan sobre `ReportOverride[]` (spec 23.2,
 * verificado por El Arquitecto).
 */
export function applyOverridesV1(
  report: RenderedReportV1,
  overrides: ReportOverride[],
): RenderedReportV1 {
  const result: RenderedReportV1 = JSON.parse(JSON.stringify(report));

  const campoDefensa = (type: "deny" | "force" | "allow"): RenderedInstruction | undefined => {
    if (result.modo === "sencillo") return type === "deny" ? result.accionPrincipal : undefined;
    return result.defense[type];
  };

  for (const override of overrides) {
    if (override.action === "approve_as_is") continue;

    const { slide, itemKey, action, replacementValue } = override;

    if (slide === "identity") {
      if (itemKey === "archetype" && action === "replace" && replacementValue) {
        result.identity.archetypeLabel = replacementValue;
      }
      if (itemKey === "tagline" && action === "replace" && replacementValue) {
        result.identity.tagline = replacementValue;
      }
    }

    if (slide === "situations" && result.modo === "completo") {
      const idx = parseInt(itemKey.split(".")[1] ?? "-1", 10);
      if (idx >= 0 && idx < result.situations.length) {
        if (action === "hide") {
          result.situations.splice(idx, 1);
        }
        if (action === "replace" && replacementValue) {
          result.situations[idx].description = replacementValue;
        }
      }
    }

    if (slide === "defense") {
      const [type, field] = itemKey.split(".") as ["deny" | "force" | "allow", string];
      const campo = type && field ? campoDefensa(type) : undefined;
      if (campo) {
        if (action === "hide") {
          const alt = campo.alternatives[0];
          if (alt) {
            campo.instruction = alt.instruction;
            campo.alternatives = campo.alternatives.slice(1);
          }
        }
        if (action === "replace" && replacementValue) {
          campo.instruction = replacementValue;
        }
      }
    }

    if (slide === "alerts" && result.modo === "completo") {
      const idx = parseInt(itemKey.split(".")[1] ?? "-1", 10);
      if (idx >= 0 && idx < result.alerts.length) {
        if (action === "hide") {
          result.alerts.splice(idx, 1);
        }
        if (action === "replace" && replacementValue) {
          result.alerts[idx].text = replacementValue;
        }
      }
    }
  }

  return result;
}

export function detectDiscrepancies(
  overridesA: ReportOverride[],
  overridesB: ReportOverride[],
): ReportDiscrepancy[] {
  const discrepancies: ReportDiscrepancy[] = [];
  const mapB = new Map(overridesB.map((o) => [`${o.slide}.${o.itemKey}`, o]));

  for (const overrideA of overridesA) {
    const key = `${overrideA.slide}.${overrideA.itemKey}`;
    const overrideB = mapB.get(key);
    if (!overrideB) continue;

    const valueA = overrideA.replacementValue ?? overrideA.action;
    const valueB = overrideB.replacementValue ?? overrideB.action;

    if (valueA !== valueB) {
      discrepancies.push({
        itemKey: overrideA.itemKey,
        slide: overrideA.slide,
        coachA: { coachId: overrideA.coachId, value: valueA },
        coachB: { coachId: overrideB.coachId, value: valueB },
      });
    }
  }

  return discrepancies;
}

export function detectPatterns(
  allOverrides: ReportOverride[],
  threshold = 3,
): DetectedPattern[] {
  const groups = new Map<string, ReportOverride[]>();

  for (const o of allOverrides) {
    if (o.action !== "replace" || !o.replacementValue || !o.archetypeKey) continue;
    // AÑADIDO 2026-09-14 (Nivel B/decantador, spec 38/39): agrupa por
    // `replacementKey` (OutputKey real, estable entre idiomas/jugadoras)
    // cuando existe; cae a `replacementValue` (texto renderizado) como
    // fallback para overrides guardados antes de que ese campo existiera --
    // agrupa peor, pero no descarta datos históricos.
    const key = `${o.archetypeKey}::${o.itemKey}::${o.replacementKey ?? o.replacementValue}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(o);
  }

  const patterns: DetectedPattern[] = [];

  for (const [key, overrides] of Array.from(groups.entries())) {
    // CORREGIDO 2026-09-14 (hallazgo C.0 de El Arquitecto): contaba
    // jugadoras distintas, no entrenadores distintos -- un solo entrenador
    // repitiendo la misma sustitución en 3 jugadoras ya "promocionaba" un
    // patrón, justo el riesgo de convergencia estrecha que Nivel B existe
    // para evitar (esa es la protección de Nivel A, individual). La señal
    // real de Nivel B es consenso ENTRE entrenadores distintos.
    const distinctCoaches = new Set(
      overrides.map((o: ReportOverride) => o.coachId),
    );
    if (distinctCoaches.size < threshold) continue;

    const distinctPlayers = new Set(
      overrides.map((o: ReportOverride) => o.playerId),
    );

    const [archetypeKey, fieldKey, preferredValue] = key.split("::");
    patterns.push({
      fieldKey,
      archetypeKey,
      preferredValue,
      count: distinctCoaches.size,
      confidence: Math.min(distinctCoaches.size / threshold, 1.0),
      distinctPlayers: distinctPlayers.size,
    });
  }

  return patterns.sort((a, b) => b.count - a.count);
}

export function buildOverrideRecord(params: {
  playerId: string;
  coachId: string;
  slide: string;
  itemKey: string;
  action: "hide" | "replace" | "approve_as_is";
  replacementValue?: string;
  replacementKey?: string;
  originalScore?: number;
  replacementScore?: number;
  archetypeKey?: string;
  locale?: string;
}): Omit<ReportOverride, "id" | "createdAt" | "approvedAt"> {
  return {
    playerId: params.playerId,
    coachId: params.coachId,
    slide: params.slide,
    itemKey: params.itemKey,
    action: params.action,
    replacementValue: params.replacementValue,
    replacementKey: params.replacementKey,
    originalScore: params.originalScore,
    replacementScore: params.replacementScore,
    archetypeKey: params.archetypeKey,
    locale: params.locale,
  };
}
