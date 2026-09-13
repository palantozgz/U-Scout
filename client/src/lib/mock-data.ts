import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, enqueueOfflinePlayerMutation } from "./queryClient";
import { useAuth } from "@/lib/useAuth";
import {
  type ClubContext,
  type PlayerInputs,
  type PostMove as MotorPostMoveId,
  type HighPostZonesMotor,
  type HighPostAction,
  type TransRoleEditor,
  type SpotZones,
} from "./motor-v2.1";

export type { ClubContext, HighPostAction, HighPostZonesMotor, TransRoleEditor };

/** Build motor club context from API club row when any field is set. */
export function clubRowToMotorContext(club: {
  leagueType?: string | null;
  gender?: string | null;
  level?: string | null;
  ageCategory?: string | null;
} | null | undefined): ClubContext | undefined {
  if (!club) return undefined;
  const out: ClubContext = {};
  if (club.leagueType) out.leagueType = club.leagueType as ClubContext["leagueType"];
  if (club.gender) out.gender = club.gender as ClubContext["gender"];
  if (club.level) out.level = club.level as ClubContext["level"];
  if (club.ageCategory) out.ageCategory = club.ageCategory as ClubContext["ageCategory"];
  return Object.keys(out).length > 0 ? out : undefined;
}

export const TRANS_ROLE_SUB_OPTIONS = {
  rim_runner: ["seal_catch", "regular_rim_run", "finish_contact", "only_unguarded"],
  trail: ["shoot_off_trail", "cut", "inversions_sets", "early_drag", "multiple"],
  runner: ["corner_3", "cut_to_rim", "both"],
  pusher: ["dribble_push", "pass_and_go", "both", "after_def_rebound"],
} as const;

// ─── Base types ───────────────────────────────────────────────────────────────
export type IntensityLevel = "Primary" | "Secondary" | "Rare" | "Never";
export type DirectionTendency = "Left" | "Right" | "Balanced";
export type PhysicalLevel = 0 | 1 | 2 | 3 | 4 | 5;
export type CloseoutReaction =
  | "Catch & Shoot" | "Attack Baseline" | "Attack Middle"
  | "Attacks Strong Hand" | "Attacks Weak Hand" | "Extra Pass";
export type IsoInitiation = "Controlled" | "Quick Attack";
export type IsoDecision = "Finish" | "Shoot" | "Pass";
export type PnrFinish = "Drive to Rim" | "Pull-up" | "Floater" | "Mid-range";

// ─── Interior types ───────────────────────────────────────────────────────────
export interface PostMove { name: string; direction?: "Baseline" | "Middle" | "Both" | "Right" | "Left"; }
export interface QuadrantMove { moveName: string; }
export interface PostQuadrants {
  rightBaseline?: QuadrantMove;
  rightMiddle?: QuadrantMove;
  leftBaseline?: QuadrantMove;
  leftMiddle?: QuadrantMove;
}
export type PostProfile = "Back to Basket" | "Face-Up" | "Mixed" | "High Post" | "arch_stretch_big";
export type DoubleTeamReaction = "Forces Through" | "Kicks Out" | "Resets" | "Mixed";
export type InteriorIsoAction = "Back Down" | "Face-Up Drive" | "Post Jumper" | "Turnaround" | "Spin" | "Mixed";
export type ScreenerAction = "Roll" | "Pop" | "Pop (Elbow / Mid)" | "Short Roll" | "Slip" | "Lob Only";

// ─── Functional profile (auto-detected) ──────────────────────────────────────
export interface FunctionalProfile {
  isInteriorScorer: boolean;
  isPerimeterCreator: boolean;
  isPnRHandler: boolean;
  isPnRScreener: boolean;
  isPlaymaker: boolean;
  isSpotUpShooter: boolean;
  isMovementShooter: boolean;
  isCutter: boolean;
  isConnector: boolean;
  isStretchBig: boolean;
}

// ─── Player Input ─────────────────────────────────────────────────────────────
export interface PlayerInput {
  position: string; height: string; weight: string; minutesPerGame: number;
  athleticism: PhysicalLevel;
  physicalStrength: PhysicalLevel;
  ftShooting?: PhysicalLevel;
  foulDrawing?: PhysicalLevel;
  personality?: ("clutch" | "leader" | "selfish" | "freezes")[] | null;
  starPlayer?: boolean | null;
  /**
   * Recent form indicator — scout-observed last 3-5 games.
   * hot: clearly above baseline output
   * cold: clearly below baseline output
   * stable: consistent with scouted profile
   * null / undefined: not observed / not applicable
   */
  recentForm?: "hot" | "cold" | "stable" | null;

  // Post
  postFrequency: IntensityLevel;
  postProfile?: PostProfile;
  postPreferredBlock: "Left Block" | "Right Block" | "Any";
  postDominantHand?: "Right" | "Left";
  postQuadrants?: PostQuadrants;
  postMoves?: PostMove[];
  postDoubleTeamReaction?: DoubleTeamReaction;
  postIsoAction?: InteriorIsoAction;
  postPlayType?: "Back to Basket" | "Face-Up" | "Mixed";

  // ISO
  isoFrequency: IntensityLevel;
  isoStartZone?: "left_wing" | "right_wing" | "top" | "either" | null;
  isoDominantDirection: DirectionTendency;
  isoInitiation?: IsoInitiation;
  isoDecision?: IsoDecision;
  isoOppositeFinish?: "Drive" | "Pull-up" | "Floater" | "Pass";
  closeoutReaction: CloseoutReaction;
  closeoutLeft?: CloseoutReaction;
  closeoutRight?: CloseoutReaction;
  isoPostMove?: "Drive" | "Pull-up" | "Floater";

