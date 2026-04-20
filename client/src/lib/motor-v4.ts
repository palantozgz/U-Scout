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
    if (sit === "misc") continue; // misc outputs are not displayable situations
    const current = map.get(sit);
    if (!current || output.weight > current.maxWeight) {
      map.set(sit, { maxWeight: output.weight, topSource: output.source });
    }
  }

  const entries = Array.from(map.entries());
  // Normalize scores relative to the profile's top situation (max=100 in UI)
  // This prevents all situations showing 100 when all weights are near 1.0
  const maxWeight = entries.reduce((m, [, { maxWeight: w }]) => Math.max(m, w), 0);
  const normalize = maxWeight > 0 ? (w: number) => w / maxWeight : (w: number) => w;

  return entries
    .map(([sit, { maxWeight: w, topSource }]) => {
      const normalized = normalize(w);
      return {
        id: bucketToSituationId(sit, inputs),
        score: normalized,
        tier:
          normalized >= 0.85
            ? ("primary" as const)
            : normalized >= 0.65
              ? ("secondary" as const)
              : ("situational" as const),
        source: topSource,
      };
    })
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
  forceWinnerKey?: string,
): DefenseInstruction {
  const sorted = rawOutputs
    .filter((o) => o.category === category && o.weight > 0)
    .sort((a, b) => b.weight - a.weight);

  // ALLOW suppression: return "none" when allow would be redundant with force
  // or when the key is invalid (situationId concatenated with allow_)
  if (category === 'allow' && forceWinnerKey) {
    const INVALID_ALLOW_KEYS = new Set([
      'allow_iso_right', 'allow_iso_left', 'allow_iso_both',
      'allow_pnr_ball', 'allow_catch_shoot', 'allow_transition',
      'allow_off_ball', 'allow_cut', 'allow_floater', 'allow_oreb', 'allow_misc',
    ]);
    const FORCE_DIRECTION_KEYS = new Set([
      'force_direction', 'force_weak_hand',
    ]);
    const winner = sorted[0];
    if (winner) {
      // Suppress if key is invalid (situationId-based)
      if (INVALID_ALLOW_KEYS.has(winner.key)) {
        return { winner: EMPTY_CANDIDATE, alternatives: [] };
      }
      // Suppress allow_iso when force already covers direction
      if (
        (winner.key === 'allow_iso' || winner.key === 'allow_iso_both') &&
        FORCE_DIRECTION_KEYS.has(forceWinnerKey)
      ) {
        return { winner: EMPTY_CANDIDATE, alternatives: [] };
      }
    }
  }

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
    // For 'allow': derive only from GENUINELY low-threat situations (weight < 0.5).
    // High-weight deny situations must never become "allow" recommendations.
    if (category === 'allow') {
      // If force already covers direction, no allow fallback needed
      const FORCE_DIRECTION_KEYS = new Set(['force_direction', 'force_weak_hand']);
      if (forceWinnerKey && FORCE_DIRECTION_KEYS.has(forceWinnerKey)) {
        return { winner: EMPTY_CANDIDATE, alternatives: [] };
      }
      const denySorted = rawOutputs
        .filter((o) => o.category === 'deny' && o.weight > 0)
        .sort((a, b) => a.weight - b.weight); // ASC — least threatening first
      const genuinelyLow = denySorted.filter(o => o.weight < 0.5);
      if (genuinelyLow.length > 0) {
        const least = genuinelyLow[0];
        const sitId = toSituationId(SOURCE_TO_SITUATION[least.source] ?? 'misc', inputs);
        // Map bucket → valid renderer key (never concatenate allow_ + situationId)
        const bucketToAllowKey = (src: string): string => {
          const b = SOURCE_TO_SITUATION[src] ?? 'misc';
          switch (b) {
            case 'iso': return 'allow_iso';
            case 'pnr': return 'allow_pnr_mid_range';
            case 'screener': return 'allow_post';
            case 'post': return 'allow_post';
            case 'spot': return 'allow_spot_three';
            case 'transition': return 'allow_transition';
            case 'cut': return 'allow_cut';
            default: return 'none';
          }
        };
        const allowKey = bucketToAllowKey(least.source);
        // If mapped to 'none', suppress entirely
        if (allowKey === 'none') return { winner: EMPTY_CANDIDATE, alternatives: [] };
        return {
          winner: { key: allowKey, score: Math.max(1 - least.weight, 0.3), situationRef: sitId, source: least.source },
          alternatives: genuinelyLow.slice(1, 4).map(o => {
            const s = toSituationId(SOURCE_TO_SITUATION[o.source] ?? 'misc', inputs);
            return {
              key: bucketToAllowKey(o.source),
              score: Math.max(1 - o.weight, 0.3),
              situationRef: s,
              source: o.source,
            };
          }).filter(c => c.key !== 'none'),
        };
      }
      // All deny situations high-threat: no allow recommendation needed.
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

function situationToArchetype(
  sitId: SituationId,
  inputs: EnrichedInputs,
): string {
  const isBig = inputs.pos === "PF" || inputs.pos === "C";
  switch (sitId) {
    case "catch_shoot":
      // Stretch big = big + spot-up primary (spacing role)
      // Spot-up shooter = guard/wing with spot-up as primary weapon
      return isBig ? "archetype_stretch_big" : "archetype_spot_up_shooter";
    case "pnr_ball":
      return "archetype_pnr_orchestrator";
    case "iso_right":
    case "iso_left":
    case "iso_both":
      return "archetype_iso_scorer";
    case "post_right":
    case "post_left":
      return "archetype_post_scorer";
    case "post_high":
      // High post primary = stretch big if they have exterior range, else post scorer
      return inputs.deepRange ? "archetype_stretch_big" : "archetype_post_scorer";
    case "pnr_screener":
      // Screener primary = stretch big if deep range, else role player
      return inputs.deepRange ? "archetype_stretch_big" : "archetype_role_player";
    case "transition":
      return "archetype_transition_threat";
    case "cut":
    case "off_ball":
    case "oreb":
      return "archetype_role_player";
    default:
      return "archetype_versatile";
  }
}

function buildIdentity(
  inputs: EnrichedInputs,
  situations: RankedSituation[],
  rawOutputs: MotorOutput[],
): MotorV4Output["identity"] {
  // Primary archetype = top situation by score
  // Sub-archetype = second situation (if meaningfully different from primary)
  const primarySit = situations[0];
  const secondarySit = situations[1];

  let archetypeKey = "archetype_versatile";
  const archetypeCandidates: Candidate[] = [];

  if (primarySit) {
    archetypeKey = situationToArchetype(primarySit.id, inputs);
  }

  // Sub-archetype: only add if meaningfully different from primary
  if (secondarySit) {
    const subKey = situationToArchetype(secondarySit.id, inputs);
    if (subKey !== archetypeKey && subKey !== "archetype_versatile") {
      archetypeCandidates.push({ key: subKey, score: secondarySit.score });
    }
  }

  // Tertiary: third situation if exists and different
  const tertiarySit = situations[2];
  if (tertiarySit && archetypeCandidates.length < 2) {
    const tertiaryKey = situationToArchetype(tertiarySit.id, inputs);
    if (
      tertiaryKey !== archetypeKey &&
      tertiaryKey !== "archetype_versatile" &&
      !archetypeCandidates.some(c => c.key === tertiaryKey)
    ) {
      archetypeCandidates.push({ key: tertiaryKey, score: tertiarySit.score });
    }
  }

  // Role player override: always applies when usage=role,
  // regardless of what situations the motor generates.
  // A role player is defined by their usage, not by their top situation.
  if (inputs.usage === 'role') {
    archetypeKey = 'archetype_role_player';
  }

  // Special case: playmaker
  // High vision + PnR orchestrator = playmaker as sub if not already present
  if (
    archetypeKey === "archetype_pnr_orchestrator" &&
    inputs.vision >= 5 &&
    inputs.pnrPri === "PF" &&
    !archetypeCandidates.some(c => c.key === "archetype_playmaker")
  ) {
    archetypeCandidates.unshift({ key: "archetype_playmaker", score: 0.75 });
    archetypeCandidates.splice(2); // keep max 2
  }

  // dangerLevel uses the absolute max deny weight from motor v2.1 (not normalized).
  // Normalized scores always top at 1.0 → always danger=5. Use raw weights instead.
  const maxAbsoluteWeight = rawOutputs
    .filter((o) => o.category === "deny" && o.weight > 0)
    .reduce((m, o) => Math.max(m, o.weight), 0);
  const dangerLevel = (
    maxAbsoluteWeight >= 0.9 ? 5
    : maxAbsoluteWeight >= 0.75 ? 4
    : maxAbsoluteWeight >= 0.6 ? 3
    : maxAbsoluteWeight >= 0.45 ? 2
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
  const denyInstruction = buildDefenseInstruction(rawOutputs, "deny", enrichedInputs);
  const forceInstruction = buildDefenseInstruction(rawOutputs, "force", enrichedInputs);
  const allowInstruction = buildDefenseInstruction(
    rawOutputs,
    "allow",
    enrichedInputs,
    forceInstruction.winner.key,
  );
  const defense = {
    deny: denyInstruction,
    force: forceInstruction,
    allow: allowInstruction,
  };
  const alerts = buildAlerts(rawOutputs);
  const identity = buildIdentity(enrichedInputs, situations, rawOutputs);

  return {
    inputs: enrichedInputs,
    identity,
    situations,
    defense,
    alerts,
    rawOutputs,
  };
}
