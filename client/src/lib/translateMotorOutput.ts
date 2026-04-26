// TODO: Audit — possibly superseded by reportTextRenderer.ts
import type { Locale } from "@/lib/i18n";
import type { ClubGender } from "@shared/club-context";
import { candidateSpanishKeysForGender } from "@/lib/spanishClubGenderI18n";

export type TranslateFn = (key: string) => string;

/** Same as legacy `translateOutput` in Profile, with optional club-aware keys for Spanish. */
export function translateMotorOutputLine(
  item: string,
  tFn: TranslateFn,
  options?: { locale?: Locale; clubGender?: ClubGender | null },
): string {
  if (!item) return item;
  const locale = options?.locale ?? "en";
  const clubGender = options?.clubGender;

  const tryTranslate = (rawKey: string): string => {
    const keys =
      locale === "es" ? candidateSpanishKeysForGender(rawKey, clubGender) : [rawKey];
    for (const k of keys) {
      const s = tFn(k);
      if (s !== k) return s;
    }
    return tFn(rawKey);
  };

  if (item.includes("|")) {
    const [rawKey, ...paramParts] = item.split("|");
    const params: Record<string, string> = {};
    paramParts.forEach((p) => {
      const [k, v] = p.split("=");
      if (k && v !== undefined) params[k] = v;
    });
    let s = tryTranslate(rawKey);
    if (s === rawKey && tFn(rawKey) === rawKey) return item;
    Object.entries(params).forEach(([k, v]) => {
      const translatedParam = tFn(v as never);
      const replacement = translatedParam === v ? v : translatedParam;
      s = s.replace(new RegExp(`\\{${k}\\}`, "g"), replacement);
    });
    return s;
  }
  const translated = tryTranslate(item);
  return translated === item ? item : translated;
}
