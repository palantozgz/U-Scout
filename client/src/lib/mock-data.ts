import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, enqueueOfflinePlayerMutation } from "./queryClient";
import {
  motor,
  motorOutputToPlanString,
  type PlayerInputs,
  type PostMove as MotorPostMoveId,
  type MotorOutput,
  type HighPostZonesMotor,
  type HighPostAction,
  type TransRoleEditor,
} from "./motor-v2.1";

export type { HighPostAction, HighPostZonesMotor, TransRoleEditor };

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
  isoDominantDirection: DirectionTendency;
  isoInitiation?: IsoInitiation;
  isoDecision?: IsoDecision;
  isoOppositeFinish?: "Drive" | "Pull-up" | "Floater";
  closeoutReaction: CloseoutReaction;
  closeoutLeft?: CloseoutReaction;
  closeoutRight?: CloseoutReaction;
  isoPostMove?: "Drive" | "Pull-up" | "Floater";

  // PnR
  pnrFrequency: IntensityLevel;
  pnrRole: "Handler" | "Screener" | "Both";
  pnrRoleSecondary?: "Handler" | "Screener" | "Balanced" | "None";
  pnrScoringPriority: "Score First" | "Pass First" | "Balanced";
  pnrScreenerAction: ScreenerAction;
  pnrScreenerActionSecondary?: ScreenerAction;
  pnrReactionVsUnder: "Pull-up 3" | "Re-screen" | "Reject / Attack";
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
  offensiveReboundFrequency: IntensityLevel;

  courtVision?: PhysicalLevel;

  /** Override motor transition role; usually leave unset and use rim/trail intensities below. */
  motorTransRole?: "rim_run" | "trail" | "leak" | "fill" | null;
  motorBallHandling?: "elite" | "capable" | "limited" | "liability" | null;
  motorPressureResponse?: "breaks" | "escapes" | "struggles" | null;
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
  isoStrongHandFinish?: "drive" | "pullup" | "floater" | "pass" | null;
  isoWeakHandFinish?: "drive" | "pullup" | "floater" | "pass" | null;

  /** Off-ball: action after setting screen (not PnR screener) */
  screenerAction?:
    | "roll_to_rim"
    | "pop_3"
    | "pop_mid"
    | "short_roll"
    | "slip"
    | null;
  offBallCutAction?: "catch_and_shoot" | "catch_and_drive" | "curl" | "flare" | null;

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

/** Return shape of `generateProfile` (same plan shape as persisted on `PlayerProfile`). */
export interface GenerateProfileResult {
  internalModel: InternalProfileModel;
  archetype: string;
  subArchetype?: string;
  keyTraits: string[];
  defensivePlan: DefensivePlan;
}

export interface Team { id: string; name: string; logo: string; primaryColor: string; }

// ─── Helpers ──────────────────────────────────────────────────────────────────
const isActive = (f: IntensityLevel) => f === "Primary" || f === "Secondary";
const isPrimary = (f: IntensityLevel) => f === "Primary";
const isNeverRare = (f: IntensityLevel) => f === "Never" || f === "Rare";
const isNever = isNeverRare;

/** Threat radar row labels (i18n keys, not display English). */
const TRAIT_RADAR_POST = "trait_radar_post";
const TRAIT_RADAR_ISO = "trait_radar_iso";
const TRAIT_RADAR_PNR = "trait_radar_pnr";
const TRAIT_RADAR_OFFBALL = "trait_radar_offball";

function postQuadrantMoveI18nKey(moveName?: string): string {
  if (!moveName) return "";
  switch (moveName) {
    case "Pass to cutter": return "pass_to_cutter";
    case "Kick out to perimeter": return "kick_out";
    case "High-low pass": return "high_low";
    case "Drop Step (Baseline)": return "post_move_drop_step_baseline";
    case "Drop Step (Middle)": return "post_move_drop_step_middle";
    case "Jump Hook": return "post_move_jump_hook";
    case "Spin Move (Baseline)": return "post_move_spin_baseline";
    case "Fadeaway": return "post_move_fadeaway";
    case "Baby Hook": return "post_move_baby_hook";
    case "Back Down": return "post_move_back_down";
    case "Cross Hook": return "post_move_cross_hook";
    case "Up & Under": return "post_move_up_and_under";
    case "Turnaround Jumper": return "post_move_turnaround_jumper";
    case "Face-Up Drive": return "post_move_face_up_drive";
    case "Dream Shake": return "post_move_dream_shake";
    default: return "";
  }
}

function closeoutReactionI18nKey(reaction?: CloseoutReaction | string): string {
  switch (reaction) {
    case "Catch & Shoot": return "opt_closeout_catch_shoot";
    case "Attack Baseline": return "opt_closeout_attack_baseline";
    case "Attack Middle": return "opt_closeout_attack_middle";
    case "Attacks Strong Hand": return "opt_closeout_strong_hand";
    case "Attacks Weak Hand": return "opt_closeout_weak_hand";
    case "Extra Pass": return "opt_closeout_extra_pass";
    default: return "";
  }
}

function postIsoInteriorI18nKey(action?: InteriorIsoAction): string {
  switch (action) {
    case "Back Down": return "opt_iso_interior_back_down";
    case "Face-Up Drive": return "opt_iso_interior_face_up_drive";
    case "Post Jumper": return "opt_iso_interior_post_jumper";
    case "Turnaround": return "opt_iso_interior_turnaround";
    case "Spin": return "opt_iso_interior_spin";
    default: return "";
  }
}

function pnrFinishI18nKey(finish?: PnrFinish): string {
  switch (finish) {
    case "Pull-up": return "opt_finish_pullup";
    case "Drive to Rim": return "opt_finish_drive";
    case "Floater": return "opt_finish_floater";
    case "Mid-range": return "opt_finish_midrange";
    default: return "";
  }
}

function screenerActionI18nKey(action?: ScreenerAction): string {
  switch (action) {
    case "Roll": return "opt_screen_roll";
    case "Pop": return "opt_screen_pop";
    case "Pop (Elbow / Mid)": return "opt_screen_pop_elbow";
    case "Short Roll": return "opt_screen_short_roll";
    case "Slip": return "opt_screen_slip";
    case "Lob Only": return "opt_screen_lob";
    default: return "";
  }
}

function screenerSecondaryVerbI18nKey(action?: ScreenerAction): string {
  switch (action) {
    case "Roll": return "trait_txt_pnr_scr_sec_roll";
    case "Pop": return "trait_txt_pnr_scr_sec_pop";
    case "Pop (Elbow / Mid)": return "trait_txt_pnr_scr_sec_pop_elbow";
    case "Short Roll": return "trait_txt_pnr_scr_sec_short_roll";
    case "Slip": return "trait_txt_pnr_scr_sec_slip";
    case "Lob Only": return "trait_txt_pnr_scr_sec_lob";
    default: return "trait_txt_pnr_scr_sec_read";
  }
}

function isoOppositeFinishI18nKey(finish?: "Drive" | "Pull-up" | "Floater"): string {
  switch (finish) {
    case "Pull-up": return "opt_finish_pullup";
    case "Drive": return "opt_finish_drive";
    case "Floater": return "opt_finish_floater";
    default: return "";
  }
}

