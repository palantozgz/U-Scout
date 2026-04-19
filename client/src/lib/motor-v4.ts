/**
 * Motor v4 — pure scoring layer on top of v2.1 `UScoutMotor.generateReport`.
 * No UI, no i18n strings in outputs (keys + numeric scores only).
 */

import { UScoutMotor } from "./motor-v2.1";
import type {
  PlayerInputs,
  EnrichedInputs,
  ClubContext,
  MotorOutput,
} from "./motor-v2.1";

const _motor = new UScoutMotor();

export type SituationId =
  | "iso_right"
  | "iso_left"
  | "iso_both"
  | "pnr_ball"
  | "pnr_screener"
  | "post_right"
  | "post_left"
  | "post_high"
  | "catch_shoot"
  | "transition"
  | "off_ball"
  | "dho"
  | "cut"
  | "floater"
  | "oreb"
  | "misc";

export interface Candidate {
  key: string;
  score: number;
  situationRef?: SituationId;
  source?: string;
}

export interface RankedSituation {
  id: SituationId;
  score: number;
  tier: "primary" | "secondary" | "situational";
  source: string;
}

export interface DefenseInstruction {
  winner: Candidate;
  alternatives: Candidate[];
}

export interface AlertCandidate {
  key: string;
  triggerKey: string;
  score: number;
  mechanismType: string;
}

export interface MotorV4Output {
  inputs: EnrichedInputs;

  identity: {
    archetypeKey: string;
    archetypeCandidates: Candidate[];
    dangerLevel: 1 | 2 | 3 | 4 | 5;
    difficultyLevel: 1 | 2 | 3 | 4 | 5;
  };

  situations: RankedSituation[];

  defense: {
    deny: DefenseInstruction;
    force: DefenseInstruction;
    allow: DefenseInstruction;
  };

  alerts: AlertCandidate[];

  rawOutputs: MotorOutput[];
}

const SOURCE_TO_SITUATION: Record<string, string> = {
  iso: "iso",
  iso_dir: "iso",
  iso_dir_confirmed: "iso",
  iso_strong_hand_finish: "iso",
  iso_weak_hand_finish: "iso",
  selfish_low_eff: "iso",
  selfish: "iso",
  pnr: "pnr",
  pnr_finish_asymmetry: "pnr",
  trap_response: "pnr",
  escape_pass_first: "pnr",
  pnr_floater_unified: "pnr",
  screener_roll: "screener",
  screener_pop: "screener",
  screener_pop_no_range: "screener",
  screener_slip: "screener",
  screen_timing: "screener",
  data_inconsistency: "screener",
  post: "post",
  post_shoulder: "post",
  post_entry_duck_in: "post",
  post_entry_seal: "post",
  post_rare_efficient: "post",
  post_move_fade: "post",
  post_move_turnaround: "post",
  post_move_hook: "post",
  post_combo_hook_upunder: "post",
  no_post: "post",
  dunker_spot: "post",
  high_post: "post",
  duck_in_rim_runner_unified: "post",
  trans_rim_run: "transition",
  trans_trail: "transition",
  trans_leak: "transition",
  trans_sub: "transition",
  trans_cut_finishing: "transition",
  transition: "transition",
  transition_graded: "transition",
  corner_spot: "spot",
  corner_no_range: "spot",
  no_deep_range: "spot",
  deep_range: "spot",
  no_range_spot_active: "spot",
  dho: "dho",
  cut: "cut",
  cut_compulsive_unified: "cut",
  oreb: "oreb",
  oreb_finisher: "oreb",
  oreb_distributor: "oreb",
  oreb_medium: "oreb",
  oreb_threat: "oreb",
  oreb_and_transition: "oreb",
  off_ball_screen: "offball",
  off_ball_cut: "offball",
  off_ball_roll_rim: "offball",
  off_ball_screen_graded: "offball",
  off_ball_role: "offball",
  floater: "floater",
  contact_avoids: "misc",
  off_hand: "misc",
  contact_weak_hand_combined: "misc",
  self_creation: "misc",
  vision: "misc",
  physical: "misc",
  both_hands: "misc",
  connector: "misc",
  weak_iso: "misc",
  ball_handling_liability: "misc",
  limited_handling_struggles: "misc",
  ball_handling_limited: "misc",
  pressure_struggles: "misc",
  no_range_no_threat: "misc",
  gender_f_interior: "misc",
  interior_low_impact: "misc",
  selfish_exploitable: "misc",
};