  // PnR
  pnrFrequency: IntensityLevel;
  pnrRole: "Handler" | "Screener" | "Both";
  pnrRoleSecondary?: "Handler" | "Screener" | "Balanced" | "None";
  pnrScoringPriority: "Score First" | "Pass First" | "Balanced";
  pnrScreenTiming?: "holds_long" | "quick_release" | "ghost_touch" | "slip" | null;
  pnrScreenerAction: ScreenerAction;
  pnrScreenerActionSecondary?: ScreenerAction;
  pnrReactionVsUnder: "Pull-up 3" | "Re-screen" | "Reject / Attack" | "Mixed" | null;
  pnrTiming: "Early (Drag)" | "Deep (Half-court)";
  pnrDirection: DirectionTendency;
  pnrDominantFinish?: PnrFinish;
  pnrOppositeFinish?: PnrFinish;

  // Off-ball
  transitionFrequency: IntensityLevel;
  transitionRole: "Pusher" | "Outlet" | "Rim Runner" | "Trailer";
  indirectsFrequency: IntensityLevel;
  slipFrequency?: IntensityLevel;
  /** @deprecated Prefer motorPostEntry = duck_in; kept for older saved players. */
  duckInFrequency?: IntensityLevel;
  backdoorFrequency: IntensityLevel;
  freeCutsFrequency?: "Primary" | "Secondary" | "Rare" | "Never" | null;
  freeCutsType?: "basket" | "flash" | "both" | null;
  offensiveReboundFrequency: IntensityLevel;
  putbackQuality?: "primary" | "capable" | "palms_only" | "not_observed" | null;

  courtVision?: PhysicalLevel;

  /**
   * True si el jugador tiene rango demostrado más allá del arco estándar (~7.5m+).
   * Distinto de spotUpFreq (triples normales). Requiere confirmación explícita del scout.
   * Ejemplos: Curry, Lillard, Trae Young. Un buen tirador de triple SIN este flag = false.
   */
  motorLongRange?: boolean | null;

  /** Override motor transition role; usually leave unset and use rim/trail intensities below. */
  motorTransRole?: "rim_run" | "trail" | "leak" | "fill" | null;
  motorBallHandling?: "elite" | "capable" | "limited" | "liability" | null;
  motorPressureResponse?: "breaks" | "escapes" | "struggles" | null;
  /**
   * Reacción específica ante hedge/blitz en PnR (trap del handler).
   * Campo DISTINTO de motorPressureResponse (presión individual en toda la pista).
   * - escape: sale limpio del trap, pasa o crea ventaja
   * - pass: pasa con tiempo pero no crea ventaja
   * - struggle: pierde el balón o fuerza lanzamiento malo
   */
  motorTrapResponse?: "escape" | "pass" | "struggle" | null;
  motorPostEff?: "high" | "medium" | "low" | null;
  /** @deprecated Prefer post quadrant moves — motor derives package from diagram. */
  motorPostMoves?: ("fade" | "turnaround" | "hook" | "drop_step" | "up_and_under")[] | null;
  motorPostEntry?: "pass" | "duck_in" | "seal" | "flash" | null;
  motorPostEntrySecondary?: "pass" | "duck_in" | "seal" | "flash" | null;
  /** Second interior profile (hybrids). Motor still uses primary for post profile weights. */
  postProfileSecondary?: PostProfile | null;
  /** ISO / PnR handler finish efficiency for motor weights */
  motorIsoEff?: "high" | "medium" | "low" | null;
  motorPnrEff?: "high" | "medium" | "low" | null;
  pnrEffLeft?: "high" | "medium" | "low" | null;
  pnrEffRight?: "high" | "medium" | "low" | null;
  /** Transition: attack rim vs trailer 3 — graded separately from overall transition frequency */
  motorTransRimIntensity?: IntensityLevel;
  motorTransTrail3Intensity?: IntensityLevel;
  /** PnR handler preferred finish when ball on left vs right side (POV: handler facing basket) */
  pnrFinishBallLeft?: PnrFinish | null;
  pnrFinishBallRight?: PnrFinish | null;

  transRolePrimary?: TransRoleEditor;
  transRoleSecondary?: TransRoleEditor;
  transSubPrimary?: string | null;
  transSubSecondary?: string | null;

  highPostZones?: HighPostZonesMotor | null;
  /** Dunker spot tendency: 0 never, 1 occasionally, 2 actively seeks */
  dunkerSpot?: 0 | 1 | 2 | null;

  offBallRole?: "screener" | "cutter" | "both" | "none" | null;
  motorTransitionPrimary?:
    | "rim_runner"
    | "trail"
    | "corredora"
    | "empujadora"
    | "none"
    | null;
  rimRunFrequency?: "primary" | "secondary" | "rare" | "never" | null;
  trailFrequency?: "primary" | "secondary" | "rare" | "never" | null;
  offBallScreenPattern?:
    | "slip"
    | "roll"
    | "pop_short"
    | "pop_mid"
    | "short_roll"
    | "none"
    | null;
  offBallScreenPatternFreq?: "primary" | "secondary" | "rare" | "never" | null;
  cutterFrequency?: "primary" | "secondary" | "rare" | "never" | null;
  /** Per-hand ISO finish (POV: player's left/right). */
  isoFinishLeft?: "drive" | "pullup" | "floater" | "pass" | null;
  isoFinishRight?: "drive" | "pullup" | "floater" | "pass" | null;
  /** @deprecated Mapped to isoFinishLeft/Right via dominant hand in playerInputToMotorInputs */
  isoStrongHandFinish?: "drive" | "pullup" | "floater" | "pass" | null;
  /** @deprecated Mapped to isoFinishLeft/Right via dominant hand in playerInputToMotorInputs */
  isoWeakHandFinish?: "drive" | "pullup" | "floater" | "pass" | null;
  /** Screener “snake” cut — extra slip threat in PnR. */
  pnrSnake?: boolean | null;
  /** How the player handles contact on drives (ISO / paint). */
  contactType?: "seeks" | "absorbs" | "avoids" | null;
  /**
   * @deprecated Duplicado de ftShooting. Mantenido solo para compatibilidad con perfiles
   * guardados antes de la v2. El motor ya no lo lee — usar ftShooting + foulDrawing.
   */
  ftRating?: 1 | 2 | 3 | 4 | 5 | null;