function doubleTeamKindI18nKey(kind?: DoubleTeamReaction): string {
  switch (kind) {
    case "Forces Through": return "opt_dt_forces_through";
    case "Kicks Out": return "opt_dt_kicks_out";
    case "Resets": return "opt_dt_resets";
    case "Mixed": return "opt_dt_variable";
    default: return "opt_dt_variable";
  }
}

function postProfileTraitToken(postProfile: PostProfile | undefined, physHigh: boolean, physLow: boolean): string {
  const p = postProfile ?? "Mixed";
  if (p === "Back to Basket") {
    if (physHigh) return "trait_txt_post_profile_btb_bully";
    if (physLow) return "trait_txt_post_profile_btb_finesse";
    return "trait_txt_post_profile_btb_neutral";
  }
  if (p === "Face-Up") {
    if (physHigh) return "trait_txt_post_profile_face_bully";
    if (physLow) return "trait_txt_post_profile_face_finesse";
    return "trait_txt_post_profile_face_neutral";
  }
  if (p === "High Post") return "trait_txt_post_profile_high_post";
  if (p === "arch_stretch_big") {
    if (physHigh) return "trait_txt_post_profile_stretch_bully";
    if (physLow) return "trait_txt_post_profile_stretch_finesse";
    return "trait_txt_post_profile_stretch_neutral";
  }
  if (p === "Mixed") {
    if (physHigh) return "trait_txt_post_profile_mixed_bully";
    if (physLow) return "trait_txt_post_profile_mixed_finesse";
    return "trait_txt_post_profile_mixed_neutral";
  }
  return "trait_txt_post_profile_generic";
}

function danger(freq: IntensityLevel, base: number): number {
  if (freq === "Primary") return base;
  if (freq === "Secondary") return base * 0.6;
  return 0;
}

// ─── Quadrant analysis ────────────────────────────────────────────────────────
function analyzeQuadrants(q: PostQuadrants, dominantHand: "Right" | "Left"): string {
  const filled = [q.rightBaseline, q.rightMiddle, q.leftBaseline, q.leftMiddle].filter(Boolean);
  if (filled.length === 0) return "";

  const strongHand = dominantHand.toLowerCase();
  const weakBlock = dominantHand === "Right" ? "left" : "right";
  const strongBlock = dominantHand === "Right" ? "right" : "left";

  // Strong block baseline = primary weapon
  const strongBaseline: QuadrantMove | undefined = dominantHand === "Right" ? q.rightBaseline : q.leftBaseline;
  const strongMiddle: QuadrantMove | undefined = dominantHand === "Right" ? q.rightMiddle : q.leftMiddle;
  const weakBaseline: QuadrantMove | undefined = dominantHand === "Right" ? q.leftBaseline : q.rightBaseline;
  const weakMiddle: QuadrantMove | undefined = dominantHand === "Right" ? q.leftMiddle : q.rightMiddle;

  // Key pattern: strong baseline + weak middle counter
  if (strongBaseline && weakMiddle) {
    return `${strongBlock.charAt(0).toUpperCase() + strongBlock.slice(1)} block → goes baseline (${strongHand} hand, ${strongBaseline.moveName}). Forced to ${weakBlock} and middle: uses ${weakMiddle.moveName} to get back to ${strongHand} hand. Push ${weakBlock} + middle — that is the weak quadrant.`;
  }
  if (strongBaseline && weakBaseline) {
    if (strongBaseline.moveName === weakBaseline.moveName) {
      return `${strongBaseline.moveName} to the baseline from either block. No safe side baseline.`;
    }
    return `Baseline from ${strongBlock} block: ${strongBaseline.moveName}. Baseline from ${weakBlock} block: ${weakBaseline.moveName}. Both baselines covered.`;
  }
  if (strongBaseline && strongMiddle) {
    return `${strongBlock.charAt(0).toUpperCase() + strongBlock.slice(1)} block: goes baseline (${strongBaseline.moveName}) or middle (${strongMiddle.moveName}). Two-direction threat from preferred block.`;
  }
  if (weakMiddle && !weakBaseline) {
    return `Forced to ${weakBlock} block middle: uses ${weakMiddle.moveName} — counter move to get back to ${strongHand} hand. Still a scoring threat there.`;
  }

  const reads: string[] = [];
  if (strongBaseline) reads.push(`${strongBlock} → baseline: ${strongBaseline.moveName}`);
  if (strongMiddle) reads.push(`${strongBlock} → middle: ${strongMiddle.moveName}`);
  if (weakBaseline) reads.push(`${weakBlock} → baseline: ${weakBaseline.moveName}`);
  if (weakMiddle) reads.push(`${weakBlock} → middle: ${weakMiddle.moveName}`);
  return reads.join(". ") + ".";
}

// ─── Default player ───────────────────────────────────────────────────────────
const defaultFP: FunctionalProfile = {
  isInteriorScorer: false, isPerimeterCreator: false, isPnRHandler: false,
  isPnRScreener: false, isPlaymaker: false, isSpotUpShooter: false,
  isMovementShooter: false, isCutter: false, isConnector: false, isStretchBig: false,
};

const defaultInternal: InternalProfileModel = {
  dominantSide: "Ambidextrous", scoringType: "Balanced",
  pnrRoleClassification: "Secondary", postRoleClassification: "None",
  postTraits: [], isoTraits: [], pnrTraits: [], offBallTraits: [],
  reboundingThreat: false, functionalProfile: defaultFP,
};

