import type { RenderedReport } from "./reportTextRenderer";

export interface ReportOverride {
  id?: string;
  playerId: string;
  coachId: string;
  slide: string;
  itemKey: string;
  action: "hide" | "replace" | "approve_as_is";
  replacementValue?: string;
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
  count: number;
  confidence: number;
}

export function applyOverrides(
  report: RenderedReport,
  overrides: ReportOverride[],
): RenderedReport {
  const result: RenderedReport = JSON.parse(JSON.stringify(report));

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

    if (slide === "situations") {
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
      const [type, field] = itemKey.split(".") as [
        "deny" | "force" | "allow",
        string,
      ];
      if (type && field && result.defense[type]) {
        if (action === "hide") {
          const alt = result.defense[type].alternatives[0];
          if (alt) {
            result.defense[type].instruction = alt.instruction;
            result.defense[type].alternatives =
              result.defense[type].alternatives.slice(1);
          }
        }
        if (action === "replace" && replacementValue) {
          result.defense[type].instruction = replacementValue;
        }
      }
    }

    if (slide === "alerts") {
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
    const key = `${o.archetypeKey}::${o.itemKey}::${o.replacementValue}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(o);
  }

  const patterns: DetectedPattern[] = [];

  for (const [key, overrides] of Array.from(groups.entries())) {
    const distinctPlayers = new Set(
      overrides.map((o: ReportOverride) => o.playerId),
    );
    if (distinctPlayers.size < threshold) continue;

    const [archetypeKey, fieldKey, preferredValue] = key.split("::");
    patterns.push({
      fieldKey,
      archetypeKey,
      preferredValue,
      count: distinctPlayers.size,
      confidence: Math.min(distinctPlayers.size / threshold, 1.0),
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
    originalScore: params.originalScore,
    replacementScore: params.replacementScore,
    archetypeKey: params.archetypeKey,
    locale: params.locale,
  };
}