  transFinishing?: "high" | "medium" | "low" | "not_observed" | null;

  /** @deprecated Prefer spotZones — legacy single hotspot */
  spotZone?: "corner" | "wing" | "top" | null;
  spotZones?: SpotZones | null;

  /** Off-ball: action after setting screen (not PnR screener) */
  screenerAction?:
    | "roll_to_rim"
    | "pop_3"
    | "pop_mid"
    | "short_roll"
    | "slip"
    | null;
  offBallCutAction?: "catch_and_shoot" | "catch_and_drive" | "curl" | "flare" | "backdoor" | null;

  // Legacy
  pnrRoleSecondaryLegacy?: "Handler" | "Screener" | "None";
  [key: string]: any;
}

export interface ScoredTrait {
  label: string;
  /**
   * i18n-ready token string.
   * - Static:  "trait_txt_post_profile_high_post"
   * - Dynamic: "trait_txt_iso_force_dir|weak=left|dominant=right|wl=opt_finish_pullup"
   */
  value: string;
  score: number;
  type?: "Strength" | "Weakness" | "Neutral";
}

export interface InternalProfileModel {
  dominantSide: "Left" | "Right" | "Ambidextrous";
  scoringType: string;
  pnrRoleClassification: string;
  postRoleClassification: string;
  isHybridBig?: boolean;
  isConnector?: boolean;
  postTraits: ScoredTrait[];
  isoTraits: ScoredTrait[];
  pnrTraits: ScoredTrait[];
  offBallTraits: ScoredTrait[];
  reboundingThreat: boolean;
  functionalProfile: FunctionalProfile;
}

/** One motor alternative line + engine weight (0–1 scale) for coach review. */
export interface MotorPlanCandidate {
  line: string;
  weight: number;
}

/** Next-tier motor outputs (ranked after primary card). Shown only in coach review mode. */
export interface MotorDefensiveRunnerUps {
  defender: MotorPlanCandidate[];
  forzar: MotorPlanCandidate[];
  concede: MotorPlanCandidate[];
  aware: MotorPlanCandidate[];
}

/**
 * Persisted scouting plan. Core card uses `defender` / `forzar` / `concede`.
 * Motor v2.1 adds `aware`, runner-ups for hybrid nuance, and inferred fields the engine filled in.
 */
export interface DefensivePlan {
  defender: string[];
  forzar: string[];
  concede: string[];
  /** Top “be aware” lines (motor `aware`, first 3). */
  aware?: string[];
  /** Three ranked alternates per lane after the primary slices (for deep report / staff review). */
  motorRunnerUps?: MotorDefensiveRunnerUps;
  /** Fields the motor inferred (confidence tagged) when scouts left them blank. */
  motorInferred?: Record<string, { value: unknown; confidence: string }>;
  motorVersion?: string;
}

export interface PlayerProfile {
  id: string; teamId: string; name: string; number: string; imageUrl: string;
  /** Set when report has been published (coach workflow). */
  published?: boolean;
  /** True if created/promoted by head_coach or master — eligible for Film Room */
  isCanonical?: boolean;
  /** Coach who created this profile (used for My Scout filtering) */
  createdByCoachId?: string;
  /**
   * Canonical scouting input payload used to generate outputs.
   * `inputs` is kept for backward-compatibility with older saved players.
   */
  scoutingInputs?: PlayerInput;
  inputs: PlayerInput;
  internalModel: InternalProfileModel;
  archetype: string; subArchetype?: string; keyTraits: string[];
  defensivePlan: DefensivePlan;
}

// RETIRADO 2026-09-14 (Bloque D, spec 26.3/29/30/32): `GenerateProfileResult`
// era solo el tipo de retorno de `generateProfile()` (motor legacy),
// retirado más abajo -- confirmado por grep sin ningún otro uso antes de
// borrarlo.

export interface Team { id: string; name: string; logo: string; primaryColor: string; }

// ─── Helpers ──────────────────────────────────────────────────────────────────
const isActive = (f: IntensityLevel) => f === "Primary" || f === "Secondary";
const isPrimary = (f: IntensityLevel) => f === "Primary";
// RETIRADO 2026-09-14 (Bloque D, spec 26.3/29/30/32): bloque completo de
// helpers usados solo por `generateProfile()` (motor legacy, retirado más
// abajo) -- `isNeverRare`/`isNever`, la familia `*I18nKey()` (mapeo de
// opciones de input crudo a claves de traducción de "key traits"),
// `postProfileTraitToken()`, `danger()`, `analyzeQuadrants()`. Cada uno
// confirmado por grep sin ningún otro caller antes de borrarlo -- `isActive`/
// `isPrimary` (arriba) SÍ siguen vivos, los usa `playerInputToMotorInputs()`
// (motor-v1 real), no se tocan.


// ─── Default player ───────────────────────────────────────────────────────────
const defaultFP: FunctionalProfile = {
  isInteriorScorer: false, isPerimeterCreator: false, isPnRHandler: false,
  isPnRScreener: false, isPlaymaker: false, isSpotUpShooter: false,
  isMovementShooter: false, isCutter: false, isConnector: false, isStretchBig: false,
};

// AÑADIDO 2026-09-14 (Bloque D, spec 26.3/29/32): exportado para que
// QuickScout.tsx/PlayerEditor.tsx puedan crear una jugadora nueva sin llamar
// a generateProfile() (motor legacy, retirado de sus puntos de guardado) --
// `internal_model` es NOT NULL sin default a nivel de DB (shared/schema.ts),
// hace falta un valor válido en el create aunque nadie lo lea después (nunca
// se leyó en ningún sitio, confirmado por grep antes de este cambio).
export const defaultInternal: InternalProfileModel = {
  dominantSide: "Ambidextrous", scoringType: "Balanced",
  pnrRoleClassification: "Secondary", postRoleClassification: "None",
  postTraits: [], isoTraits: [], pnrTraits: [], offBallTraits: [],
  reboundingThreat: false, functionalProfile: defaultFP,
};

