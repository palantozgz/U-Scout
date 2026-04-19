/**
 * Debug Pika — inputs reales según descripción del entrenador
 * Mano derecha, tiradora mid-range en PnR ambos lados, spot-up primaria,
 * quick attack, stays same side, vision 4, trapResponse struggle (blitz)
 */
import { generateMotorV4 } from "../client/src/lib/motor-v4";
import { renderReport } from "../client/src/lib/reportTextRenderer";

const pikaMotorInputs = {
  pos: "PG" as const,
  hand: "R" as const,
  ath: 4 as const,
  phys: 3 as const,
  usage: "primary" as const,
  selfCreation: "high" as const,
  starPlayer: false,
  personality: null,

  // Frecuencias
  isoFreq: "N" as const,       // No hace ISO puro
  pnrFreq: "P" as const,       // PnR primaria
  postFreq: "N" as const,
  transFreq: "P" as const,
  spotUpFreq: "P" as const,    // Spot-up primaria (catch & shoot en closeout)
  dhoFreq: "N" as const,
  cutFreq: "N" as const,
  indirectFreq: "N" as const,

  // Role
  vision: 4 as const,          // IQ colectivo bueno pero no elite bajo presión
  selfCreation: "high" as const,
  usage: "primary" as const,

  // Finishing
  offHandFinish: "capable" as const,
  floater: "N" as const,
  contactFinish: "avoids" as const,

  // ISO (no hace ISO, pero cuando presionan va a mano fuerte)
  isoDir: null,
  isoDec: null,
  isoEff: null,
  isoStartZone: null,
  isoStrongHandFinish: null,
  isoWeakHandFinish: null,

  // Post
  postProfile: null,
  postZone: null,
  postShoulder: null,
  postEff: null,
  postMoves: null,
  postEntry: null,
  highPostZones: null,
  dunkerSpot: null,

  // Spot-up — tira de 3 cuando le dan espacio, closeout → prioriza tiro
  spotUpAction: "shoot" as const,
  spotZone: null,
  deepRange: true,             // Tira de 3 cuando under → tiene rango

  // PnR — handler, ambos lados mid-range, no llega al aro
  pnrPri: "SF" as const,
  pnrEff: "high" as const,
  pnrEffLeft: null,
  pnrEffRight: null,
  pnrFinishLeft: "Mid-range" as const,   // Por la izquierda: mid-range
  pnrFinishRight: "Mid-range" as const,  // Por la derecha: mid-range (su strength)
  trapResponse: "struggle" as const,     // Lucha contra hard hedge/blitz colectivo

  // Screener
  screenerAction: null,
  pnrScreenTiming: null,
  popRange: "three" as const,
  offBallRole: null,
  offBallScreenerAction: null,
  offBallCutAction: null,
  motorTransitionPrimary: null,
  rimRunFrequency: null,
  trailFrequency: null,
  offBallScreenPattern: null,
  offBallScreenPatternFreq: null,

  // DHO
  dhoRole: null,
  dhoAction: null,

  // Transición — pusher
  transRole: "fill" as const,
  transRolePrimary: "pusher" as const,
  transRoleSecondary: "runner" as const,
  transSubPrimary: "dribble_push",
  transSubSecondary: null,
  transFinishing: "medium" as const,
  isoStrongHandFinish: null,
  isoWeakHandFinish: null,

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

console.log("=== PIKA (inputs reales) ===");
console.log("archetype:", result.identity.archetypeKey);
console.log("danger:", result.identity.dangerLevel, "| difficulty:", result.identity.difficultyLevel);
console.log("situations:", result.situations.slice(0, 4).map((s: any) => `${s.id}(${s.score.toFixed(2)})`).join(", "));
console.log("");
console.log("DENY winner:", result.defense.deny.winner.key, "→", rendered.defense.deny.instruction);
console.log("FORCE winner:", result.defense.force.winner.key, "→", rendered.defense.force.instruction);
console.log("FORCE alts:", result.defense.force.alternatives.map((a: any) => `${a.key}(${a.score?.toFixed(2)})`).join(", "));
console.log("ALLOW winner:", result.defense.allow.winner.key);
console.log("alerts:", result.alerts.map((a: any) => a.key).join(", "));
console.log("");
console.log("pnrFinishLeft:", pikaMotorInputs.pnrFinishLeft, "| pnrFinishRight:", pikaMotorInputs.pnrFinishRight);
console.log("deepRange:", pikaMotorInputs.deepRange, "| spotUpFreq:", pikaMotorInputs.spotUpFreq);
console.log("trapResponse:", pikaMotorInputs.trapResponse, "| vision:", pikaMotorInputs.vision);