function bucketToSituationId(bucket: string, inputs: EnrichedInputs): SituationId {
  switch (bucket) {
    case "iso":
      if (inputs.isoDir === "R") return "iso_right";
      if (inputs.isoDir === "L") return "iso_left";
      return "iso_both";
    case "pnr":
      return "pnr_ball";
    case "screener":
      return "pnr_screener";
    case "post":
      if (inputs.postZone === "high") return "post_high";
      if (inputs.postShoulder === "R") return "post_right";
      if (inputs.postShoulder === "L") return "post_left";
      return "post_right";
    case "spot":
      return "catch_shoot";
    case "transition":
      return "transition";
    case "offball":
      return "off_ball";
    case "dho":
      return "dho";
    case "cut":
      return "cut";
    case "floater":
      return "floater";
    case "oreb":
      return "oreb";
    default:
      return "misc";
  }
}

function toSituationId(v21Situation: string, inputs: EnrichedInputs): SituationId {
  return bucketToSituationId(v21Situation, inputs);
}

function buildSituations(
  rawOutputs: MotorOutput[],
  inputs: EnrichedInputs,
): RankedSituation[] {
  const map = new Map<string, { maxWeight: number; topSource: string }>();

  for (const output of rawOutputs) {
    if (output.category !== "deny" || output.weight === 0) continue;
    const sit = SOURCE_TO_SITUATION[output.source] ?? "misc";
    const current = map.get(sit);
    if (!current || output.weight > current.maxWeight) {
      map.set(sit, { maxWeight: output.weight, topSource: output.source });
    }
  }

  return Array.from(map.entries())
    .map(([sit, { maxWeight, topSource }]) => ({
      id: bucketToSituationId(sit, inputs),
      score: maxWeight,
      tier:
        maxWeight >= 0.75
          ? ("primary" as const)
          : maxWeight >= 0.55
            ? ("secondary" as const)
            : ("situational" as const),
      source: topSource,
    }))
    .sort((a, b) => b.score - a.score);
}

const EMPTY_CANDIDATE: Candidate = {
  key: "none",
  score: 0,
  source: "none",
  situationRef: "misc",
};

function buildDefenseInstruction(
  rawOutputs: MotorOutput[],
  category: "deny" | "force" | "allow",
  inputs: EnrichedInputs,
): DefenseInstruction {
  const sorted = rawOutputs
    .filter((o) => o.category === category && o.weight > 0)
    .sort((a, b) => b.weight - a.weight);

  const toCandidate = (o: MotorOutput): Candidate => ({
    key: o.key,
    score: o.weight,
    source: o.source,
    situationRef: toSituationId(
      SOURCE_TO_SITUATION[o.source] ?? "misc",
      inputs,
    ),
  });

  if (sorted.length === 0) {
    // No outputs for this category from v2.1.
    // For 'allow': derive from least-threatening situation in rawOutputs.
    if (category === 'allow') {
      const denySorted = rawOutputs
        .filter((o) => o.category === 'deny' && o.weight > 0)
        .sort((a, b) => a.weight - b.weight); // ASC — least threatening first
      if (denySorted.length > 0) {
        const least = denySorted[0];
        const sitId = toSituationId(SOURCE_TO_SITUATION[least.source] ?? 'misc', inputs);
        const allowKey = `allow_${sitId}`;
        return {
          winner: { key: allowKey, score: Math.max(1 - least.weight, 0.3), situationRef: sitId, source: least.source },
          alternatives: denySorted.slice(1, 4).map(o => {
            const s = toSituationId(SOURCE_TO_SITUATION[o.source] ?? 'misc', inputs);
            return { key: `allow_${s}`, score: Math.max(1 - o.weight, 0.3), situationRef: s, source: o.source };
          }),
        };
      }
    }
    return { winner: EMPTY_CANDIDATE, alternatives: [] };
  }

  return {
    winner: toCandidate(sorted[0]),
    alternatives: sorted.slice(1, 4).map(toCandidate),
  };
}