export function createDefaultPlayer(teamId: string): Omit<PlayerProfile, "id"> {
  const inputs: PlayerInput = {
    position: "PG", height: "183 cm", weight: "82 kg", minutesPerGame: 20,
    athleticism: 3, physicalStrength: 3, ftShooting: 3, foulDrawing: 2,
    personality: null, starPlayer: false,
    postFrequency: "Never", postProfile: "Back to Basket",
    postPreferredBlock: "Any", postDominantHand: "Right",
    postQuadrants: {}, postDoubleTeamReaction: "Kicks Out", postIsoAction: "Mixed",
    isoFrequency: "Never", isoStartZone: null, isoDominantDirection: "Balanced",
    isoInitiation: "Controlled", isoDecision: "Finish",
    closeoutReaction: "Catch & Shoot",
    pnrFrequency: "Never", pnrRole: "Handler", pnrRoleSecondary: "None",
    pnrScoringPriority: "Balanced", pnrScreenerAction: "Roll",
    pnrScreenTiming: null,
    pnrReactionVsUnder: "Re-screen", pnrTiming: "Deep (Half-court)",
    pnrDirection: "Balanced", pnrDominantFinish: "Drive to Rim", pnrOppositeFinish: "Pull-up",
    pnrEffLeft: null, pnrEffRight: null,
    transitionFrequency: "Never", transitionRole: "Rim Runner",
    motorTransRimIntensity: "Never",
    motorTransTrail3Intensity: "Never",
    indirectsFrequency: "Never", backdoorFrequency: "Never",
    slipFrequency: "Never",
    duckInFrequency: "Never",
    freeCutsFrequency: "Never", freeCutsType: null,
    offensiveReboundFrequency: "Never", putbackQuality: null,
    courtVision: 3,
    motorLongRange: null,
    transRolePrimary: null,
    transRoleSecondary: null,
    transSubPrimary: null,
    transSubSecondary: null,
    highPostZones: {},
    dunkerSpot: null,
    offBallRole: null,
    motorTransitionPrimary: null,
    rimRunFrequency: "never",
    trailFrequency: "never",
    offBallScreenPattern: null,
    offBallScreenPatternFreq: "never",
    cutterFrequency: "never",
    isoFinishLeft: null,
    isoFinishRight: null,
    isoStrongHandFinish: null,
    isoWeakHandFinish: null,
    pnrSnake: null,
    contactType: null,
    transFinishing: null,
    screenerAction: null,
    offBallCutAction: null,
  };
  return {
    teamId, name: "", number: "",
    imageUrl: `https://i.pravatar.cc/150?u=${Date.now()}`,
    inputs,
    internalModel: defaultInternal, archetype: "arch_role_player", keyTraits: [],
    defensivePlan: { defender: [], forzar: [], concede: [] },
  };
}

function inputToMotorNum(v: unknown, fallback = 3): 1 | 2 | 3 | 4 | 5 {
  if (typeof v === "number") {
    const r = Math.min(5, Math.max(1, Math.round(v)));
    return r as 1 | 2 | 3 | 4 | 5;
  }
  if (v === "High" || v === "high") return 4;
  if (v === "Low" || v === "low") return 2;
  const n = Number(v);
  if (Number.isFinite(n)) {
    const r = Math.min(5, Math.max(1, Math.round(n)));
    return r as 1 | 2 | 3 | 4 | 5;
  }
  return fallback as 1 | 2 | 3 | 4 | 5;
}

function mapMotorIntensity(i: IntensityLevel): "P" | "S" | "R" | "N" {
  if (i === "Primary") return "P";
  if (i === "Secondary") return "S";
  if (i === "Rare") return "R";
  return "N";
}

function cutIntensityRank(i: IntensityLevel): number {
  if (i === "Primary") return 3;
  if (i === "Secondary") return 2;
  if (i === "Rare") return 1;
  return 0;
}

function maxIntensityLevel(...levels: IntensityLevel[]): IntensityLevel {
  let best: IntensityLevel = "Never";
  let bestR = -1;
  for (const l of levels) {
    const r = cutIntensityRank(l);
    if (r > bestR) {
      bestR = r;
      best = l;
    }
  }
  return best;
}

function quadrantMoveToMotorPostMove(moveName: string): MotorPostMoveId | null {
  if (!moveName) return null;
  const n = moveName.toLowerCase();
  if (n.includes("fade")) return "fade";
  if (n.includes("turnaround")) return "turnaround";
  if (n.includes("hook")) return "hook";
  if (n.includes("drop step")) return "drop_step";
  if (n.includes("up") && n.includes("under")) return "up_and_under";
  return null;
}

function deriveMotorPostMovesFromQuadrants(q?: PostQuadrants): MotorPostMoveId[] {
  if (!q) return [];
  const cells = [q.rightBaseline, q.rightMiddle, q.leftBaseline, q.leftMiddle].filter(Boolean);
  const set = new Set<MotorPostMoveId>();
  for (const c of cells) {
    const m = quadrantMoveToMotorPostMove(c!.moveName ?? "");
    if (m) set.add(m);
  }
  return Array.from(set);
}

type MotorIsoHandFinish = NonNullable<PlayerInputs["isoStrongHandFinish"]>;

function normalizeIsoHandFinish(v: unknown): MotorIsoHandFinish | null {
  if (v === "midrange") return "pullup";
  if (v === "drive" || v === "pullup" || v === "floater" || v === "pass") return v;
  return null;
}

function dominantHandForIso(inputs: PlayerInput): "Left" | "Right" | "Ambidextrous" {
  const h = inputs.postDominantHand;
  if (h === "Left") return "Left";
  if (h === "Right") return "Right";
  return "Ambidextrous";
}