export function createDefaultPlayer(teamId: string): Omit<PlayerProfile, "id"> {
  const inputs: PlayerInput = {
    position: "PG", height: "183 cm", weight: "82 kg", minutesPerGame: 20,
    athleticism: 3, physicalStrength: 3, ftShooting: 3, foulDrawing: 2,
    postFrequency: "Never", postProfile: "Back to Basket",
    postPreferredBlock: "Any", postDominantHand: "Right",
    postQuadrants: {}, postDoubleTeamReaction: "Kicks Out", postIsoAction: "Mixed",
    isoFrequency: "Secondary", isoDominantDirection: "Balanced",
    isoInitiation: "Controlled", isoDecision: "Finish",
    closeoutReaction: "Attack Baseline",
    pnrFrequency: "Secondary", pnrRole: "Handler", pnrRoleSecondary: "None",
    pnrScoringPriority: "Balanced", pnrScreenerAction: "Roll",
    pnrReactionVsUnder: "Re-screen", pnrTiming: "Deep (Half-court)",
    pnrDirection: "Balanced", pnrDominantFinish: "Drive to Rim", pnrOppositeFinish: "Pull-up",
    transitionFrequency: "Secondary", transitionRole: "Rim Runner",
    motorTransRimIntensity: "Secondary",
    motorTransTrail3Intensity: "Never",
    indirectsFrequency: "Secondary", backdoorFrequency: "Secondary",
    offensiveReboundFrequency: "Secondary",
    courtVision: 3,
    transRolePrimary: null,
    transRoleSecondary: null,
    transSubPrimary: null,
    transSubSecondary: null,
    highPostZones: {},
    dunkerSpot: null,
    offBallRole: null,
    motorTransitionPrimary: null,
    rimRunFrequency: null,
    trailFrequency: null,
    offBallScreenPattern: null,
    offBallScreenPatternFreq: null,
    isoStrongHandFinish: null,
    isoWeakHandFinish: null,
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

function motorPlanCandidates(outputs: MotorOutput[], start: number, count: number): MotorPlanCandidate[] {
  return outputs.slice(start, start + count).map((o) => ({
    line: motorOutputToPlanString(o),
    weight: o.weight,
  }));
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
    else if (ind > 0) cutType = "curl";
    else cutType = "basket";
  }

  const pnrPri: PlayerInputs["pnrPri"] =
    inputs.pnrScoringPriority === "Pass First" ? "PF" : "SF";

  let trapResponse: PlayerInputs["trapResponse"] = null;
  if (isActive(inputs.pnrFrequency) && pnrIsHandler) {
    if (vision >= 5) trapResponse = "escape";
    else if (vision >= 3) trapResponse = "pass";
    else trapResponse = "struggle";
  }

  const contactFinish: PlayerInputs["contactFinish"] =
    phys >= 5 && isPrimary(inputs.postFrequency)
      ? "seeks"
      : phys <= 2
        ? "avoids"
        : "neutral";

  const offHandFinish: PlayerInputs["offHandFinish"] =
    inputs.closeoutReaction === "Attacks Weak Hand"
      ? "weak"
      : inputs.closeoutReaction === "Attacks Strong Hand"
        ? "strong"
        : "capable";

  let floater: PlayerInputs["floater"] = "N";
  if (
    inputs.pnrDominantFinish === "Floater" ||
    inputs.pnrOppositeFinish === "Floater"
  ) {
    floater = mapMotorIntensity(inputs.pnrFrequency);
  }

  const orebThreat: PlayerInputs["orebThreat"] =
    inputs.offensiveReboundFrequency === "Primary"
      ? "high"
      : inputs.offensiveReboundFrequency === "Secondary"
        ? "medium"
        : inputs.offensiveReboundFrequency === "Rare"
          ? "low"
          : "low";

  const deepRange = isPrimary(perimeterThreat);

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
    isoEff: inputs.motorIsoEff ?? null,
    postProfile: mapMotorPostProfile(),
    postZone: null,
    postShoulder,
    postEff: inputs.motorPostEff ?? null,
    postMoves,
    postEntry,
    spotUpAction:
      inputs.closeoutReaction === "Catch & Shoot" ? "shoot" : "either",
    spotZone: null,
    deepRange,
    pnrPri,
    pnrEff: inputs.motorPnrEff ?? null,
    pnrFinishLeft: inputs.pnrFinishBallLeft ?? null,
    pnrFinishRight: inputs.pnrFinishBallRight ?? null,
    trapResponse,
    screenerAction: screenerToMotor(),
    popRange: deepRange ? "three" : "midrange",
    dhoRole: null,
    dhoAction: null,
    transRole,
    ballHandling: inputs.motorBallHandling ?? null,
    pressureResponse: inputs.motorPressureResponse ?? null,
    cutType,
    orebThreat,
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
    isoStrongHandFinish: inputs.isoStrongHandFinish ?? null,
    isoWeakHandFinish: inputs.isoWeakHandFinish ?? null,
    offBallScreenerAction: inputs.screenerAction ?? null,
    offBallCutAction: inputs.offBallCutAction ?? null,
  };
}

// ─── generateProfile — Motor v4 ───────────────────────────────────────────────
// Philosophy: "shortest letter" — every input gets interpreted, 
// but only the 3 most actionable conclusions reach the output.
// inputs → danger scores → archetype → interpreted traits → defensive plan

