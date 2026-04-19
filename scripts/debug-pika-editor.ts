/**
 * Simula exactamente cómo llegan los inputs de Pika desde el editor
 * incluyendo motorPressureResponse = "struggles"
 */
import { generateMotorV4 } from "../client/src/lib/motor-v4";
import { renderReport } from "../client/src/lib/reportTextRenderer";
import { playerInputToMotorInputs, clubRowToMotorContext } from "../client/src/lib/mock-data";

// Simula los inputs del editor de Pika tal como los guardó Pablo
const editorInputs = {
  position: "PG",
  postDominantHand: "Right",
  athleticism: 4,
  physicalStrength: 3,
  courtVision: 4,           // IQ colectivo bueno, pero no elite bajo presión
  // ISO
  isoFrequency: "Never",
  isoDominantDirection: null,
  isoDecision: null,
  isoStartZone: null,
  motorIsoEff: null,
  // PnR
  pnrFrequency: "Primary",
  pnrRole: "Handler",
  pnrRoleSecondary: null,
  pnrScoringPriority: "Score First",
  pnrFinishBallLeft: "Mid-range",
  pnrFinishBallRight: "Mid-range",
  motorPnrEff: "high",
  pnrEffLeft: null,
  pnrEffRight: null,
  pnrScreenerAction: "Roll",
  pnrScreenTiming: null,
  pnrSnake: null,
  motorPressureResponse: "struggles",  // <-- el campo del editor que el entrenador puso
  // Post
  postFrequency: "Never",
  postQuadrants: null,
  motorPostEff: null,
  motorPostEntry: null,
  motorPostMoves: null,
  // Transición
  transitionFrequency: "Primary",
  transRolePrimary: "pusher",
  transRoleSecondary: "runner",
  transSubPrimary: "dribble_push",
  transSubSecondary: null,
  motorTransRole: "fill",
  motorTransRimIntensity: null,
  motorTransTrail3Intensity: null,
  motorTransitionPrimary: null,
  rimRunFrequency: null,
  trailFrequency: null,
  transFinishing: "medium",
  // Spot-up
  perimeterThreats: "Primary",
  closeoutReaction: "Catch & Shoot",
  // Off-ball
  indirectsFrequency: "Never",
  offBallRole: null,
  offBallScreenPattern: null,
  offBallScreenPatternFreq: null,
  offBallCutAction: null,
  backdoorFrequency: "Never",
  freeCutsFrequency: null,
  freeCutsType: null,
  duckInFrequency: "Never",
  offensiveReboundFrequency: "Never",
  putbackQuality: null,
  // Otros
  contactType: "avoids",
  ftRating: null,
  isoFinishLeft: null,
  isoFinishRight: null,
  isoOppositeFinish: null,
  personality: null,
  motorBallHandling: "elite",
  // Campos requeridos con defaults
  pnrScreenerAction: "Roll",
  motorTransRole: "fill",
};

const motorInputs = playerInputToMotorInputs(editorInputs as any);
const clubCtx = clubRowToMotorContext({ gender: "F" } as any);
const result = generateMotorV4(motorInputs, clubCtx);
const rendered = renderReport(result, { locale: "en", gender: "f" });

console.log("=== PIKA desde editor inputs ===");
console.log("trapResponse inferred:", motorInputs.trapResponse);
console.log("pressureResponse:", motorInputs.pressureResponse);
console.log("vision:", motorInputs.vision);
console.log("");
console.log("DENY:", rendered.defense.deny.instruction);
console.log("FORCE:", rendered.defense.force.instruction);
console.log("ALLOW:", rendered.defense.allow.instruction);
console.log("alerts:", result.alerts.map((a: any) => a.key).join(", "));