/** Map isoFinishLeft/Right + dominant hand → motor strong/weak; legacy isoStrong/Weak as fallback. */
function resolveIsoHandFinishesForMotor(inputs: PlayerInput): {
  isoStrongHandFinish: MotorIsoHandFinish | null;
  isoWeakHandFinish: MotorIsoHandFinish | null;
} {
  const dom = dominantHandForIso(inputs);
  let L = normalizeIsoHandFinish(inputs.isoFinishLeft);
  let R = normalizeIsoHandFinish(inputs.isoFinishRight);
  const oldS = normalizeIsoHandFinish(inputs.isoStrongHandFinish);
  const oldW = normalizeIsoHandFinish(inputs.isoWeakHandFinish);
  if (L == null && R == null && (oldS != null || oldW != null)) {
    if (dom === "Right") {
      R = oldS;
      L = oldW;
    } else if (dom === "Left") {
      L = oldS;
      R = oldW;
    } else {
      R = oldS;
      L = oldW;
    }
  }
  if (dom === "Right") return { isoStrongHandFinish: R, isoWeakHandFinish: L };
  if (dom === "Left") return { isoStrongHandFinish: L, isoWeakHandFinish: R };
  return { isoStrongHandFinish: R, isoWeakHandFinish: L };
}

/**
 * Map pnrFinishBallLeft/Right (nuevo, por lado de cancha) + fallback a
 * pnrDominantFinish/pnrOppositeFinish (legacy, por mano dominante) → motor
 * pnrFinishLeft/Right. Mismo patrón que resolveIsoHandFinishesForMotor.
 *
 * Sin este fallback, fichas scouteadas con los campos legacy (común en
 * perfiles más antiguos, p.ej. jugadoras de PnR con "pnrDominantFinish"/
 * "pnrOppositeFinish" rellenados pero nunca los campos nuevos por lado)
 * llegaban al motor con pnrFinishLeft/Right en null — perdiendo la señal de
 * finalización en PnR por completo (afecta force_direction, aware_pnr_direction,
 * y la nota de manejadora del semáforo de cierre).
 */
function resolvePnrFinishesForMotor(inputs: PlayerInput): {
  pnrFinishLeft: PnrFinish | null;
  pnrFinishRight: PnrFinish | null;
} {
  let L = inputs.pnrFinishBallLeft ?? null;
  let R = inputs.pnrFinishBallRight ?? null;
  if (L == null && R == null && (inputs.pnrDominantFinish != null || inputs.pnrOppositeFinish != null)) {
    const dom = inputs.postDominantHand ?? "Right";
    if (dom === "Right") {
      R = inputs.pnrDominantFinish ?? null;
      L = inputs.pnrOppositeFinish ?? null;
    } else if (dom === "Left") {
      L = inputs.pnrDominantFinish ?? null;
      R = inputs.pnrOppositeFinish ?? null;
    } else {
      R = inputs.pnrDominantFinish ?? null;
      L = inputs.pnrOppositeFinish ?? null;
    }
  }
  return { pnrFinishLeft: L, pnrFinishRight: R };
}

function legacySpotZoneToSpotZones(
  sz: "corner" | "wing" | "top" | null | undefined,
): SpotZones | null {
  if (!sz) return null;
  const empty = (): SpotZones => ({
    cornerLeft: false,
    wing45Left: false,
    top: false,
    wing45Right: false,
    cornerRight: false,
  });
  const z = empty();
  if (sz === "corner") {
    z.cornerLeft = true;
    z.cornerRight = true;
    return z;
  }
  if (sz === "wing") {
    z.wing45Left = true;
    z.wing45Right = true;
    return z;
  }
  if (sz === "top") {
    z.top = true;
    return z;
  }
  return null;
}

