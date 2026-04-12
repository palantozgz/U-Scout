import { z } from "zod";

/** Allowed values for `clubs.league_type` (motor v3 / ClubContext). */
export const CLUB_LEAGUE_TYPES = [
  "nba",
  "euroleague_m",
  "euroleague_f",
  "acb",
  "cba",
  "wcba",
  "ncaa_m",
  "ncaa_f",
  "cuba_m",
  "cuba_f",
  "fiba_americas",
  "amateur",
] as const;
export type ClubLeagueType = (typeof CLUB_LEAGUE_TYPES)[number];

export const CLUB_GENDERS = ["M", "F", "mixed"] as const;
export type ClubGender = (typeof CLUB_GENDERS)[number];

export const CLUB_LEVELS = ["elite", "competitive", "developmental"] as const;
export type ClubLevel = (typeof CLUB_LEVELS)[number];

export const CLUB_AGE_CATEGORIES = ["senior", "U23", "U18", "U16"] as const;
export type ClubAgeCategory = (typeof CLUB_AGE_CATEGORIES)[number];

/** Preset club context when a known league is selected (motor v3). */
export const LEAGUE_AUTO_INFER: Record<
  ClubLeagueType,
  { gender: ClubGender; level: ClubLevel; ageCategory: ClubAgeCategory }
> = {
  nba: { gender: "M", level: "elite", ageCategory: "senior" },
  euroleague_m: { gender: "M", level: "elite", ageCategory: "senior" },
  euroleague_f: { gender: "F", level: "elite", ageCategory: "senior" },
  acb: { gender: "M", level: "elite", ageCategory: "senior" },
  cba: { gender: "M", level: "elite", ageCategory: "senior" },
  wcba: { gender: "F", level: "elite", ageCategory: "senior" },
  ncaa_m: { gender: "M", level: "competitive", ageCategory: "senior" },
  ncaa_f: { gender: "F", level: "competitive", ageCategory: "senior" },
  cuba_m: { gender: "M", level: "competitive", ageCategory: "U18" },
  cuba_f: { gender: "F", level: "competitive", ageCategory: "U18" },
  fiba_americas: { gender: "mixed", level: "competitive", ageCategory: "senior" },
  amateur: { gender: "mixed", level: "developmental", ageCategory: "senior" },
};

const CLUB_LOGO_MAX_LEN = 520_000;

function isValidClubLogoString(s: string): boolean {
  if (s.length > CLUB_LOGO_MAX_LEN) return false;
  if (/^https:\/\//i.test(s)) return s.length <= 2048;
  if (s.startsWith("data:image/")) {
    return /^data:image\/(png|jpeg|jpg|webp);base64,/i.test(s);
  }
  return s.length <= 64;
}

const zClubLogo = z.string().min(1).max(CLUB_LOGO_MAX_LEN).refine(isValidClubLogoString, {
  message: "Invalid club logo (emoji, https URL, or small base64 image)",
});

const tuple1 = <T extends readonly string[]>(arr: T) =>
  arr as unknown as [T[number], ...T[number][]];

export const zClubLeagueType = z.enum(tuple1(CLUB_LEAGUE_TYPES));
export const zClubGender = z.enum(tuple1(CLUB_GENDERS));
export const zClubLevel = z.enum(tuple1(CLUB_LEVELS));
export const zClubAgeCategory = z.enum(tuple1(CLUB_AGE_CATEGORIES));

/** PATCH /api/club body (all optional; null clears context fields). */
export const patchClubBodySchema = z.object({
  name: z.string().min(1).optional(),
  logo: zClubLogo.optional(),
  leagueType: z.union([zClubLeagueType, z.null()]).optional(),
  gender: z.union([zClubGender, z.null()]).optional(),
  level: z.union([zClubLevel, z.null()]).optional(),
  ageCategory: z.union([zClubAgeCategory, z.null()]).optional(),
});