function buildAlerts(rawOutputs: MotorOutput[]): AlertCandidate[] {
  const getMechanismType = (key: string): string => {
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

  const awareOutputs = rawOutputs
    .filter((o) => o.category === "aware" && o.weight > 0)
    .sort((a, b) => b.weight - a.weight);

  const seen = new Map<string, AlertCandidate>();
  for (const o of awareOutputs) {
    const mt = getMechanismType(o.key);
    if (!seen.has(mt)) {
      seen.set(mt, {
        key: o.key,
        triggerKey: `${o.key}_trigger`,
        score: o.weight,
        mechanismType: mt,
      });
    }
  }

  return Array.from(seen.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);
}

function buildIdentity(
  inputs: EnrichedInputs,
  situations: RankedSituation[],
): MotorV4Output["identity"] {
  const archetypePriority: Array<[string, boolean]> = [
    [
      "archetype_iso_scorer",
      inputs.usage === "primary" &&
        inputs.isoFreq === "P" &&
        inputs.selfCreation === "high",
    ],
    [
      "archetype_pnr_orchestrator",
      inputs.usage === "primary" &&
        inputs.pnrFreq === "P" &&
        inputs.selfCreation === "high",
    ],
    [
      "archetype_post_scorer",
      (inputs.pos === "PF" || inputs.pos === "C") && inputs.postFreq === "P",
    ],
    [
      "archetype_stretch_big",
      (inputs.pos === "PF" || inputs.pos === "C") && inputs.spotUpFreq === "P",
    ],
    [
      "archetype_playmaker",
      inputs.usage === "primary" &&
        inputs.vision >= 4 &&
        inputs.selfCreation === "high",
    ],
    [
      "archetype_spot_up_shooter",
      inputs.spotUpFreq === "P" && inputs.selfCreation === "low",
    ],
    ["archetype_transition_threat", inputs.transFreq === "P"],
    ["archetype_role_player", inputs.usage === "role"],
    ["archetype_versatile", true],
  ];

  const matched = archetypePriority.filter(([, condition]) => condition);
  const archetypeKey = matched[0]?.[0] ?? "archetype_versatile";
  const archetypeCandidates: Candidate[] = matched.slice(1, 3).map(([key], i) => ({
    key,
    score: i === 0 ? 0.65 : 0.45,
  }));

  const maxScore = situations[0]?.score ?? 0;
  const dangerLevel = (
    maxScore >= 0.9 ? 5
    : maxScore >= 0.75 ? 4
    : maxScore >= 0.6 ? 3
    : maxScore >= 0.45 ? 2
    : 1
  ) as 1 | 2 | 3 | 4 | 5;

  const difficultyLevel = (
    inputs.selfCreation === "high" &&
      inputs.usage === "primary" &&
      inputs.ath >= 4
      ? 5
      : inputs.selfCreation === "high" && inputs.usage === "primary"
        ? 4
        : inputs.selfCreation === "medium" && inputs.usage === "primary"
          ? 3
          : inputs.selfCreation === "low" || inputs.usage === "role"
            ? 2
            : 3
  ) as 1 | 2 | 3 | 4 | 5;

  return { archetypeKey, archetypeCandidates, dangerLevel, difficultyLevel };
}

export function generateMotorV4(
  inputs: PlayerInputs,
  clubContext?: ClubContext,
): MotorV4Output {
  const v21Report = _motor.generateReport(inputs, clubContext);
  const enrichedInputs = v21Report.inputs;
  const rawOutputs = v21Report.rawOutputs;

  const situations = buildSituations(rawOutputs, enrichedInputs);
  const defense = {
    deny: buildDefenseInstruction(rawOutputs, "deny", enrichedInputs),
    force: buildDefenseInstruction(rawOutputs, "force", enrichedInputs),
    allow: buildDefenseInstruction(rawOutputs, "allow", enrichedInputs),
  };
  const alerts = buildAlerts(rawOutputs);
  const identity = buildIdentity(enrichedInputs, situations);

  return {
    inputs: enrichedInputs,
    identity,
    situations,
    defense,
    alerts,
    rawOutputs,
  };
}
