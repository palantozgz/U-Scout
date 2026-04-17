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

/** Auto-inferred gender and level when a leagueType is selected and the field is currently null */
export const LEAGUE_AUTO_INFER: Partial<
  Record<ClubLeagueType, { gender?: ClubGender; level?: ClubLevel }>
> = {
  nba: { gender: "M", level: "elite" },
  euroleague_m: { gender: "M", level: "elite" },
  euroleague_f: { gender: "F", level: "elite" },
  acb: { gender: "M", level: "elite" },
  cba: { gender: "M", level: "elite" },
  wcba: { gender: "F", level: "elite" },
  ncaa_m: { gender: "M", level: "competitive" },
  ncaa_f: { gender: "F", level: "competitive" },
  cuba_m: { gender: "M", level: "competitive" },
  cuba_f: { gender: "F", level: "competitive" },
  fiba_americas: { level: "competitive" },
  amateur: { level: "developmental" },
};

const tuple1 = <T extends readonly string[]>(arr: T) =>
  arr as unknown as [T[number], ...T[number][]];

export const zClubLeagueType = z.enum(tuple1(CLUB_LEAGUE_TYPES));
export const zClubGender = z.enum(tuple1(CLUB_GENDERS));
export const zClubLevel = z.enum(tuple1(CLUB_LEVELS));
export const zClubAgeCategory = z.enum(tuple1(CLUB_AGE_CATEGORIES));

/** PATCH /api/club body (all optional; null clears context fields). */
export const patchClubBodySchema = z.object({
  name: z.string().min(1).optional(),
  logo: z.string().min(1).max(8).optional(),
  leagueType: z.union([zClubLeagueType, z.null()]).optional(),
  gender: z.union([zClubGender, z.null()]).optional(),
  level: z.union([zClubLevel, z.null()]).optional(),
  ageCategory: z.union([zClubAgeCategory, z.null()]).optional(),
});
