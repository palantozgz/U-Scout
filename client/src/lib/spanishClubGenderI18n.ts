import type { ClubGender } from "@shared/club-context";
import type { Locale } from "@/lib/i18n";

/**
 * Pick i18n key suffixes for Spanish: masculine / feminine / neutral overrides
 * stored as `baseKey__es_m`, `baseKey__es_f`, `baseKey__es_n` in locale bundles.
 */
export function candidateSpanishKeysForGender(baseKey: string, gender: ClubGender | null | undefined): string[] {
  const g = gender ?? null;
  if (g === "M") return [`${baseKey}__es_m`, `${baseKey}__es_n`, baseKey];
  if (g === "F") return [`${baseKey}__es_f`, `${baseKey}__es_n`, baseKey];
  return [`${baseKey}__es_n`, baseKey];
}

export function pickExistingKey(
  baseKey: string,
  locale: Locale,
  gender: ClubGender | null | undefined,
  hasKey: (k: string) => boolean,
): string {
  if (locale !== "es") return baseKey;
  for (const k of candidateSpanishKeysForGender(baseKey, gender)) {
    if (hasKey(k)) return k;
  }
  return baseKey;
}
