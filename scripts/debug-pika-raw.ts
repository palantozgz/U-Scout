import { generateMotorV4 } from "../client/src/lib/motor-v4";
import { motor } from "../client/src/lib/motor-v2.1";

const pikaMotorInputs: any = {
  pos: "PG", hand: "R", ath: 4, phys: 3, usage: "primary",
  selfCreation: "high", starPlayer: false, personality: null,
  isoFreq: "N", pnrFreq: "P", postFreq: "N", transFreq: "P",
  spotUpFreq: "P", dhoFreq: "N", cutFreq: "N", indirectFreq: "N",
  vision: 4, offHandFinish: "capable", floater: "N", contactFinish: "avoids",
  isoDir: null, isoDec: null, isoEff: null, isoStartZone: null,
  isoStrongHandFinish: null, isoWeakHandFinish: null,
  postProfile: null, postZone: null, postShoulder: null,
  postEff: null, postMoves: null, postEntry: null, highPostZones: null, dunkerSpot: null,
  offBallRole: null, offBallScreenerAction: null, offBallCutAction: null,
  motorTransitionPrimary: null, rimRunFrequency: null, trailFrequency: null,
  offBallScreenPattern: null, offBallScreenPatternFreq: null,
  spotUpAction: "shoot", spotZone: null, deepRange: true,
  pnrPri: "SF", pnrEff: "high", pnrEffLeft: null, pnrEffRight: null,
  pnrFinishLeft: "Mid-range", pnrFinishRight: "Mid-range",
  trapResponse: "struggle",
  screenerAction: null, pnrScreenTiming: null, popRange: "three",
  dhoRole: null, dhoAction: null,
  transRole: "fill", transRolePrimary: "pusher", transRoleSecondary: "runner",
  transSubPrimary: "dribble_push", transSubSecondary: null, transFinishing: "medium",
  ballHandling: "elite", pressureResponse: null,
  cutType: null, orebThreat: "low", freeCutsFrequency: "Never",
  freeCutsType: null, putbackQuality: null,
};

const report = motor.generateReport(pikaMotorInputs, { gender: "F" });
const forceOutputs = report.rawOutputs
  .filter((o: any) => o.category === 'force')
  .sort((a: any, b: any) => b.weight - a.weight);

console.log("=== RAW FORCE OUTPUTS ===");
forceOutputs.forEach((o: any) => {
  console.log(`  ${o.key}: ${o.weight.toFixed(3)} (source: ${o.source})`);
});
