import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, enqueueOfflinePlayerMutation } from "./queryClient";
// Motor translation helpers — tm() static, tmp() with params
import { t as tm_raw } from "./i18n";
const tm = (key: string): string => tm_raw(key as any);
const tmp = (key: string, params: Record<string, string>): string => {
  let s = tm_raw(key as any);
  Object.entries(params).forEach(([k, v]) => { s = s.replace(new RegExp("{" + k + "}", "g"), v); });
  return s;
};

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
export type PostProfile = "Back to Basket" | "Face-Up" | "Mixed" | "High Post" | "Stretch Big";
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
  duckInFrequency?: IntensityLevel;
  backdoorFrequency: IntensityLevel;
  offensiveReboundFrequency: IntensityLevel;

  // Legacy
  pnrRoleSecondaryLegacy?: "Handler" | "Screener" | "None";
  [key: string]: any;
}

export interface ScoredTrait { label: string; value: string; score: number; type?: "Strength" | "Weakness" | "Neutral"; }

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

export interface PlayerProfile {
  id: string; teamId: string; name: string; number: string; imageUrl: string;
  /**
   * Canonical scouting input payload used to generate outputs.
   * `inputs` is kept for backward-compatibility with older saved players.
   */
  inputs: PlayerInput;
  internalModel: InternalProfileModel;
  archetype: string; subArchetype?: string; keyTraits: string[];
  defensivePlan: { defender: string[]; forzar: string[]; concede: string[] };
}

export interface Team { id: string; name: string; logo: string; primaryColor: string; }

// ─── Helpers ──────────────────────────────────────────────────────────────────
const isActive = (f: IntensityLevel) => f === "Primary" || f === "Secondary";
const isPrimary = (f: IntensityLevel) => f === "Primary";
const isNeverRare = (f: IntensityLevel) => f === "Never" || f === "Rare";
const isNever = isNeverRare;

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
    indirectsFrequency: "Secondary", backdoorFrequency: "Secondary",
    offensiveReboundFrequency: "Secondary",
  };
  return {
    teamId, name: "", number: "",
    imageUrl: `https://i.pravatar.cc/150?u=${Date.now()}`,
    inputs,
    internalModel: defaultInternal, archetype: "Role Player", keyTraits: [],
    defensivePlan: { defender: [], forzar: [], concede: [] },
  };
}

// ─── generateProfile — Motor v4 ───────────────────────────────────────────────
// Philosophy: "shortest letter" — every input gets interpreted, 
// but only the 3 most actionable conclusions reach the output.
// inputs → danger scores → archetype → interpreted traits → defensive plan