export function generateProfile(inputs: PlayerInput, playerName?: string): GenerateProfileResult {
  const nameRef = playerName ? playerName.split(" ").pop()! : ""; // Use last name
  const internal: InternalProfileModel = {
    ...defaultInternal,
    postTraits: [], isoTraits: [], pnrTraits: [], offBallTraits: [],
  };

  // ── Normalize physical bars (legacy string → number) ─────────────────────
  const toNum = (v: any, fallback = 3): number => {
    if (typeof v === "number") return v;
    if (v === "Low" || v === "low") return 2;
    if (v === "Medium" || v === "medium") return 3;
    if (v === "High" || v === "high") return 4;
    return fallback;
  };

  const athleticism   = toNum(inputs.athleticism, 3);
  const physStrength  = toNum(inputs.physicalStrength, 3);
  const courtVision   = toNum(inputs.courtVision, 3);
  const ftPct         = toNum(inputs.ftShooting, 3);
  const foulRate      = toNum(inputs.foulDrawing, 2);

  // Derived thresholds
  const athHigh  = athleticism >= 4;
  const athLow   = athleticism <= 1;
  const athElite = athleticism === 5;
  const physHigh = physStrength >= 4;
  const physLow  = physStrength <= 1;
  const visionHigh = courtVision >= 4;
  const hackable   = ftPct <= 2 && foulRate <= 2;
  const ftDangerous = ftPct >= 4 && foulRate >= 4;

  const isInterior = ["C", "PF"].includes(inputs.position);
  const isoDecision: IsoDecision = inputs.isoDecision ?? "Finish";
  const dominantHand = inputs.postDominantHand ?? "Right";
  const postProfile = inputs.postProfile ?? "Back to Basket";
  const hasQuadrantMoves = inputs.postQuadrants
    && Object.values(inputs.postQuadrants).some(Boolean);
  const perimeterThreat = (inputs as any).perimeterThreats as IntensityLevel ?? "Never";
  const pnrIsHandler  = inputs.pnrRole === "Handler"
    || (inputs.pnrRole === "Both" && inputs.pnrRoleSecondary === "Handler");
  const pnrIsScreener = inputs.pnrRole === "Screener"
    || (inputs.pnrRole === "Both" && inputs.pnrRoleSecondary === "Screener");

  // ── Danger scores ─────────────────────────────────────────────────────────
  // Post: base frequency + move variety + physical dominance
  const postMoveDanger = hasQuadrantMoves ? 3 : (inputs.postMoves?.length ?? 0) >= 1 ? 1 : 0;
  const postDanger = danger(inputs.postFrequency, 10)
    + postMoveDanger
    + (physHigh ? 2 : physLow ? -2 : 0);

  // ISO: base + explosiveness bonus when finishing + directional read
  const isoDanger = danger(inputs.isoFrequency, 10)
    + (isoDecision === "Finish" && athHigh ? 2 : 0)
    + (inputs.isoDominantDirection !== "Balanced" ? 1 : 0)
    + (isActive(perimeterThreat) && isInterior ? 2 : 0); // big who can shoot adds ISO danger

  // PnR: base + handler punishes under + screener slip threat + vision multiplier
  const pnrDanger = danger(inputs.pnrFrequency, 10)
    + (pnrIsHandler && inputs.pnrReactionVsUnder !== "Re-screen" ? 2 : 0)
    + (pnrIsScreener && inputs.pnrScreenerAction === "Slip" ? 1 : 0)
    + (pnrIsScreener && inputs.pnrScreenerAction === "Short Roll" && visionHigh ? 1 : 0);

  // Off-ball: transition + movement + cutting + athleticism (only when active)
  const offBallBase = danger(inputs.transitionFrequency, 8)
    + danger(inputs.indirectsFrequency, 6)
    + danger(inputs.backdoorFrequency, 7);
  const offBallAthBonus = athHigh
    && (isActive(inputs.transitionFrequency) || isActive(inputs.backdoorFrequency)) ? 2 : 0;
  const offBallDanger = offBallBase + offBallAthBonus;

  // ── Dominant side ─────────────────────────────────────────────────────────
  const leftScore  = (inputs.isoDominantDirection === "Left" ? 2 : 0)
    + (dominantHand === "Left" && isActive(inputs.postFrequency) ? 2 : 0);
  const rightScore = (inputs.isoDominantDirection === "Right" ? 2 : 0)
    + (dominantHand === "Right" && isActive(inputs.postFrequency) ? 2 : 0);
  internal.dominantSide =
    leftScore > rightScore + 1 ? "Left" :
    rightScore > leftScore + 1 ? "Right" : "Ambidextrous";

  internal.reboundingThreat = isActive(inputs.offensiveReboundFrequency);
  internal.isHybridBig = isInterior && isActive(inputs.isoFrequency) && isActive(inputs.postFrequency);
  internal.isConnector = visionHigh && inputs.pnrScoringPriority === "Pass First"
    && isActive(inputs.pnrFrequency);

  // ── Sort threats ──────────────────────────────────────────────────────────
  const threats = [
    { label: TRAIT_RADAR_POST,    score: postDanger    },
    { label: TRAIT_RADAR_ISO,     score: isoDanger     },
    { label: TRAIT_RADAR_PNR,     score: pnrDanger     },
    { label: TRAIT_RADAR_OFFBALL, score: offBallDanger },
  ].sort((a, b) => {
    // Interior + post Primary → post ALWAYS wins regardless of other scores
    if (isInterior && isPrimary(inputs.postFrequency)) {
      if (a.label === TRAIT_RADAR_POST) return -1;
      if (b.label === TRAIT_RADAR_POST) return 1;
    }
    if (b.score !== a.score) return b.score - a.score;
    // Tiebreak: ISO beats Off-Ball for non-big positions (G, G/F, SF, F)
    const isoBig = (inputs.position === "C" || inputs.position === "PF" || inputs.position === "F/C" || inputs.position === "C/F");
    if (!isoBig) {
      if (a.label === TRAIT_RADAR_ISO) return -1;
      if (b.label === TRAIT_RADAR_ISO) return 1;
    }
    return 0;
  });
  const primary   = threats[0];
  const secondary = threats[1];

  // ── Scoring type — from PRIMARY situation only ────────────────────────────
  let scoringType: InternalProfileModel["scoringType"] = "Balanced";
  if (primary.label === TRAIT_RADAR_POST) {
    scoringType = "Post Scorer";
  } else if (primary.label === TRAIT_RADAR_ISO) {
    if (isoDecision === "Finish")      scoringType = athHigh ? "Driver" : "Balanced";
    else if (isoDecision === "Shoot")  scoringType = "Shooter";
    else if (isoDecision === "Pass")   scoringType = "Playmaker";
  } else if (primary.label === TRAIT_RADAR_PNR) {
    // Pass First = Playmaker. vision=5 + Balanced = also Playmaker (elite distributors like Clark/CP3).
    // visionHigh + Balanced = NOT Playmaker (Luka/Harden score AND distribute — stay Shooter/Driver).
    if (inputs.pnrScoringPriority === "Pass First" || (courtVision >= 5 && inputs.pnrScoringPriority !== "Score First"))
      scoringType = "Playmaker";
    else if (inputs.pnrReactionVsUnder === "Pull-up 3") scoringType = "Shooter";
    else if (inputs.pnrReactionVsUnder === "Reject / Attack") scoringType = "Driver";
  } else { // Off-Ball
    if (inputs.closeoutReaction === "Catch & Shoot") scoringType = "Shooter";
    else if (athHigh && inputs.transitionRole === "Rim Runner") scoringType = "Driver";
  }
  internal.scoringType = scoringType;

  // ── Archetype map ─────────────────────────────────────────────────────────
  let mainArchetype = "arch_role_player";
  let subArchetype  = "";

  // Special interior cases (highest priority)
  if (isInterior && isPrimary(inputs.postFrequency) && pnrIsHandler
      && isActive(inputs.pnrFrequency) && (visionHigh || inputs.pnrScoringPriority === "Pass First")) {
    mainArchetype = "arch_versatile_big";                          // Jokic
  } else if (isInterior && isActive(inputs.postFrequency)
      && (isPrimary(inputs.isoFrequency) || (isActive(inputs.isoFrequency) && isoDanger >= 8 && isoDecision === "Shoot"))
      && postDanger >= 7 && isoDanger >= 7) {
    mainArchetype = "arch_multi_level_scorer";                      // Embiid, Stewart, Jonquel — post active + PERIMETER threat (Shoot decision)
  } else if (isInterior && internal.isConnector) {
    mainArchetype = "arch_playmaking_big";                          // Draymond, Bam
  } else if (isInterior && isNever(inputs.postFrequency) && isActive(inputs.pnrFrequency)
      && pnrIsScreener
      && (inputs.pnrScreenerAction === "Pop" || inputs.pnrScreenerAction === "Pop (Elbow / Mid)")
      && inputs.closeoutReaction === "Catch & Shoot") {
    mainArchetype = "arch_stretch_big";                             // Brook Lopez
  } else if (primary.label === TRAIT_RADAR_POST) {
    if (isInterior && !isPrimary(inputs.isoFrequency) && !isPrimary(inputs.pnrFrequency))
      mainArchetype = "arch_traditional_post_scorer";               // A'ja Wilson, Kalani Brown — post dominant, no other PRIMARY threat
    else if (isInterior)
      mainArchetype = "arch_low_post_scorer";                       // Lofton, Willy — post + active PnR handler or ISO Primary
    else if (postProfile === "Face-Up" || postProfile === "High Post")
      mainArchetype = "arch_inside_out_threat";
    else
      mainArchetype = "arch_low_post_scorer";
  } else if (primary.label === TRAIT_RADAR_ISO) {
    if (scoringType === "Driver")
      mainArchetype = (isPrimary(inputs.isoFrequency) && isPrimary(inputs.pnrFrequency) && pnrIsHandler)
        ? "arch_offensive_engine" : (athHigh ? "arch_isolation_driver" : "arch_isolation_scorer");
    else if (scoringType === "Shooter")
      mainArchetype = (isPrimary(inputs.isoFrequency) && isPrimary(inputs.pnrFrequency) && pnrIsHandler)
        ? "arch_offensive_engine" : "arch_shot_creator";
    else if (scoringType === "Playmaker")
      mainArchetype = "arch_combo_guard";
    else
      mainArchetype = "arch_isolation_scorer";
  } else if (primary.label === TRAIT_RADAR_PNR) {
    if (pnrIsHandler) {
      if      (scoringType === "Playmaker")  mainArchetype = "arch_pnr_maestro";
      else if (scoringType === "Driver")
        mainArchetype = (isActive(inputs.isoFrequency) && isoDanger >= 8)
          ? "arch_offensive_engine" : "arch_pnr_maestro";
      else if (scoringType === "Shooter")
        mainArchetype = (isPrimary(inputs.isoFrequency) && isPrimary(inputs.pnrFrequency))
          ? "arch_offensive_engine" : "arch_pnr_shooter";
      else mainArchetype = "arch_pnr_creator";
    } else {
      if      (inputs.pnrScreenerAction === "Roll" || inputs.pnrScreenerAction === "Lob Only")
        mainArchetype = "arch_roll_lob_threat";
      else if (inputs.pnrScreenerAction === "Pop" || inputs.pnrScreenerAction === "Pop (Elbow / Mid)")
        mainArchetype = isInterior ? "arch_stretch_big" : "arch_pick_pop_wing";
      else if (inputs.pnrScreenerAction === "Short Roll")
        mainArchetype = internal.isConnector ? "arch_playmaking_big" : "arch_short_roll_big";
      else
        mainArchetype = "arch_slip_threat";
    }
  } else { // Off-Ball primary
    if (scoringType === "Shooter")
      mainArchetype = isPrimary(inputs.indirectsFrequency) ? "arch_movement_shooter" : "arch_spotup_shooter";
    else if (scoringType === "Driver")
      mainArchetype = "arch_cutting_threat";
    else
      mainArchetype = "arch_3d_wing";
  }

  if (internal.isConnector && mainArchetype === "arch_role_player")
    mainArchetype = isInterior ? "arch_playmaking_big" : "arch_connector";
  if (mainArchetype === "arch_role_player" && threats[0].score >= 5)
    mainArchetype = "arch_complementary_piece";

  // Guard rail: never assign post archetype when postFrequency is Never/Rare
  if (isNever(inputs.postFrequency) &&
      (mainArchetype === "arch_traditional_post_scorer" || mainArchetype === "arch_low_post_scorer"
       || mainArchetype === "arch_inside_out_threat")) {
    mainArchetype = inputs.closeoutReaction === "Catch & Shoot" ? "arch_3d_wing" : "arch_complementary_piece";
  }
  // Guard rail: 3&D Wing when all danger scores very low + catch & shoot
  if (threats[0].score < 4 && inputs.closeoutReaction === "Catch & Shoot") {
    mainArchetype = "arch_3d_wing";
  }

  // Sub-archetype — only if secondary is genuinely significant AND comes from active input
  const secondaryIsReal = secondary.score >= 6 && (
    (secondary.label === TRAIT_RADAR_POST    && isActive(inputs.postFrequency))  ||
    (secondary.label === TRAIT_RADAR_ISO     && isActive(inputs.isoFrequency))   ||
    (secondary.label === TRAIT_RADAR_PNR     && isActive(inputs.pnrFrequency))   ||
    (secondary.label === TRAIT_RADAR_OFFBALL && isActive(inputs.transitionFrequency))
  );
  if (secondaryIsReal)
    subArchetype = {
      [TRAIT_RADAR_POST]: "sub_post_threat",
      [TRAIT_RADAR_ISO]: "sub_iso_threat",
      [TRAIT_RADAR_PNR]: "sub_pnr_threat",
      [TRAIT_RADAR_OFFBALL]: "sub_offball_threat",
    }[secondary.label] ?? "";

  // ── Interpreted traits ────────────────────────────────────────────────────
  // Rule: interpret, don't echo. Max 3 per section. Score drives selection.
  // Each trait = one defensive action the player must take.

  // ── POST TRAITS ────────────────────────────────────────────────────────────
  if (postDanger >= 5) {
    // 1. Profile — what kind of post scorer
    internal.postTraits.push({
      label: isPrimary(inputs.postFrequency) ? "trait_primary_post_scorer" : "trait_post_threat",
      value: postProfileTraitToken(postProfile, physHigh, physLow),
      score: postDanger,
      type: "Strength",
    });

    // 2. Quadrant analysis — most dangerous move pattern
    if (hasQuadrantMoves && inputs.postQuadrants) {
      const q = inputs.postQuadrants;
      const strongBaseline = dominantHand === "Right" ? q.rightBaseline : q.leftBaseline;
      const strongMiddle   = dominantHand === "Right" ? q.rightMiddle   : q.leftMiddle;
      const weakBaseline   = dominantHand === "Right" ? q.leftBaseline  : q.rightBaseline;
      const weakMiddle     = dominantHand === "Right" ? q.leftMiddle    : q.rightMiddle;
      const strongBlock    = dominantHand === "Right" ? "right" : "left";
      const weakBlock      = dominantHand === "Right" ? "left"  : "right";

      const sbKey = postQuadrantMoveI18nKey(strongBaseline?.moveName);
      const smKey = postQuadrantMoveI18nKey(strongMiddle?.moveName);

      let moveToken = "";
      if (strongBaseline && strongMiddle && sbKey && smKey) {
        moveToken = `trait_txt_post_move_both_dirs|strongBlock=${strongBlock}|sb=${sbKey}|sm=${smKey}`;
      } else if (strongBaseline && !weakBaseline && sbKey) {
        moveToken = `trait_txt_post_move_strong_baseline_only|strongBlock=${strongBlock}|weakBlock=${weakBlock}|sb=${sbKey}`;
      } else if (strongMiddle && !weakMiddle && smKey) {
        moveToken = `trait_txt_post_move_strong_middle_only|strongBlock=${strongBlock}|weakBlock=${weakBlock}|sm=${smKey}`;
      } else if (Object.values(q).filter(Boolean).length >= 3) {
        moveToken = "trait_txt_post_move_multi_quadrants";
      }
      if (moveToken) {
        internal.postTraits.push({ label: "trait_move_pattern", value: moveToken, score: postDanger - 1, type: "Strength" });
      }
    }

    // 3. Double team behavior — critical for help defense
    if (isPrimary(inputs.postFrequency) && inputs.postDoubleTeamReaction) {
      internal.postTraits.push({
        label: "trait_on_the_double",
        value: `trait_txt_post_double|kind=${doubleTeamKindI18nKey(inputs.postDoubleTeamReaction)}`,
        score: postDanger - 2,
        type: "Strength",
      });
    }

    // 4. Duck-in / opportunistic interior
    if (isActive(inputs.duckInFrequency ?? "Never")) {
      internal.postTraits.push({
        label: "trait_duck_in",
        value: isPrimary(inputs.duckInFrequency ?? "Never")
          ? "trait_txt_duck_in_primary"
          : "trait_txt_duck_in_secondary",
        score: postDanger - 2, type: "Strength",
      });
    }
  }

  internal.postTraits.sort((a, b) => b.score - a.score);
  internal.postTraits = internal.postTraits.slice(0, 3);

  // ── ISO TRAITS ─────────────────────────────────────────────────────────────
  if (isoDanger >= 5) {
    // 1. Attack style — interpret isoDecision + athleticism + initiation together
    const quick = inputs.isoInitiation === "Quick Attack";
    const initKey = quick ? "opt_iso_init_quick" : "opt_iso_init_controlled";

    let attackToken = "";
    if (isInterior && !internal.isHybridBig && inputs.postIsoAction && inputs.postIsoAction !== "Mixed") {
      const interiorKey = postIsoInteriorI18nKey(inputs.postIsoAction);
      attackToken = interiorKey ? `trait_txt_iso_interior|action=${interiorKey}` : "trait_txt_iso_interior_generic";
    } else if (isoDecision === "Finish") {
      if (athElite) attackToken = quick ? "trait_txt_iso_attack_finish_elite_quick" : "trait_txt_iso_attack_finish_elite_controlled";
      else if (athHigh) attackToken = quick ? "trait_txt_iso_attack_finish_high_quick" : "trait_txt_iso_attack_finish_high_controlled";
      else attackToken = quick ? "trait_txt_iso_attack_finish_neutral_quick" : "trait_txt_iso_attack_finish_neutral_controlled";
      attackToken += `|init=${initKey}`;
    } else if (isoDecision === "Shoot") {
      attackToken = `${quick ? "trait_txt_iso_attack_shoot_quick" : "trait_txt_iso_attack_shoot_controlled"}|init=${initKey}`;
    } else {
      attackToken = visionHigh ? "trait_txt_iso_attack_pass_vision" : "trait_txt_iso_attack_pass_normal";
    }
    internal.isoTraits.push({
      label: isPrimary(inputs.isoFrequency) ? "trait_primary_scorer" : "trait_secondary_creator",
      value: attackToken, score: isoDanger, type: "Strength",
    });

    // 2. Directional — most actionable single piece of info
    if (internal.dominantSide !== "Ambidextrous" && isActive(inputs.isoFrequency)) {
      const weak = internal.dominantSide === "Right" ? "left" : "right";
      const dominant = internal.dominantSide.toLowerCase();
      const wlKey = isoOppositeFinishI18nKey(inputs.isoOppositeFinish) || "opt_finish_pullup";
      internal.isoTraits.push({
        label: "trait_force_direction",
        value: `trait_txt_iso_force_dir|weak=${weak}|dominant=${dominant}|wl=${wlKey}`,
        score: 9, type: "Strength",
      });
    }

    // 3. Closeout — uses per-wing data when available, falls back to general
    const leftCloseout  = inputs.closeoutLeft  ?? inputs.closeoutReaction;
    const rightCloseout = inputs.closeoutRight ?? inputs.closeoutReaction;
    let closeoutToken = "";
    if (leftCloseout !== rightCloseout) {
      const lk = closeoutReactionI18nKey(leftCloseout);
      const rk = closeoutReactionI18nKey(rightCloseout);
      closeoutToken = (lk && rk)
        ? `trait_txt_iso_closeout_wing|left=${lk}|right=${rk}`
        : "trait_txt_iso_closeout_unknown";
    } else {
      const rk = closeoutReactionI18nKey(inputs.closeoutReaction);
      closeoutToken = rk ? `trait_txt_iso_closeout_one|rxn=${rk}` : "trait_txt_iso_closeout_unknown";
    }
    internal.isoTraits.push({ label: "trait_closeout", value: closeoutToken, score: 8, type: "Strength" });

    // Interior perimeter threat
    if (isInterior && isActive(perimeterThreat)) {
      internal.isoTraits.push({
        label: "trait_perimeter_threat",
        value: isPrimary(perimeterThreat)
          ? "trait_txt_iso_perim_primary"
          : "trait_txt_iso_perim_secondary",
        score: 8, type: "Strength",
      });
    }
  }

  internal.isoTraits.sort((a, b) => b.score - a.score);
  internal.isoTraits = internal.isoTraits.slice(0, 3);

  // ── PNR TRAITS ─────────────────────────────────────────────────────────────
  if (pnrDanger >= 5) {
    if (pnrIsHandler) {
      // 1. Coverage instruction — most important
      const punishesUnder = inputs.pnrReactionVsUnder !== "Re-screen";
      const coverageToken = punishesUnder
        ? inputs.pnrReactionVsUnder === "Pull-up 3"
          ? "trait_txt_pnr_cov_under_pullup3"
          : "trait_txt_pnr_cov_under_attack"
        : "trait_txt_pnr_cov_under_safe";
      internal.pnrTraits.push({ label: "trait_screen_coverage", value: coverageToken, score: pnrDanger, type: "Strength" });

      // 2. Scoring vs passing — pass-first changes the entire defensive assignment
      if (inputs.pnrScoringPriority === "Pass First" && isPrimary(inputs.pnrFrequency)) {
        internal.pnrTraits.push({
          label: "trait_pass_first",
          value: visionHigh ? "trait_txt_pnr_pass_first_vision" : "trait_txt_pnr_pass_first",
          score: pnrDanger - 1,
          type: "Strength",
        });
      }

      // 3. Timing — drag screens change transition rules
      if (inputs.pnrTiming === "Early (Drag)" && isActive(inputs.pnrFrequency)) {
        internal.pnrTraits.push({
          label: "trait_drag_screen",
          value: "trait_txt_pnr_drag",
          score: pnrDanger - 1, type: "Strength",
        });
      }

      // 4. Dominant finish — funnel instruction
      if (inputs.pnrDominantFinish && inputs.pnrOppositeFinish && inputs.pnrDominantFinish !== inputs.pnrOppositeFinish) {
        const domKey = pnrFinishI18nKey(inputs.pnrDominantFinish);
        const weakKey = pnrFinishI18nKey(inputs.pnrOppositeFinish);
        if (domKey && weakKey) {
          internal.pnrTraits.push({
            label: "trait_funnel_direction",
            value: `trait_txt_pnr_funnel|dominant=${domKey}|weak=${weakKey}`,
            score: pnrDanger - 2, type: "Strength",
          });
        }
      }
    } else { // Screener
      const primary = inputs.pnrScreenerAction;
      const primaryKey = screenerActionI18nKey(primary);
      const secVerb = inputs.pnrScreenerActionSecondary
        ? screenerSecondaryVerbI18nKey(inputs.pnrScreenerActionSecondary)
        : "";

      let screenerToken = "";
      if (primary === "Short Roll") {
        if (visionHigh) {
          screenerToken = secVerb
            ? `trait_txt_pnr_scr_short_roll_vision_sec|secondary=${secVerb}`
            : "trait_txt_pnr_scr_short_roll_vision";
        } else {
          screenerToken = secVerb
            ? `trait_txt_pnr_scr_short_roll_sec|secondary=${secVerb}`
            : "trait_txt_pnr_scr_short_roll";
        }
      } else {
        screenerToken = secVerb
          ? `trait_txt_pnr_scr_primary_sec|action=${primaryKey}|secondary=${secVerb}`
          : `trait_txt_pnr_scr_primary|action=${primaryKey}`;
      }

      internal.pnrTraits.push({ label: "trait_screen_action", value: screenerToken, score: pnrDanger, type: "Strength" });
    }

    // Dual role note
    if (inputs.pnrRole === "Both" && isActive(inputs.pnrFrequency)) {
      internal.pnrTraits.push({
        label: "trait_dual_role",
        value: "trait_txt_pnr_dual_role",
        score: pnrDanger - 2, type: "Strength",
      });
    }
  }

  internal.pnrTraits.sort((a, b) => b.score - a.score);
  internal.pnrTraits = internal.pnrTraits.slice(0, 3);

  // ── OFF-BALL TRAITS ────────────────────────────────────────────────────────
  if (offBallDanger >= 5) {
    if (isPrimary(inputs.transitionFrequency)) {
      let transitionToken = "trait_txt_offball_trans_generic";
      if (inputs.transitionRole === "Pusher") transitionToken = "trait_txt_offball_trans_pusher";
      else if (inputs.transitionRole === "Trailer") transitionToken = "trait_txt_offball_trans_trailer";
      else if (inputs.transitionRole === "Outlet")
        transitionToken = athHigh ? "trait_txt_offball_trans_outlet_fast" : "trait_txt_offball_trans_outlet";
      else if (inputs.transitionRole === "Rim Runner")
        transitionToken = athElite ? "trait_txt_offball_trans_rim_elite" : "trait_txt_offball_trans_rim_playback";

      internal.offBallTraits.push({
        label: "trait_transition",
        value: transitionToken,
        score: offBallDanger, type: "Strength",
      });
    }

    if (isPrimary(inputs.backdoorFrequency) || (isActive(inputs.backdoorFrequency) && athHigh)) {
      internal.offBallTraits.push({
        label: "trait_backdoor",
        value: athElite ? "trait_txt_offball_backdoor_elite" : "trait_txt_offball_backdoor_active",
        score: offBallDanger - 1, type: "Strength",
      });
    }

    if (isPrimary(inputs.indirectsFrequency)) {
      internal.offBallTraits.push({
        label: "trait_off_screens",
        value: isActive(inputs.slipFrequency ?? "Never")
          ? "trait_txt_offball_offscreens_slip"
          : "trait_txt_offball_offscreens",
        score: offBallDanger - 1, type: "Strength",
      });
    } else if (isActive(inputs.slipFrequency ?? "Never")) {
      internal.offBallTraits.push({
        label: "trait_slip_threat",
        value: "trait_txt_offball_slip_threat",
        score: offBallDanger - 2, type: "Strength",
      });
    }

    if (isPrimary(inputs.offensiveReboundFrequency)) {
      internal.offBallTraits.push({
        label: "trait_crashing",
        value: physHigh ? "trait_txt_offball_crash_phys" : "trait_txt_offball_crash",
        score: offBallDanger - 2, type: "Strength",
      });
    }
  }

  internal.offBallTraits.sort((a, b) => b.score - a.score);
  internal.offBallTraits = internal.offBallTraits.slice(0, 3);

  // ── Key traits ─────────────────────────────────────────────────────────────
  const allTraits = [
    ...internal.postTraits, ...internal.isoTraits,
    ...internal.pnrTraits, ...internal.offBallTraits,
  ].filter(t => t.score >= 7).sort((a, b) => b.score - a.score);
  const keyTraits = Array.from(new Set(allTraits.map(t => t.label))).slice(0, 3);

  // ── Defensive plan ─────────────────────────────────────────────────────────
  // Law of the funnel: interpret, prioritize, condense.
  // defender = what to do proactively
  // forzar = where/how to push her
  // concede = what to accept as the lesser evil
  const defender: string[] = [];
  const forzar:   string[] = [];
  const concede:  string[] = [];

  const topScore = threats[0].score;

  // ── DEFENDER ──────────────────────────────────────────────────────────────
  // Post primary
  if (postDanger >= topScore * 0.8 && postDanger >= 5) {
    if (postProfile === "High Post")
      defender.push("def_high_post_meet");
    else {
      const side = inputs.postPreferredBlock !== "Any"
        ? (inputs.postPreferredBlock === "Left Block" ? "left" : "right") : null;
      defender.push(side
        ? `def_deny_block|side=${side}`
        : physHigh
        ? "def_post_physical"
        : "def_post_front");
    }
    if (ftDangerous && isPrimary(inputs.postFrequency))
      defender.push("def_post_no_foul");
  }

  // ISO primary
  if (isoDanger >= topScore * 0.7 && isoDanger >= 5 && defender.length < 3) {
    if (internal.dominantSide !== "Ambidextrous")
      defender.push(`def_shade_side|side=${internal.dominantSide.toLowerCase()}`);
    else if (isoDecision === "Finish" && athHigh)
      defender.push("def_iso_stay_front");
    else if (inputs.closeoutReaction === "Attacks Strong Hand")
      defender.push("def_iso_shade_strong");
    else
      defender.push("def_iso_tight");
  }

  // PnR primary
  if (pnrDanger >= topScore * 0.7 && pnrDanger >= 5 && defender.length < 3) {
    if (pnrIsHandler) {
      defender.push(inputs.pnrReactionVsUnder !== "Re-screen"
        ? "def_pnr_go_over"
        : "def_pnr_under_safe");
      if (inputs.pnrTiming === "Early (Drag)")
        defender.push("def_pnr_drag");
    } else {
      const tagReads: Record<string, string> = {
        "Roll":              "def_screen_roll",
        "Pop":               "def_screen_pop",
        "Pop (Elbow / Mid)": "def_screen_pop_elbow",
        "Short Roll":        "def_screen_short_roll",
        "Slip":              "def_screen_slip",
        "Lob Only":          "def_screen_lob",
      };
      defender.push(tagReads[inputs.pnrScreenerAction] ?? "def_no_threat");
    }
  }

  // Off-ball primary
  if (offBallDanger >= topScore * 0.7 && offBallDanger >= 5 && defender.length < 3) {
    if (isPrimary(inputs.backdoorFrequency) && athHigh)
      defender.push("def_backdoor");
    else if (isPrimary(inputs.transitionFrequency))
      defender.push({
        Pusher:       "def_trans_pusher",
        Outlet:       "def_trans_outlet",
        "Rim Runner": "def_trans_runner",
        Trailer:      "def_trans_trailer",
      }[inputs.transitionRole] ?? "def_trans_pusher");
  }

  // FT danger universal — append if not already mentioned
  if (ftDangerous && defender.length < 3 && !defender.some(d => d.includes("FT")))
    defender.push("def_ft_dangerous");
  if (hackable && defender.length < 3)
    defender.push("def_hackable");
  if (isPrimary(inputs.offensiveReboundFrequency) && defender.length < 3)
    defender.push("def_orb");
  if (visionHigh && isActive(inputs.pnrFrequency) && defender.length < 3)
    defender.push("def_vision");

  if (defender.length === 0) defender.push("def_no_threat");

  // ── FORZAR ────────────────────────────────────────────────────────────────
  // Use directional data when available — per-wing closeout > general
  if (internal.dominantSide !== "Ambidextrous" && isActive(inputs.isoFrequency)) {
    const weak = internal.dominantSide === "Right" ? "left" : "right";
    const wl   = inputs.isoOppositeFinish === "Pull-up" ? "opt_finish_pullup"
               : inputs.isoOppositeFinish === "Drive"   ? "opt_finish_drive"
               : inputs.isoOppositeFinish === "Floater"  ? "opt_finish_floater"
               : "opt_finish_pullup";
    forzar.push(`for_direction|weak=${weak}|wl=${wl}`);
  }

  // Per-wing closeout forzar
  if (inputs.closeoutLeft && inputs.closeoutRight && inputs.closeoutLeft !== inputs.closeoutRight && forzar.length < 3) {
    const better = inputs.closeoutLeft === "Catch & Shoot" || inputs.closeoutLeft === "Attack Baseline" ? "left" : "right";
    const worse  = better === "left" ? "right" : "left";
    forzar.push(`for_closeout_wing|better=${better}|worse=${worse}`);
  }

  // Post weak quadrant
  if (isActive(inputs.postFrequency) && hasQuadrantMoves && inputs.postQuadrants && forzar.length < 3) {
    const q = inputs.postQuadrants;
    const weakBlock   = dominantHand === "Right" ? "left"   : "right";
    const weakMiddleQ = dominantHand === "Right" ? q.leftMiddle  : q.rightMiddle;
    const weakBaseQ   = dominantHand === "Right" ? q.leftBaseline : q.rightBaseline;
    if (!weakMiddleQ && !weakBaseQ)
      forzar.push(`for_post_block|block=${weakBlock}`);
    else if (!weakMiddleQ)
      forzar.push(`for_post_middle|block=${weakBlock}`);
  }

  // PnR weaker finish
  if (pnrIsHandler && isActive(inputs.pnrFrequency)
      && inputs.pnrDominantFinish && inputs.pnrOppositeFinish
      && inputs.pnrDominantFinish !== inputs.pnrOppositeFinish && forzar.length < 3) {
    const wl = { "Pull-up": "opt_finish_pullup", "Drive to Rim": "opt_finish_drive", "Floater": "opt_finish_floater", "Mid-range": "opt_finish_midrange" }[inputs.pnrOppositeFinish] ?? "opt_finish_pullup";
    forzar.push(`for_pnr_funnel|wl=${wl}`);
  }

  if (physLow && isoDecision === "Finish" && forzar.length < 3)
    forzar.push("for_weak_finisher");
  if (athLow && forzar.length < 3)
    forzar.push("for_no_athlete");
  if (isNever(inputs.isoFrequency) && forzar.length < 3)
    forzar.push("for_no_iso");
  if (isNever(inputs.postFrequency) && postDanger < 3 && forzar.length < 3)
    forzar.push("for_no_post");
  if (forzar.length === 0) forzar.push("for_no_weakness");

  // ── CONCEDE ───────────────────────────────────────────────────────────────
  // Foul strategy — uses both ftShooting AND foulDrawing together
  if (hackable)
    concede.push("con_hackable");
  else if (ftDangerous)
    concede.push("con_ft_dangerous");
  else if (ftPct >= 4)
    concede.push("con_ft_decent");
  else if (ftPct <= 2)
    concede.push("con_ft_poor");

  // Directional concede
  if (internal.dominantSide !== "Ambidextrous" && isActive(inputs.isoFrequency) && inputs.isoOppositeFinish) {
    const weak = internal.dominantSide === "Right" ? "left" : "right";
    concede.push(`con_iso_weak|weak=${weak}`);
  }

  // PnR under
  if (pnrIsHandler && isActive(inputs.pnrFrequency) && inputs.pnrReactionVsUnder === "Re-screen" && concede.length < 3)
    concede.push("con_pnr_under");

  // Open catch — not a shooter
  if (inputs.closeoutReaction !== "Catch & Shoot" && isActive(inputs.isoFrequency) && concede.length < 3)
    concede.push("con_no_shooter");

  // No post, no interior danger
  if (isNever(inputs.postFrequency) && postDanger < 3 && concede.length < 3)
    concede.push("con_no_post");

  // No transition threat
  if (isNever(inputs.transitionFrequency) && concede.length < 3)
    concede.push("con_no_transition");

  // Interior perimeter concede
  if (isInterior && !isActive(perimeterThreat) && concede.length < 3)
    concede.push("con_no_perimeter");

  const motorInputs = playerInputToMotorInputs(inputs);
  const motorReport = motor.generateReport(motorInputs);
  const { selected, categorized, inputs: motorEnriched } = motorReport;

  const md = selected.deny.map(motorOutputToPlanString).slice(0, 3);
  const mf = selected.force.map(motorOutputToPlanString).slice(0, 3);
  const mc = selected.allow.map(motorOutputToPlanString).slice(0, 3);
  const ma = selected.aware.map(motorOutputToPlanString).slice(0, 3);

  const runnerUps: MotorDefensiveRunnerUps = {
    defender: motorPlanCandidates(categorized.deny, 3, 3),
    forzar: motorPlanCandidates(categorized.force, 2, 3),
    concede: motorPlanCandidates(categorized.allow, 2, 3),
    aware: motorPlanCandidates(categorized.aware, 3, 3),
  };

  const inferredEntries = motorEnriched._inferred
    ? Object.entries(motorEnriched._inferred).map(([k, v]) => [
        k,
        { value: v.value, confidence: v.confidence },
      ] as const)
    : [];
  const motorInferred =
    inferredEntries.length > 0 ? Object.fromEntries(inferredEntries) : undefined;

  return {
    internalModel: internal,
    archetype: mainArchetype,
    subArchetype,
    keyTraits,
    defensivePlan: {
      defender: md.length > 0 ? md : defender.slice(0, 3),
      forzar: mf.length > 0 ? mf : forzar.slice(0, 3),
      concede: mc.length > 0 ? mc : concede.slice(0, 3),
      aware: ma.length > 0 ? ma : undefined,
      motorRunnerUps: runnerUps,
      motorInferred,
      motorVersion: "2.1",
    },
  };
}


// ─── TanStack Query Hooks ─────────────────────────────────────────────────────
// ─── TanStack Query hooks ──────────────────────────────────────────────────────
// Simple mutations — server is source of truth.
// No optimistic updates, no tempIds, no custom cache surgery.
// On success: invalidate queries and let React Query refetch.

export function useTeams() {
  return useQuery<Team[]>({
    queryKey: ["/api/teams"],
    queryFn:  async () => (await apiRequest("GET", "/api/teams")).json(),
  });
}

export function usePlayers(teamId?: string) {
  return useQuery<PlayerProfile[]>({
    queryKey: ["/api/players", teamId],
    queryFn:  async () =>
      (await apiRequest("GET", teamId ? `/api/players?teamId=${teamId}` : "/api/players")).json(),
  });
}

export function usePlayer(id: string) {
  return useQuery<PlayerProfile>({
    queryKey: ["/api/players", id],
    queryFn:  async () => (await apiRequest("GET", `/api/players/${id}`)).json(),
    enabled:  !!id && id !== "new",
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
  });
}

export function useDeletePlayer() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => { await apiRequest("DELETE", `/api/players/${id}`); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/players"] }),
  });
}
