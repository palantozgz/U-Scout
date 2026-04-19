/**
 * Quick debug script for Pika's motor output
 * Run: npx tsx scripts/debug-pika.ts
 */
import { generateMotorV4 } from "../client/src/lib/motor-v4";
import { renderReport } from "../client/src/lib/reportTextRenderer";

// Pika's motor inputs — as they arrive after playerInputToMotorInputs mapping
// PnR primary handler, transition pusher (dribble push), deepRange secondary, avoids contact, vision 5
const pikaMotorInputs = {
  pos: "PG" as const,
  hand: "R" as const,
  ath: 4 as const,
  phys: 3 as const,
  usage: "primary" as const,
  selfCreation: "high" as const,
  starPlayer: false,
  personality: null,
  // Frequencies
  isoFreq: "N" as const,
  pnrFreq: "P" as const,
  postFreq: "N" as const,
  transFreq: "P" as const,
  spotUpFreq: "S" as const,   // perimeterThreats=Secondary + deepRange
  dhoFreq: "N" as const,
  cutFreq: "N" as const,
  indirectFreq: "N" as const,
  // Role
  vision: 5 as const,
  // Finishing
  offHandFinish: "capable" as const,  // closeoutReaction = Catch&Shoot maps to capable
  floater: "N" as const,
  contactFinish: "avoids" as const,   // contactType = avoids
  // ISO details (none)
  isoDir: null,
  isoDec: null,
  isoEff: null,
  isoStartZone: null,
  isoStrongHandFinish: null,
  isoWeakHandFinish: null,
  // Post (none)
  postProfile: null,
  postZone: null,
  postShoulder: null,
  postEff: null,
  postMoves: null,
  postEntry: null,
  highPostZones: null,
  dunkerSpot: null,
  offBallRole: null,
  motorTransitionPrimary: null,
  rimRunFrequency: null,
  trailFrequency: null,
  offBallScreenPattern: null,
  offBallScreenPatternFreq: null,
  isoStrongHandFinish: null,
  isoWeakHandFinish: null,
  transFinishing: "medium" as const,
  // Spot-up
  spotUpAction: "shoot" as const,
  spotZone: null,
  deepRange: true,
  // PnR details
  pnrPri: "SF" as const,
  pnrEff: "high" as const,
  pnrEffLeft: null,
  pnrEffRight: null,
  pnrFinishLeft: "Pull-up" as const,
  pnrFinishRight: "Drive to Rim" as const,
  trapResponse: "pass" as const,       // vision=5, pnrFreq=P → inferred pass
  // Screener (Pika is handler, not screener)
  screenerAction: null,
  pnrScreenTiming: null,
  popRange: "three" as const,
  offBallScreenerAction: null,
  offBallCutAction: null,
  // DHO
  dhoRole: null,
  dhoAction: null,
  // Transition — pusher with dribble push
  transRole: "fill" as const,          // motorTransRole = fill (pusher maps to fill)
  transRolePrimary: "pusher" as const,
  transRoleSecondary: "runner" as const,
  transSubPrimary: "dribble_push",
  transSubSecondary: null,
  // Ball handling
  ballHandling: "elite" as const,
  pressureResponse: null,
  // Cut
  cutType: null,
  orebThreat: "low" as const,
  freeCutsFrequency: "Never" as const,
  freeCutsType: null,
  putbackQuality: null,
};

const clubCtx = { gender: "F" as const };
const result = generateMotorV4(pikaMotorInputs as any, clubCtx);
const rendered = renderReport(result, { locale: "en", gender: "f" });

console.log("=== PIKA DEBUG ===");
console.log("archetype:", result.identity.archetypeKey);
console.log("danger:", result.identity.dangerLevel, "| difficulty:", result.identity.difficultyLevel);
console.log("situations:", result.situations.slice(0, 5).map(s => `${s.id}(${s.score.toFixed(2)}/${s.tier})`).join(", "));
console.log("");
console.log("DENY winner:", result.defense.deny.winner.key, "score:", result.defense.deny.winner.score?.toFixed(2));
console.log("DENY alts:", result.defense.deny.alternatives.map(a => `${a.key}(${a.score?.toFixed(2)})`).join(", "));
console.log("FORCE winner:", result.defense.force.winner.key, "score:", result.defense.force.winner.score?.toFixed(2));
console.log("FORCE alts:", result.defense.force.alternatives.map(a => `${a.key}(${a.score?.toFixed(2)})`).join(", "));
console.log("ALLOW winner:", result.defense.allow.winner.key);
console.log("alerts:", result.alerts.map(a => `${a.key}(${a.mechanismType})`).join(", "));
console.log("");
console.log("RENDERED DENY:", rendered.defense.deny.instruction);
console.log("RENDERED FORCE:", rendered.defense.force.instruction);
console.log("RENDERED ALLOW:", rendered.defense.allow.instruction);
console.log("");

// What does the scout want?
// "Force her left" — Pika is PG, hand=R. Force left = force to weak side.
// hand R → weak side = L. We need force_direction or force_weak_hand pointing L.
// isoDir=null (no ISO), offHandFinish=capable → no force_weak_hand generated.
// We need isoDir to be set OR offHandFinish to be weak.

console.log("=== WHY NO FORCE LEFT? ===");
console.log("hand:", pikaMotorInputs.hand, "→ weak side would be: L");
console.log("isoDir:", pikaMotorInputs.isoDir, "(null = no ISO direction force)");
console.log("offHandFinish:", pikaMotorInputs.offHandFinish, "(not 'weak' = no force_weak_hand)");
console.log("contactFinish:", pikaMotorInputs.contactFinish, "(avoids = could generate force_contact but supressed by spotUp)");
console.log("");
console.log("FIX: isoOppositeFinish=No (stays on attack side) → isoWeakHandFinish=drive → if ISO N but PnR P,");
console.log("the direction should come from pnrFinishLeft/Right asymmetry OR from a directional input.");
console.log("pnrFinishLeft:", pikaMotorInputs.pnrFinishLeft, "| pnrFinishRight:", pikaMotorInputs.pnrFinishRight);