export function generateProfile(inputs: PlayerInput, playerName?: string) {
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
    { label: "Post",     score: postDanger    },
    { label: "ISO",      score: isoDanger     },
    { label: "PnR",      score: pnrDanger     },
    { label: "Off-Ball", score: offBallDanger },
  ].sort((a, b) => {
    // Interior + post Primary → post ALWAYS wins regardless of other scores
    if (isInterior && isPrimary(inputs.postFrequency)) {
      if (a.label === "Post") return -1;
      if (b.label === "Post") return 1;
    }
    if (b.score !== a.score) return b.score - a.score;
    // Tiebreak: ISO beats Off-Ball for non-big positions (G, G/F, SF, F)
    const isoBig = (inputs.position === "C" || inputs.position === "PF" || inputs.position === "F/C" || inputs.position === "C/F");
    if (!isoBig) {
      if (a.label === "ISO") return -1;
      if (b.label === "ISO") return 1;
    }
    return 0;
  });
  const primary   = threats[0];
  const secondary = threats[1];

  // ── Scoring type — from PRIMARY situation only ────────────────────────────
  let scoringType: InternalProfileModel["scoringType"] = "Balanced";
  if (primary.label === "Post") {
    scoringType = "Post Scorer";
  } else if (primary.label === "ISO") {
    if (isoDecision === "Finish")      scoringType = athHigh ? "Driver" : "Balanced";
    else if (isoDecision === "Shoot")  scoringType = "Shooter";
    else if (isoDecision === "Pass")   scoringType = "Playmaker";
  } else if (primary.label === "PnR") {
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
  let mainArchetype = "Role Player";
  let subArchetype  = "";

  // Special interior cases (highest priority)
  if (isInterior && isPrimary(inputs.postFrequency) && pnrIsHandler
      && isActive(inputs.pnrFrequency) && (visionHigh || inputs.pnrScoringPriority === "Pass First")) {
    mainArchetype = "Versatile Big";                          // Jokic
  } else if (isInterior && isActive(inputs.postFrequency)
      && (isPrimary(inputs.isoFrequency) || (isActive(inputs.isoFrequency) && isoDanger >= 8 && isoDecision === "Shoot"))
      && postDanger >= 7 && isoDanger >= 7) {
    mainArchetype = "Multi-Level Scorer";                      // Embiid, Stewart, Jonquel — post active + PERIMETER threat (Shoot decision)
  } else if (isInterior && internal.isConnector) {
    mainArchetype = "Playmaking Big";                          // Draymond, Bam
  } else if (isInterior && isNever(inputs.postFrequency) && isActive(inputs.pnrFrequency)
      && pnrIsScreener
      && (inputs.pnrScreenerAction === "Pop" || inputs.pnrScreenerAction === "Pop (Elbow / Mid)")
      && inputs.closeoutReaction === "Catch & Shoot") {
    mainArchetype = "Stretch Big";                             // Brook Lopez
  } else if (primary.label === "Post") {
    if (isInterior && !isPrimary(inputs.isoFrequency) && !isPrimary(inputs.pnrFrequency))
      mainArchetype = "Traditional Post Scorer";               // A'ja Wilson, Kalani Brown — post dominant, no other PRIMARY threat
    else if (isInterior)
      mainArchetype = "Low Post Scorer";                       // Lofton, Willy — post + active PnR handler or ISO Primary
    else if (postProfile === "Face-Up" || postProfile === "High Post")
      mainArchetype = "Inside-Out Threat";
    else
      mainArchetype = "Low Post Scorer";
  } else if (primary.label === "ISO") {
    if (scoringType === "Driver")
      mainArchetype = (isPrimary(inputs.isoFrequency) && isPrimary(inputs.pnrFrequency) && pnrIsHandler)
        ? "Offensive Engine" : (athHigh ? "Isolation Driver" : "Isolation Scorer");
    else if (scoringType === "Shooter")
      mainArchetype = (isPrimary(inputs.isoFrequency) && isPrimary(inputs.pnrFrequency) && pnrIsHandler)
        ? "Offensive Engine" : "Shot Creator";
    else if (scoringType === "Playmaker")
      mainArchetype = "Combo Guard";
    else
      mainArchetype = "Isolation Scorer";
  } else if (primary.label === "PnR") {
    if (pnrIsHandler) {
      if      (scoringType === "Playmaker")  mainArchetype = "PnR Maestro";
      else if (scoringType === "Driver")
        mainArchetype = (isActive(inputs.isoFrequency) && isoDanger >= 8)
          ? "Offensive Engine" : "PnR Maestro";
      else if (scoringType === "Shooter")
        mainArchetype = (isPrimary(inputs.isoFrequency) && isPrimary(inputs.pnrFrequency))
          ? "Offensive Engine" : "PnR Shooter";
      else mainArchetype = "PnR Creator";
    } else {
      if      (inputs.pnrScreenerAction === "Roll" || inputs.pnrScreenerAction === "Lob Only")
        mainArchetype = "Roll Man / Lob Threat";
      else if (inputs.pnrScreenerAction === "Pop" || inputs.pnrScreenerAction === "Pop (Elbow / Mid)")
        mainArchetype = isInterior ? "Stretch Big" : "Pick & Pop Wing";
      else if (inputs.pnrScreenerAction === "Short Roll")
        mainArchetype = internal.isConnector ? "Playmaking Big" : "Short Roll Big";
      else
        mainArchetype = "Slip Threat";
    }
  } else { // Off-Ball primary
    if (scoringType === "Shooter")
      mainArchetype = isPrimary(inputs.indirectsFrequency) ? "Movement Shooter" : "Spot-up Shooter";
    else if (scoringType === "Driver")
      mainArchetype = "Cutting Threat";
    else
      mainArchetype = "3&D Wing";
  }

  if (internal.isConnector && mainArchetype === "Role Player")
    mainArchetype = isInterior ? "Playmaking Big" : "Connector";
  if (mainArchetype === "Role Player" && threats[0].score >= 5)
    mainArchetype = "Complementary Piece";

  // Guard rail: never assign post archetype when postFrequency is Never/Rare
  if (isNever(inputs.postFrequency) &&
      (mainArchetype === "Traditional Post Scorer" || mainArchetype === "Low Post Scorer"
       || mainArchetype === "Inside-Out Threat")) {
    mainArchetype = inputs.closeoutReaction === "Catch & Shoot" ? "3&D Wing" : "Complementary Piece";
  }
  // Guard rail: 3&D Wing when all danger scores very low + catch & shoot
  if (threats[0].score < 4 && inputs.closeoutReaction === "Catch & Shoot") {
    mainArchetype = "3&D Wing";
  }

  // Sub-archetype — only if secondary is genuinely significant AND comes from active input
  const secondaryIsReal = secondary.score >= 6 && (
    (secondary.label === "Post"     && isActive(inputs.postFrequency))  ||
    (secondary.label === "ISO"      && isActive(inputs.isoFrequency))   ||
    (secondary.label === "PnR"      && isActive(inputs.pnrFrequency))   ||
    (secondary.label === "Off-Ball" && isActive(inputs.transitionFrequency))
  );
  if (secondaryIsReal)
    subArchetype = { Post: "Post Threat", ISO: "ISO Threat",
      PnR: "PnR Threat", "Off-Ball": "Off-Ball Threat" }[secondary.label] ?? "";

  // ── Interpreted traits ────────────────────────────────────────────────────
  // Rule: interpret, don't echo. Max 3 per section. Score drives selection.
  // Each trait = one defensive action the player must take.

  // ── POST TRAITS ────────────────────────────────────────────────────────────
  if (postDanger >= 5) {
    // 1. Profile — what kind of post scorer
    const physDesc = physHigh ? "physical bully" : physLow ? "finesse post scorer" : "post scorer";
    const profileLine =
      postProfile === "Back to Basket"  ? `Classic ${physDesc}. Back to the basket, works both blocks.` :
      postProfile === "Face-Up"         ? `Face-up ${physDesc}. Can attack off the dribble from the elbow.` :
      postProfile === "High Post"       ? `High post threat. Operates from the elbow — shoot, drive, or pass.` :
      postProfile === "Stretch Big"     ? `Interior + perimeter threat. Can score from the post AND the arc.` :
      postProfile === "Mixed"           ? `Versatile post scorer — back-to-basket and face-up. No safe angle.` :
      `Post scorer. Watch both blocks.`;
    internal.postTraits.push({
      label: isPrimary(inputs.postFrequency) ? "Primary Post Scorer" : "Post Threat",
      value: profileLine,
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

      // Build an interpreted sentence, not a list
      let moveRead = "";
      if (strongBaseline && strongMiddle) {
        moveRead = `Dominates the ${strongBlock} block in both directions: ${strongBaseline.moveName} to the baseline, ${strongMiddle.moveName} to the middle. No safe coverage from that side.`;
      } else if (strongBaseline && !weakBaseline) {
        moveRead = `Go-to: ${strongBaseline.moveName} from the ${strongBlock} block baseline. No established move on the ${weakBlock} block baseline — push there.`;
      } else if (strongMiddle && !weakMiddle) {
        moveRead = `Primary: ${strongMiddle.moveName} to the middle from the ${strongBlock} block. Weak quadrant: ${weakBlock} block middle.`;
      } else if (Object.values(q).filter(Boolean).length >= 3) {
        moveRead = `Comfortable in multiple quadrants. No easy forced side — double early.`;
      }
      if (moveRead) {
        internal.postTraits.push({ label: "Move Pattern", value: moveRead, score: postDanger - 1, type: "Strength" });
      }
    }

    // 3. Double team behavior — critical for help defense
    if (isPrimary(inputs.postFrequency) && inputs.postDoubleTeamReaction) {
      const dtLine =
        inputs.postDoubleTeamReaction === "Forces Through" ? "Forces through doubles — aggressive doubling can backfire. Be selective." :
        inputs.postDoubleTeamReaction === "Kicks Out"      ? "Smart on doubles — kicks out immediately. Tag all perimeter players before helping." :
        inputs.postDoubleTeamReaction === "Resets"         ? "Resets on doubles — safe to double. No penalty." :
        "Variable on doubles — read in-game.";
      internal.postTraits.push({ label: "On the Double", value: dtLine, score: postDanger - 2, type: "Strength" });
    }

    // 4. Duck-in / opportunistic interior
    if (isActive(inputs.duckInFrequency ?? "Never")) {
      internal.postTraits.push({
        label: "Duck-In",
        value: isPrimary(inputs.duckInFrequency ?? "Never")
          ? "Seals defenders mid-play constantly. Must be bodied before they catch — body up before."
          : "Reads mismatches and ducks in. Watch for the seal on every possession.",
        score: postDanger - 2, type: "Strength",
      });
    }
  }

  internal.postTraits.sort((a, b) => b.score - a.score);
  internal.postTraits = internal.postTraits.slice(0, 3);

  // ── ISO TRAITS ─────────────────────────────────────────────────────────────
  if (isoDanger >= 5) {
    // 1. Attack style — interpret isoDecision + athleticism + initiation together
    const initStyle = inputs.isoInitiation === "Quick Attack"
      ? "attacks immediately off the catch — no time to get set"
      : "jab-step reader — wait for the jab — read before closing out";

    let attackLine = "";
    if (isInterior && !internal.isHybridBig && inputs.postIsoAction && inputs.postIsoAction !== "Mixed") {
      const interior: Record<string, string> = {
        "Back Down":    "backs defenders into the paint from the high post.",
        "Face-Up Drive":"faces up and attacks off the dribble from the elbow.",
        "Post Jumper":  "pull-up mid-range from post position — hard to time.",
        "Turnaround":   "turnaround jumper — spins before you can react.",
        "Spin":         "spin move creates separation in tight spaces.",
      };
      attackLine = interior[inputs.postIsoAction] ?? "interior creator.";
    } else if (isoDecision === "Finish") {
      attackLine = athElite
        ? `Elite athlete — ${initStyle}. Gets downhill instantly, finishes through contact.`
        : athHigh
        ? `Explosive — ${initStyle}. Drives hard to the rim.`
        : `Drives to finish — ${initStyle}. Not an athlete but reads well.`;
    } else if (isoDecision === "Shoot") {
      attackLine = `Pull-up shooter — ${initStyle}. Creates space off the dribble for the jumper.`;
    } else {
      attackLine = visionHigh
        ? `Creates advantage and distributes. Elite vision — the open man always gets it.`
        : `Creates and distributes. Watch for the kick-out.`;
    }
    internal.isoTraits.push({
      label: isPrimary(inputs.isoFrequency) ? "Primary Scorer" : "Secondary Creator",
      value: attackLine, score: isoDanger, type: "Strength",
    });

    // 2. Directional — most actionable single piece of info
    if (internal.dominantSide !== "Ambidextrous" && isActive(inputs.isoFrequency)) {
      const weak = internal.dominantSide === "Right" ? "left" : "right";
      const wl   = inputs.isoOppositeFinish === "Pull-up" ? "pull-up jumper"
                 : inputs.isoOppositeFinish === "Drive"   ? "rim drive"
                 : inputs.isoOppositeFinish === "Floater"  ? "floater"
                 : "weaker option";
      internal.isoTraits.push({
        label: "Force Direction",
        value: `Force ${weak} — almost exclusively goes ${internal.dominantSide.toLowerCase()}. Only answer going ${weak} is a ${wl}.`,
        score: 9, type: "Strength",
      });
    }

    // 3. Closeout — uses per-wing data when available, falls back to general
    const leftCloseout  = inputs.closeoutLeft  ?? inputs.closeoutReaction;
    const rightCloseout = inputs.closeoutRight ?? inputs.closeoutReaction;
    const closeLinesMap: Record<string, string> = {
      "Catch & Shoot":      "shoots immediately — never leave open.",
      "Attack Baseline":    "attacks baseline — cut off the baseline — no room to turn.",
      "Attack Middle":      "attacks middle — stay balanced, do not fly at them.",
      "Attacks Strong Hand":"always attacks dominant side on closeouts — predictable but explosive.",
      "Attacks Weak Hand":  "attacks weak hand on closeouts — unexpected move.",
      "Extra Pass":         "swings on closeouts — find the skip-pass target.",
    };

    let closeoutLine = "";
    if (leftCloseout !== rightCloseout) {
      // Per-wing data available — give specific read
      closeoutLine = `Left wing: ${closeLinesMap[leftCloseout] ?? leftCloseout} Right wing: ${closeLinesMap[rightCloseout] ?? rightCloseout}`;
    } else {
      closeoutLine = closeLinesMap[inputs.closeoutReaction] ?? "reads the closeout.";
    }
    internal.isoTraits.push({ label: "Closeout", value: closeoutLine, score: 8, type: "Strength" });

    // Interior perimeter threat
    if (isInterior && isActive(perimeterThreat)) {
      internal.isoTraits.push({
        label: "Perimeter Threat",
        value: isPrimary(perimeterThreat)
          ? "Primary three-point threat for an interior player. Cannot be left open at the arc — contests every catch."
          : "Secondary perimeter shooter. Do not sag off entirely — will take the the open triple.",
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
      const coverageLine = punishesUnder
        ? inputs.pnrReactionVsUnder === "Pull-up 3"
          ? "Punishes under-coverage with the pull-up three. Must go OVER every screen — no exceptions."
          : "Attacks under-coverage downhill. Going under is a drive layup. Must go OVER."
        : "Does not punish going under the screen. Under coverage is safe — pack the paint.";
      internal.pnrTraits.push({ label: "Screen Coverage", value: coverageLine, score: pnrDanger, type: "Strength" });

      // 2. Scoring vs passing — pass-first changes the entire defensive assignment
      if (inputs.pnrScoringPriority === "Pass First" && isPrimary(inputs.pnrFrequency)) {
        const visionLine = visionHigh
          ? "Pass-first handler with elite vision. Tags the roll man instantly. All shooters must be tagged before the screen is set."
          : "Pass-first handler. Finds the roll man on every switch or tag — communicate coverage early.";
        internal.pnrTraits.push({ label: "Pass-First", value: visionLine, score: pnrDanger - 1, type: "Strength" });
      }

      // 3. Timing — drag screens change transition rules
      if (inputs.pnrTiming === "Early (Drag)" && isActive(inputs.pnrFrequency)) {
        internal.pnrTraits.push({
          label: "Drag Screen",
          value: "Runs drag screens in transition — sets the PnR before the defense is set. Pick up full court or get caught in an early mismatch.",
          score: pnrDanger - 1, type: "Strength",
        });
      }

      // 4. Dominant finish — funnel instruction
      if (inputs.pnrDominantFinish && inputs.pnrOppositeFinish && inputs.pnrDominantFinish !== inputs.pnrOppositeFinish) {
        const wl = { "Pull-up": "pull-up", "Drive to Rim": "rim drive", "Floater": "floater", "Mid-range": "mid-range" }[inputs.pnrOppositeFinish] ?? inputs.pnrOppositeFinish;
        internal.pnrTraits.push({
          label: "Funnel Direction",
          value: `Funnel PnR to weaker side — primary: ${inputs.pnrDominantFinish}. Weaker option: ${wl}.`,
          score: pnrDanger - 2, type: "Strength",
        });
      }
    } else { // Screener
      const screenerReads: Record<string, string> = {
        "Roll":              "Hard roll to the rim. Tag immediately or catches at the dunker spot.",
        "Pop":               "Pops to the arc. Must be picked up — open three.",
        "Pop (Elbow / Mid)": "Elbow pop — shoot mid-range or find the cutter. Two reads for the defense.",
        "Short Roll":        `Short rolls to the free throw line. Shoot, drive, or distribute.${visionHigh ? " Elite vision — makes the right read every time." : ""}`,
        "Slip":              "Slips before the screen is set. Treat as a cutter on every PnR.",
        "Lob Only":          "Lob-only threat. Deny the alley-oop — no other option.",
      };
      let screenerLine = screenerReads[inputs.pnrScreenerAction] ?? "Active screener.";
      if (inputs.pnrScreenerActionSecondary) {
        const secLine: Record<string, string> = {
          "Roll": "rolls if tagged", "Pop": "pops to arc if tagged",
          "Pop (Elbow / Mid)": "pops to elbow if tagged", "Short Roll": "short rolls",
          "Slip": "slips early", "Lob Only": "lob threat",
        };
        screenerLine += ` When stopped: ${secLine[inputs.pnrScreenerActionSecondary] ?? "reads coverage"}.`;
      }
      internal.pnrTraits.push({ label: "Screen Action", value: screenerLine, score: pnrDanger, type: "Strength" });
    }

    // Dual role note
    if (inputs.pnrRole === "Both" && isActive(inputs.pnrFrequency)) {
      internal.pnrTraits.push({
        label: "Dual Role",
        value: "Plays handler AND screener. Defense must communicate the role before each action — reads who checks.",
        score: pnrDanger - 2, type: "Strength",
      });
    }
  }

  internal.pnrTraits.sort((a, b) => b.score - a.score);
  internal.pnrTraits = internal.pnrTraits.slice(0, 3);

  // ── OFF-BALL TRAITS ────────────────────────────────────────────────────────
  if (offBallDanger >= 5) {
    const transReads: Record<string, string> = {
      Pusher:       "Pushes the ball full court. Pick up before half court — does not stop.",
      Outlet:       `Runs the outlet wing for catch-and-shoot threes.${athHigh ? " Elite speed — deny the catch." : ""}`,
      "Rim Runner": `Sprints to the rim.${athElite ? " Gets there before most defenses — wall up early." : " Get back first."}`,
      Trailer:      "Trailers for pull-up threes on kick-backs. Tag on every made basket.",
    };
    if (isPrimary(inputs.transitionFrequency)) {
      internal.offBallTraits.push({
        label: "Transition",
        value: transReads[inputs.transitionRole] ?? "Active transition player.",
        score: offBallDanger, type: "Strength",
      });
    }

    if (isPrimary(inputs.backdoorFrequency) || (isActive(inputs.backdoorFrequency) && athHigh)) {
      internal.offBallTraits.push({
        label: "Backdoor",
        value: athElite
          ? "Elite backdoor cutter — any over-denial is an uncontested layup. Stay connected at all times."
          : "Active backdoor cutter. Any reach or over-denial gets punished.",
        score: offBallDanger - 1, type: "Strength",
      });
    }

    if (isPrimary(inputs.indirectsFrequency)) {
      const slipNote = isActive(inputs.slipFrequency ?? "Never")
        ? " Also slips screens — defend the cut, not just the screen." : "";
      internal.offBallTraits.push({
        label: "Off Screens",
        value: `Constant off-screen movement. Cannot be left for a second.${slipNote}`,
        score: offBallDanger - 1, type: "Strength",
      });
    } else if (isActive(inputs.slipFrequency ?? "Never")) {
      internal.offBallTraits.push({
        label: "Slip Threat",
        value: "Slips off-ball screens — cuts before the screen is set. Defend the cut.",
        score: offBallDanger - 2, type: "Strength",
      });
    }

    if (isPrimary(inputs.offensiveReboundFrequency)) {
      internal.offBallTraits.push({
        label: "Crashing",
        value: physHigh
          ? "Crashes every shot with physical box-out. Must be bodied, not just found."
          : "Crashes every shot. Box out before the shot, not after.",
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
    const wl   = inputs.isoOppositeFinish === "Pull-up" ? "pull-up"
               : inputs.isoOppositeFinish === "Drive"   ? "rim drive"
               : inputs.isoOppositeFinish === "Floater"  ? "floater"
               : "weaker option";
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
    const wl = { "Pull-up": "pull-up", "Drive to Rim": "rim drive", "Floater": "floater", "Mid-range": "mid-range" }[inputs.pnrOppositeFinish] ?? inputs.pnrOppositeFinish;
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

  return {
    internalModel: internal,
    archetype: mainArchetype,
    subArchetype,
    keyTraits,
    defensivePlan: {
      defender: defender.slice(0, 3),
      forzar:   forzar.slice(0, 3),
      concede:  concede.slice(0, 3),
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