/** Maps editor `PlayerInput` to Motor v2.1 `PlayerInputs`. */
export function playerInputToMotorInputs(inputs: PlayerInput): PlayerInputs {
  const ath = inputToMotorNum(inputs.athleticism, 3);
  const phys = inputToMotorNum(inputs.physicalStrength, 3);
  const vision = inputToMotorNum(inputs.courtVision, 3);
  const perimeterThreat =
    ((inputs as PlayerInput).perimeterThreats as IntensityLevel | undefined) ?? "Never";

  const usage: PlayerInputs["usage"] =
    inputs.isoFrequency === "Primary" ||
    inputs.pnrFrequency === "Primary" ||
    inputs.postFrequency === "Primary"
      ? "primary"
      : isActive(inputs.isoFrequency) ||
          isActive(inputs.pnrFrequency) ||
          isActive(inputs.postFrequency)
        ? "secondary"
        : "role";

  const selfCreation: PlayerInputs["selfCreation"] =
    usage === "primary" &&
    (inputs.isoFrequency === "Primary" || inputs.pnrFrequency === "Primary")
      ? "high"
      : usage === "secondary"
        ? "medium"
        : "low";

  const pnrIsHandler =
    inputs.pnrRole === "Handler" ||
    (inputs.pnrRole === "Both" && inputs.pnrRoleSecondary === "Handler");
  const pnrIsScreener =
    inputs.pnrRole === "Screener" ||
    (inputs.pnrRole === "Both" && inputs.pnrRoleSecondary === "Screener");

  let postEntry: PlayerInputs["postEntry"] = inputs.motorPostEntry ?? null;
  if (!postEntry && isActive(inputs.duckInFrequency ?? "Never")) postEntry = "duck_in";

  const posOrder = ["PG", "SG", "SF", "PF", "C"] as const;
  const parts = (inputs.position || "SF").split("/").filter(Boolean);
  let pos: PlayerInputs["pos"] = "SF";
  for (const p of posOrder) {
    if (parts.includes(p)) {
      pos = p;
      break;
    }
  }

  const mapMotorPostProfile = (): PlayerInputs["postProfile"] => {
    switch (inputs.postProfile) {
      case "Back to Basket":
        return "B2B";
      case "Face-Up":
        return "FU";
      default:
        return "M";
    }
  };

  const postShoulder: PlayerInputs["postShoulder"] =
    inputs.postPreferredBlock === "Left Block"
      ? "L"
      : inputs.postPreferredBlock === "Right Block"
        ? "R"
        : "B";

  const screenerToMotor = (): PlayerInputs["screenerAction"] => {
    if (!pnrIsScreener) return null;
    switch (inputs.pnrScreenerAction) {
      case "Roll":
      case "Short Roll":
      case "Lob Only":
        return "roll";
      case "Pop":
      case "Pop (Elbow / Mid)":
        return "pop";
      case "Slip":
        return "slip";
      default:
        return "roll";
    }
  };

  const bd = cutIntensityRank(inputs.backdoorFrequency);
  const ind = cutIntensityRank(inputs.indirectsFrequency);
  const sl = cutIntensityRank(inputs.slipFrequency ?? "Never");
  const maxR = Math.max(bd, ind, sl);

  let cutFreq: PlayerInputs["cutFreq"] = "N";
  if (maxR === 3) cutFreq = "P";
  else if (maxR === 2) cutFreq = "S";
  else if (maxR === 1) cutFreq = "R";

  let cutType: PlayerInputs["cutType"] = null;
  if (cutFreq !== "N") {
    if (bd >= ind && bd >= sl && bd > 0) cutType = "backdoor";
    else if (sl >= bd && sl >= ind && sl > 0) cutType = "flash";
    else if (ind > 0) {
      // indirects active: cutType = curl ONLY if the off-ball action is a cut (curl/drive)
      // NOT if the player exits the screen to shoot (catch_and_shoot / flare)
      // Those are handled separately via offBallCutAction → deny_screen_pop / aware_off_ball_flare
      const oblCut = inputs.offBallCutAction;
      if (oblCut === "curl") cutType = "curl";
      else if (oblCut === "catch_and_drive") cutType = "basket";
      else cutType = null; // catch_and_shoot / flare / null: not a cut, don't emit deny_cut_*
    } else cutType = "basket";
  }

  const pnrPri: PlayerInputs["pnrPri"] =
    inputs.pnrScoringPriority === "Pass First" ? "PF" : "SF";

  let trapResponse: PlayerInputs["trapResponse"] = null;
  if (isActive(inputs.pnrFrequency) && pnrIsHandler) {
    if ((inputs as any).motorTrapResponse != null) {
      // Direct scout observation of hedge/blitz reaction — no cross-contamination with pressureResponse
      // Normalize legacy values from old editor (escapes→escape, struggles→struggle)
      const raw = (inputs as any).motorTrapResponse as string;
      trapResponse = raw === "escapes" ? "escape" : raw === "struggles" ? "struggle" : raw as PlayerInputs["trapResponse"];
    } else {
      // Not observed: infer from vision only, NOT from motorPressureResponse
      if (vision >= 5) trapResponse = "escape";
      else if (vision >= 3) trapResponse = "pass";
      else trapResponse = "struggle";
    }
  }

  const contactFinish: PlayerInputs["contactFinish"] =
    inputs.contactType === "seeks"
      ? "seeks"
      : inputs.contactType === "avoids"
        ? "avoids"
        : inputs.contactType === "absorbs"
          ? "neutral"
          : phys >= 5 && isPrimary(inputs.postFrequency)
            ? "seeks"
            : phys <= 2
              ? "avoids"
              : "neutral";

  // offHandFinish: derived from per-hand ISO finish data when available.
  // closeoutReaction alone is NOT a reliable proxy for off-hand finishing ability.
  // "Catch & Shoot" just means they shoot off the catch — says nothing about hand dominance.
  // Only "Attacks Weak Hand" / "Attacks Strong Hand" give explicit finishing-side signals.
  const offHandFinish: PlayerInputs["offHandFinish"] = (() => {
    // First priority: per-hand ISO finish data (isoFinishLeft / isoFinishRight)
    // If the weak-hand finish is "drive", the player CAN finish with the off-hand → capable/strong
    // If the weak-hand finish is "pass" or null, they avoid it → weak
    const dom = inputs.postDominantHand ?? "Right";
    const weakHandFinish = dom === "Right" ? inputs.isoFinishLeft : inputs.isoFinishRight;
    if (weakHandFinish === "drive" || weakHandFinish === "floater") return "capable";
    if (weakHandFinish === "pass") return "weak";
    // Legacy / closeout signal
    if (inputs.closeoutReaction === "Attacks Weak Hand") return "weak";
    if (inputs.closeoutReaction === "Attacks Strong Hand") return "strong";
    // isoWeakHandFinish legacy field
    if (inputs.isoWeakHandFinish === "drive" || inputs.isoWeakHandFinish === "floater") return "capable";
    if (inputs.isoWeakHandFinish === "pass") return "weak";
    return "capable";
  })();

  let floater: PlayerInputs["floater"] = "N";
  if (
    inputs.pnrDominantFinish === "Floater" ||
    inputs.pnrOppositeFinish === "Floater"
  ) {
    floater = mapMotorIntensity(inputs.pnrFrequency);
  }

  const orebThreat: PlayerInputs["orebThreat"] = (() => {
    if (inputs.offensiveReboundFrequency === "Primary") return "high";
    if (inputs.offensiveReboundFrequency === "Secondary") return "medium";
    if (inputs.offensiveReboundFrequency === "Rare") return "low";
    // Never / unset: infer medium for interior players with strength — they crash boards by default
    if ((pos === "C" || pos === "PF") && phys >= 4) return "medium";
    return "low";
  })();

  // deepRange = true SOLO si el jugador tiene rango más allá del arco estándar (~7.5m+).
  // Un spot-up shooter normal de triple NO tiene deepRange.
  // Requiere confirmación explícita del scout mediante motorLongRange.
  // Fallback de compatibilidad: si motorLongRange no está seteado, solo se activa
  // cuando perimeterThreat es Primary Y el scout ha confirmado rango extra
  // (motorIsoEff === "high" como proxy de nivel de amenaza élite).
  const deepRange =
    inputs.motorLongRange === true ||
    (isPrimary(perimeterThreat) &&
      inputs.motorIsoEff === "high" &&
      inputs.motorLongRange !== false);

  const rimG = cutIntensityRank(inputs.motorTransRimIntensity ?? "Never");
  const tr3G = cutIntensityRank(inputs.motorTransTrail3Intensity ?? "Never");

  let transRole: PlayerInputs["transRole"] = inputs.motorTransRole ?? null;
  if (!transRole) {
    if (rimG > tr3G && rimG > 0) transRole = "rim_run";
    else if (tr3G > rimG && tr3G > 0) transRole = "trail";
    else if (rimG > 0 && tr3G > 0)
      transRole = inputs.transitionRole === "Trailer" ? "trail" : "rim_run";
    else if (rimG > 0) transRole = "rim_run";
    else if (tr3G > 0) transRole = "trail";
    else {
      transRole =
        inputs.transitionRole === "Rim Runner"
          ? "rim_run"
          : inputs.transitionRole === "Trailer"
            ? "trail"
            : inputs.transitionRole === "Pusher" || inputs.transitionRole === "Outlet"
              ? "fill"
              : null;
    }
  }


  const transAgg = maxIntensityLevel(
    inputs.transitionFrequency,
    inputs.motorTransRimIntensity ?? "Never",
    inputs.motorTransTrail3Intensity ?? "Never",
  );
  const transFreqMotor = mapMotorIntensity(transAgg);

  const moveSet = ["fade", "turnaround", "hook", "drop_step", "up_and_under"] as const;
  const fromQuadrants = deriveMotorPostMovesFromQuadrants(inputs.postQuadrants);
  const legacyMoves =
    inputs.motorPostMoves?.filter((m): m is MotorPostMoveId =>
      (moveSet as readonly string[]).includes(m),
    ) ?? [];
  const postMoves =
    fromQuadrants.length > 0 ? fromQuadrants : legacyMoves.length > 0 ? legacyMoves : null;

  return {
    pos,
    hand: inputs.postDominantHand === "Left" ? "L" : "R",
    ath,
    phys,
    personality: inputs.personality ?? null,
    isoFreq: mapMotorIntensity(inputs.isoFrequency),
    pnrFreq: mapMotorIntensity(inputs.pnrFrequency),
    postFreq: mapMotorIntensity(inputs.postFrequency),
    transFreq: transFreqMotor,
    spotUpFreq: mapMotorIntensity(perimeterThreat),
    dhoFreq: "N",
    cutFreq,
    indirectFreq: mapMotorIntensity(inputs.indirectsFrequency),
    usage,
    selfCreation,
    vision,
    offHandFinish,
    floater,
    contactFinish,
    isoDir:
      inputs.isoDominantDirection === "Left"
        ? "L"
        : inputs.isoDominantDirection === "Right"
          ? "R"
          : "B",
    isoDec:
      inputs.isoDecision === "Shoot" ? "S" : inputs.isoDecision === "Pass" ? "P" : "F",
    isoStartZone: inputs.isoStartZone ?? null,
    isoEff: inputs.motorIsoEff ?? null,
    postProfile: mapMotorPostProfile(),
    postZone: null,
    postShoulder,
    postEff: inputs.motorPostEff ?? null,
    postMoves,
    postEntry,
    spotUpAction:
      inputs.closeoutReaction === "Catch & Shoot" ? "shoot" : "either",
    spotZone: inputs.spotZone ?? null,
    spotZones: inputs.spotZones ?? legacySpotZoneToSpotZones(inputs.spotZone) ?? null,
    deepRange,
    pnrPri,
    pnrEff: inputs.motorPnrEff ?? null,
    pnrEffLeft: inputs.pnrEffLeft ?? null,
    pnrEffRight: inputs.pnrEffRight ?? null,
    ...resolvePnrFinishesForMotor(inputs),
    trapResponse,
    screenerAction: screenerToMotor(),
    pnrScreenTiming: inputs.pnrScreenTiming ?? null,
    pnrSnake: inputs.pnrSnake ?? null,
    popRange: deepRange ? "three" : "midrange",
    dhoRole: null,
    dhoAction: null,
    transRole,
    ballHandling: inputs.motorBallHandling ?? null,
    pressureResponse: inputs.motorPressureResponse ?? null,
    cutType,
    orebThreat,
    freeCutsFrequency: inputs.freeCutsFrequency ?? "Never",
    freeCutsType: inputs.freeCutsType ?? null,
    putbackQuality: inputs.putbackQuality ?? null,
    transRolePrimary: inputs.transRolePrimary ?? null,
    transRoleSecondary: inputs.transRoleSecondary ?? null,
    transSubPrimary: inputs.transSubPrimary ?? null,
    transSubSecondary: inputs.transSubSecondary ?? null,
    highPostZones: inputs.highPostZones ?? null,
    dunkerSpot: inputs.dunkerSpot ?? null,
    offBallRole: inputs.offBallRole ?? null,
    motorTransitionPrimary: inputs.motorTransitionPrimary ?? null,
    rimRunFrequency: inputs.rimRunFrequency ?? null,
    trailFrequency: inputs.trailFrequency ?? null,
    offBallScreenPattern: inputs.offBallScreenPattern ?? null,
    offBallScreenPatternFreq: inputs.offBallScreenPatternFreq ?? null,
    ...resolveIsoHandFinishesForMotor(inputs),
    transFinishing: inputs.transFinishing ?? null,
    offBallScreenerAction: inputs.screenerAction ?? null,
    // Motor schema doesn't currently support storing a dedicated "backdoor" token here.
    offBallCutAction: inputs.offBallCutAction === "backdoor" ? null : (inputs.offBallCutAction ?? null),
    starPlayer: inputs.starPlayer ?? null,
  };
}

// ─── generateProfile — Motor v4 ───────────────────────────────────────────────
// Philosophy: "shortest letter" — every input gets interpreted, 
// but only the 3 most actionable conclusions reach the output.
// inputs → danger scores → archetype → interpreted traits → defensive plan

// Resolve legacy transitionRole field to new TransRoleEditor values
function resolveTransRole(inputs: PlayerInput): TransRoleEditor {
  if (inputs.transRolePrimary) return inputs.transRolePrimary;
  switch (inputs.transitionRole) {
    case "Rim Runner": return "rim_runner";
    case "Trailer":    return "trail";
    case "Pusher":     return "pusher";
    case "Outlet":     return "pusher";
    default:           return null;
  }
}

// ─── Rich text generator for defensive plan outputs ──────────────────────────
// Generates specific, actionable text using enriched player inputs.
// Inspired by Synergy/Basketball Immersion scouting report style:
// direct instruction + player-specific context.

// RETIRADO 2026-09-14 (Bloque D, spec 26.3/29/30/32): `motorOutputToRichText()`
// solo lo usaba `generateProfile()` (motor legacy), retirado justo debajo --
// confirmado por grep sin ningún otro caller antes de borrarlo.

// RETIRADO 2026-09-14 (Bloque D, spec 26.3/29/30/32): `generateProfile()`
// (motor legacy, deriva archetype/subArchetype/keyTraits/defensivePlan/
// internalModel a partir de `PlayerInput`) retirado por completo -- sus 2
// lectores reales (MyScout.tsx::hasReportInputs, ScoutDesktop.tsx::
// ReportPreview) usan motor-v1 en vivo desde antes de este commit (secciones
// 29/30), y sus 3 puntos de guardado (QuickScout.tsx, PlayerEditor.tsx x2)
// dejaron de llamarlo en el mismo commit. `GenerateProfileResult`, `danger()`
// y `motorOutputToRichText()` (solo usados desde aquí) retirados con él --
// confirmado cada uno por grep sin otros callers antes de borrar. Los
// campos `archetype`/`keyTraits`/`defensivePlan`/`internal_model` siguen
// existiendo como columnas de DB (NOT NULL con/sin default, shared/schema.ts)
// por compatibilidad con filas ya guardadas -- no se tocó el esquema.


// ─── TanStack Query Hooks ─────────────────────────────────────────────────────
// ─── TanStack Query hooks ──────────────────────────────────────────────────────
// Simple mutations — server is source of truth.
// No optimistic updates, no tempIds, no custom cache surgery.
// On success: invalidate queries and let React Query refetch.

export function useTeams() {
  const { user } = useAuth();
  const userId = user?.id;
  return useQuery<Team[]>({
    queryKey: ["/api/teams", userId ?? "anon"],
    queryFn:  async () => (await apiRequest("GET", "/api/teams")).json(),
  });
}

export function usePlayers(teamId?: string) {
  const { user } = useAuth();
  const userId = user?.id;
  return useQuery<PlayerProfile[]>({
    queryKey: ["/api/players", userId ?? "anon", teamId],
    queryFn:  async () =>
      (await apiRequest("GET", teamId ? `/api/players?teamId=${teamId}` : "/api/players")).json(),
    networkMode: "offlineFirst",
    staleTime:   1000 * 60 * 10,   // 10 min — serve cache offline
    gcTime:      1000 * 60 * 60 * 24 * 7,
  });
}

export function usePlayer(id: string) {
  return useQuery<PlayerProfile>({
    queryKey: ["/api/players", id],
    queryFn:  async () => (await apiRequest("GET", `/api/players/${id}`)).json(),
    enabled:  !!id && id !== "new",
    networkMode: "offlineFirst",
    staleTime:   1000 * 60 * 10,   // 10 min — serve cache offline
    gcTime:      1000 * 60 * 60 * 24 * 7,
  });
}

export function useCreateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (team: Omit<Team, "id">) =>
      (await apiRequest("POST", "/api/teams", team)).json(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/teams"] }),
  });
}

export function useUpdateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Team> }) =>
      (await apiRequest("PATCH", `/api/teams/${id}`, updates)).json(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/teams"] }),
  });
}

export function useDeleteTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/teams/${id}`); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/teams"] }),
  });
}

export function useCreatePlayer() {
  const qc = useQueryClient();
  return useMutation<PlayerProfile, Error, Omit<PlayerProfile, "id">>({
    mutationFn: async (player) =>
      (await apiRequest("POST", "/api/players", player)).json(),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["/api/players"] });
      qc.setQueryData(["/api/players", created.id], created);
    },
    onError: (_err, player) => {
      if (!navigator.onLine) {
        const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        enqueueOfflinePlayerMutation({
          id: `q-${tempId}`,
          kind: "create",
          tempId,
          teamId: (player as any).teamId ?? "",
          payload: player,
        });
      }
    },
  });
}

export function useUpdatePlayer() {
  const qc = useQueryClient();
  return useMutation<PlayerProfile, Error, { id: string; updates: Partial<PlayerProfile> }>({
    mutationFn: async ({ id, updates }) =>
      (await apiRequest("PATCH", `/api/players/${id}`, updates)).json(),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ["/api/players"] });
      qc.setQueryData(["/api/players", updated.id], updated);
    },
    onError: (_err, { id, updates }) => {
      if (!navigator.onLine) {
        // Optimistic cache update so the coach sees their changes immediately
        qc.setQueryData<PlayerProfile>(["/api/players", id], (old) =>
          old ? { ...old, ...updates } : undefined
        );
        qc.setQueryData<PlayerProfile[]>(["/api/players"], (old) =>
          old ? old.map((p) => p.id === id ? { ...p, ...updates } : p) : old
        );
        enqueueOfflinePlayerMutation({
          id: `q-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          kind: "update",
          playerId: id,
          updates,
        });
      }
    },
  });
}

export function useDeletePlayer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/players/${id}`),
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: ["/api/players"] });
      const previous = qc.getQueryData<PlayerProfile[]>(["/api/players"]);
      qc.setQueryData<PlayerProfile[]>(["/api/players"], (old) =>
        old ? old.filter((p) => p.id !== id) : [],
      );
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(["/api/players"], ctx.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["/api/players"] });
    },
  });
}
