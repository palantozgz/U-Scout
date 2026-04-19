/**
 * U Scout — Motor Calibration Script
 * 
 * Validates motor output quality against known NBA/WNBA player profiles.
 * Each profile has expected outputs based on real scouting knowledge.
 * 
 * Run: npx tsx scripts/calibrate-motor.ts
 * Output: scripts/calibration-results.json
 */

import { generateMotorV4 } from "../client/src/lib/motor-v4";
import { renderReport } from "../client/src/lib/reportTextRenderer";
import * as fs from "fs";

interface Expectation {
  /** Output keys that MUST appear in deny/force/allow/situations */
  deny_must?: string[];
  deny_must_not?: string[];
  force_must?: string[];
  force_must_not?: string[];
  allow_must?: string[];
  allow_must_not?: string[];
  /** Situation IDs that must be in top-3 */
  top_situations?: string[];
  /** Situation IDs that must NOT be in top-3 */
  not_top_situations?: string[];
  archetype_must_contain?: string[];
  /** Min danger level */
  danger_min?: number;
  /** Max danger level */
  danger_max?: number;
  /** Alert keys that must appear */
  alert_keys?: string[];
  alert_keys_not?: string[];
  /** Rendered text must contain these substrings in deny instruction */
  deny_text_contains?: string[];
  force_text_contains?: string[];
  allow_text_contains?: string[];
}

interface CalibrationProfile {
  id: string;
  name: string;
  note: string;
  inputs: any;
  clubContext?: any;
  expect: Expectation;
}

const profiles: CalibrationProfile[] = [

  // ─── NBA STARS ────────────────────────────────────────────────────────────

  {
    id: "cal001",
    name: "Luka Doncic — ISO/PnR Orchestrator",
    note: "Elite ISO+PnR creator, deep range, clutch, escape artist vs traps",
    inputs: {
      pos: "SG", hand: "L", ath: 4, phys: 4, usage: "primary",
      selfCreation: "high", starPlayer: true, personality: ["clutch"],
      isoFreq: "P", isoEff: "high", isoDir: "L", isoDec: "F",
      pnrFreq: "P", pnrEff: "high", pnrPri: "SF", trapResponse: "escape",
      pnrFinishLeft: "Pull-up", pnrFinishRight: "Drive to Rim",
      postFreq: "S", postEff: "medium", postProfile: "FU",
      transFreq: "S", transRole: "pusher",
      spotUpFreq: "R", deepRange: true,
      floater: "S", vision: 5, orebThreat: "low",
      contactFinish: "neutral", offHandFinish: "capable",
      cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      screenerAction: null, ballHandling: "elite", pressureResponse: "escapes",
    },
    expect: {
      deny_must: ["deny_iso_space", "deny_pnr_downhill"],
      deny_must_not: ["deny_trans_rim", "deny_oreb"],
      force_must_not: ["force_early", "force_contact", "force_trap"],
      allow_must_not: ["allow_iso"],
      top_situations: ["iso_left", "pnr_ball"],
      danger_min: 4,
      deny_text_contains: ["left"],
      // Luka escapa de trampas bien — no debe recomendar force_trap
    },
  },

  {
    id: "cal002",
    name: "Nikola Jokic — Post/PnR Passer",
    note: "Dominant post, elite passer, high post playmaker, no exterior threat",
    inputs: {
      pos: "C", hand: "R", ath: 3, phys: 5, usage: "primary",
      selfCreation: "high", starPlayer: true,
      postFreq: "P", postEff: "high", postProfile: "B2B",
      postShoulder: "R", postMoves: ["hook", "fade", "turnaround"],
      postEntry: "seal",
      highPostZones: { leftElbow: "pass_to_cutter", rightElbow: "face_up_drive" },
      pnrFreq: "S", pnrEff: "high", pnrPri: "PF", trapResponse: "escape",
      isoFreq: "R", isoEff: "medium",
      transFreq: "R",
      spotUpFreq: "N", deepRange: false,
      vision: 5, orebThreat: "medium", putbackQuality: "capable",
      contactFinish: "neutral", offHandFinish: "capable",
      floater: "N", cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      screenerAction: null, ballHandling: null, pressureResponse: null,
    },
    expect: {
      deny_must: ["deny_post_entry", "deny_high_post_catch"],
      deny_must_not: ["deny_iso_space", "deny_spot_deep"],
      allow_must: ["allow_spot_three"],
      allow_must_not: ["allow_iso"],
      top_situations: ["post_right"],
      not_top_situations: ["iso_right", "catch_shoot"],
      danger_min: 4,
      alert_keys: ["aware_passer"],
    },
  },

  {
    id: "cal003",
    name: "Stephen Curry — Spot-up + Off-screen",
    note: "Elite spot-up, deep range, off-screen shooter, curl threat",
    inputs: {
      pos: "PG", hand: "R", ath: 4, phys: 2, usage: "primary",
      selfCreation: "high", starPlayer: true,
      spotUpFreq: "P", spotZone: "wing", deepRange: true,
      isoFreq: "S", isoEff: "high",
      pnrFreq: "S", pnrEff: "medium", pnrPri: "SF",
      indirectFreq: "P", offBallCutAction: "catch_and_shoot",
      cutFreq: "S", cutType: "curl",
      transFreq: "S",
      postFreq: "N",
      vision: 4, orebThreat: "low",
      floater: "N",
      contactFinish: "neutral", offHandFinish: "capable",
      dhoFreq: "N", screenerAction: null,
      ballHandling: "elite", pressureResponse: "escapes",
    },
    expect: {
      deny_must: ["deny_spot_deep"],
      deny_must_not: ["deny_post_entry", "deny_oreb"],
      force_must_not: ["force_contact", "force_trap"],
      allow_must_not: ["allow_spot_three"],
      top_situations: ["catch_shoot"],
      danger_min: 4,
      danger_max: 5,
      deny_text_contains: ["deep", "catch"],
    },
  },

  {
    id: "cal004",
    name: "Giannis Antetokounmpo — Drive + Rim",
    note: "Elite driver, PnR handler, no exterior, rim finisher, trap struggles",
    inputs: {
      pos: "PF", hand: "R", ath: 5, phys: 5, usage: "primary",
      selfCreation: "high", starPlayer: true,
      isoFreq: "S", isoEff: "high", isoDir: "R", isoDec: "F",
      pnrFreq: "P", pnrEff: "high", pnrPri: "SF", trapResponse: "struggle",
      postFreq: "R", postEff: "medium",
      transFreq: "P", transRole: "rim_run", transRolePrimary: "rim_runner",
      transFinishing: "high",
      spotUpFreq: "N", deepRange: false,
      orebThreat: "high", putbackQuality: "primary",
      contactFinish: "seeks", offHandFinish: "weak",
      vision: 3, floater: "N",
      cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      screenerAction: null, ballHandling: "capable", pressureResponse: null,
    },
    expect: {
      deny_must: ["deny_pnr_downhill", "deny_trans_rim"],
      deny_must_not: ["deny_spot_deep", "deny_spot_corner"],
      force_must: ["force_trap"],
      allow_must: ["allow_spot_three"],
      allow_must_not: ["allow_iso"],
      top_situations: ["pnr_ball", "transition"],
      danger_min: 5,
      force_text_contains: ["trap", "hedge"],
    },
  },

  {
    id: "cal005",
    name: "Klay Thompson — Spot-up Trail Shooter",
    note: "Corner 3, trail shooter, off-screen curl, no self-creation",
    inputs: {
      pos: "SG", hand: "R", ath: 4, phys: 3, usage: "secondary",
      selfCreation: "low",
      spotUpFreq: "P", spotZone: "corner", deepRange: true,
      transFreq: "P", transRole: "trail", transRolePrimary: "trail",
      trailFrequency: "primary", motorTransitionPrimary: "trail",
      transSubPrimary: "shoot_off_trail",
      cutFreq: "S", cutType: "curl",
      indirectFreq: "S", offBallCutAction: "catch_and_shoot",
      isoFreq: "N", pnrFreq: "N", postFreq: "N",
      vision: 3, orebThreat: "low",
      floater: "N", dhoFreq: "N",
      contactFinish: "neutral", offHandFinish: "capable",
      screenerAction: null, ballHandling: null, pressureResponse: null,
    },
    expect: {
      deny_must: ["deny_spot_corner", "deny_trans_trail"],
      deny_must_not: ["deny_iso_space", "deny_pnr_downhill", "deny_post_entry"],
      force_must_not: ["force_trap", "force_early"],
      allow_must_not: ["allow_spot_three"],
      top_situations: ["catch_shoot", "transition"],
      danger_min: 3,
    },
  },

  {
    id: "cal006",
    name: "Joel Embiid — Post Dominant",
    note: "Dominant post, all moves, high post, max physical, rim threat",
    inputs: {
      pos: "C", hand: "R", ath: 4, phys: 5, usage: "primary",
      selfCreation: "high", starPlayer: true,
      postFreq: "P", postEff: "high", postProfile: "B2B",
      postShoulder: "R", postMoves: ["hook", "fade", "up_and_under", "drop_step"],
      postEntry: "seal",
      highPostZones: { leftElbow: "face_up_drive", rightElbow: "pull_up" },
      pnrFreq: "R", pnrEff: "medium",
      isoFreq: "R", isoEff: "medium",
      transFreq: "N",
      spotUpFreq: "R", deepRange: false,
      orebThreat: "high", putbackQuality: "primary",
      contactFinish: "seeks", offHandFinish: "capable",
      vision: 3, floater: "N",
      cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      screenerAction: null, ballHandling: null, pressureResponse: null,
    },
    expect: {
      deny_must: ["deny_post_entry", "deny_high_post_catch"],
      deny_must_not: ["deny_spot_deep", "deny_trans_rim"],
      force_must_not: ["force_early"],
      allow_must: ["allow_spot_three"],
      top_situations: ["post_right"],
      danger_min: 4,
      alert_keys: ["aware_post_fade", "aware_post_hook"],
    },
  },

  {
    id: "cal007",
    name: "Tyrese Haliburton — PnR Distributor",
    note: "PnR pass-first, elite vision, trap escape, spot-up secondary, DHO giver",
    inputs: {
      pos: "PG", hand: "R", ath: 3, phys: 2, usage: "primary",
      selfCreation: "high",
      pnrFreq: "P", pnrEff: "high", pnrPri: "PF",
      pnrFinishLeft: "Pull-up", pnrFinishRight: "Pass",
      trapResponse: "escape",
      isoFreq: "R", isoEff: "low",
      spotUpFreq: "S", deepRange: true,
      dhoFreq: "S", dhoRole: "giver", dhoAction: "pass",
      transFreq: "S",
      postFreq: "N",
      vision: 5, orebThreat: "low",
      floater: "S", cutFreq: "N", indirectFreq: "N",
      contactFinish: "neutral", offHandFinish: "capable",
      screenerAction: null, ballHandling: "capable", pressureResponse: "escapes",
    },
    expect: {
      deny_must: ["deny_pnr_downhill"],
      deny_must_not: ["deny_post_entry", "deny_oreb"],
      force_must_not: ["force_trap", "force_early"],
      allow_must: ["allow_iso"],
      top_situations: ["pnr_ball"],
      danger_min: 3,
      alert_keys: ["aware_passer"],
    },
  },

  {
    id: "cal008",
    name: "Rudy Gobert — Screener + Rim Runner",
    note: "Pure roll, rim runner, duck-in, no exterior threat, elite rebounder",
    inputs: {
      pos: "C", hand: "R", ath: 4, phys: 5, usage: "role",
      selfCreation: "low",
      screenerAction: "roll", pnrScreenTiming: "holds_long",
      transFreq: "S", transRole: "rim_run", transRolePrimary: "rim_runner",
      transFinishing: "high",
      postFreq: "R", postEntry: "duck_in",
      orebThreat: "high", putbackQuality: "capable",
      isoFreq: "N", pnrFreq: "N",
      spotUpFreq: "N", deepRange: false,
      vision: 2, floater: "N",
      cutFreq: "S", cutType: "basket",
      dhoFreq: "N", indirectFreq: "N",
      contactFinish: "neutral", offHandFinish: "capable",
      ballHandling: null, pressureResponse: null,
    },
    expect: {
      deny_must: ["deny_trans_rim"],
      deny_must_not: ["deny_iso_space", "deny_spot_deep", "deny_pnr_downhill"],
      force_must_not: ["force_early"],
      allow_must: ["allow_spot_three"],
      allow_must_not: ["allow_iso"],
      top_situations: ["transition"],
      danger_min: 2,
      danger_max: 4,
    },
  },

  // ─── WNBA STARS ──────────────────────────────────────────────────────────

  {
    id: "cal009",
    name: "A'ja Wilson — WNBA Post Scorer",
    note: "Elite post scorer, face-up + B2B, high phys, elite efficiency",
    inputs: {
      pos: "PF", hand: "R", ath: 4, phys: 5, usage: "primary",
      selfCreation: "high", starPlayer: true,
      postFreq: "P", postEff: "high", postProfile: "B2B",
      postShoulder: "L", postMoves: ["hook", "fade", "drop_step"],
      postEntry: "seal",
      isoFreq: "S", isoEff: "high", isoDir: "L", isoDec: "F",
      pnrFreq: "R",
      transFreq: "S", transRole: "rim_run",
      spotUpFreq: "R", deepRange: false,
      orebThreat: "high", putbackQuality: "primary",
      contactFinish: "seeks", offHandFinish: "capable",
      vision: 3, floater: "N",
      cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      screenerAction: null, ballHandling: null, pressureResponse: null,
    },
    clubContext: { gender: "F" },
    expect: {
      deny_must: ["deny_post_entry"],
      deny_must_not: ["deny_spot_deep"],
      force_must_not: ["force_early"],
      allow_must: ["allow_spot_three"],
      top_situations: ["post_left"],
      danger_min: 4,
    },
  },

  {
    id: "cal010",
    name: "Breanna Stewart — Versatile Star",
    note: "ISO + PnR + post, deep range, elite athleticism, WNBA superstar",
    inputs: {
      pos: "PF", hand: "R", ath: 5, phys: 4, usage: "primary",
      selfCreation: "high", starPlayer: true,
      isoFreq: "P", isoEff: "high", isoDir: "R", isoDec: "F",
      pnrFreq: "S", pnrEff: "high", pnrPri: "SF",
      postFreq: "S", postEff: "high", postProfile: "FU",
      spotUpFreq: "S", deepRange: true,
      transFreq: "S", transRole: "rim_run",
      orebThreat: "medium",
      contactFinish: "seeks", offHandFinish: "capable",
      vision: 4, floater: "S",
      cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      screenerAction: null, ballHandling: "capable", pressureResponse: "escapes",
    },
    clubContext: { gender: "F" },
    expect: {
      deny_must: ["deny_iso_space", "deny_spot_deep"],
      deny_must_not: ["deny_oreb"],
      force_must_not: ["force_contact"],
      allow_must_not: ["allow_spot_three"],
      top_situations: ["iso_right"],
      danger_min: 5,
    },
  },

  {
    id: "cal011",
    name: "Sabrina Ionescu — PnR + Spot-up",
    note: "PnR handler, elite spot-up shooter, deep range, off-screen",
    inputs: {
      pos: "PG", hand: "R", ath: 4, phys: 2, usage: "primary",
      selfCreation: "high", starPlayer: true,
      pnrFreq: "P", pnrEff: "high", pnrPri: "SF", trapResponse: "pass",
      pnrFinishLeft: "Pull-up", pnrFinishRight: "Drive to Rim",
      isoFreq: "S", isoEff: "high",
      spotUpFreq: "P", spotZone: "corner", deepRange: true,
      indirectFreq: "S", offBallCutAction: "catch_and_shoot",
      transFreq: "S",
      postFreq: "N",
      vision: 4, orebThreat: "low",
      floater: "N", cutFreq: "N", dhoFreq: "N",
      contactFinish: "neutral", offHandFinish: "capable",
      screenerAction: null, ballHandling: "elite", pressureResponse: "escapes",
    },
    clubContext: { gender: "F" },
    expect: {
      deny_must: ["deny_pnr_downhill", "deny_spot_corner"],
      deny_must_not: ["deny_post_entry", "deny_oreb"],
      force_must_not: ["force_early", "force_trap"],
      allow_must_not: ["allow_spot_three", "allow_iso"],
      top_situations: ["pnr_ball", "catch_shoot"],
      danger_min: 4,
    },
  },

  {
    id: "cal012",
    name: "Caitlin Clark — PnR + Deep Range",
    note: "PnR handler, elite deep range, iso secondary, vision élite",
    inputs: {
      pos: "PG", hand: "R", ath: 3, phys: 2, usage: "primary",
      selfCreation: "high", starPlayer: true,
      pnrFreq: "P", pnrEff: "high", pnrPri: "SF", trapResponse: "escape",
      spotUpFreq: "S", deepRange: true,
      isoFreq: "S", isoEff: "medium",
      indirectFreq: "S", offBallCutAction: "catch_and_shoot",
      transFreq: "S",
      postFreq: "N",
      vision: 5, orebThreat: "low",
      floater: "N", cutFreq: "N", dhoFreq: "N",
      contactFinish: "avoids", offHandFinish: "capable",
      screenerAction: null, ballHandling: "capable", pressureResponse: "escapes",
    },
    clubContext: { gender: "F" },
    expect: {
      deny_must: ["deny_pnr_downhill", "deny_spot_deep"],
      deny_must_not: ["deny_post_entry", "deny_oreb"],
      force_must_not: ["force_trap", "force_early", "force_contact"],
      allow_must_not: ["allow_spot_three"],
      top_situations: ["pnr_ball"],
      danger_min: 4,
      alert_keys: ["aware_passer"],
    },
  },

  {
    id: "cal013",
    name: "Kelsey Plum — ISO Guard",
    note: "ISO primary, pull-up shooter, deep range, avoids contact",
    inputs: {
      pos: "SG", hand: "R", ath: 4, phys: 2, usage: "primary",
      selfCreation: "high", starPlayer: true,
      isoFreq: "P", isoEff: "high", isoDir: "R", isoDec: "S",
      pnrFreq: "S", pnrEff: "medium", pnrPri: "SF",
      spotUpFreq: "S", deepRange: true,
      transFreq: "S",
      postFreq: "N",
      vision: 3, orebThreat: "low",
      floater: "N", cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      contactFinish: "avoids", offHandFinish: "capable",
      screenerAction: null, ballHandling: "elite", pressureResponse: "escapes",
    },
    clubContext: { gender: "F" },
    expect: {
      deny_must: ["deny_iso_space", "deny_spot_deep"],
      deny_must_not: ["deny_post_entry"],
      // avoids contact + spot-up primary = force_contact should NOT appear
      force_must_not: ["force_contact"],
      allow_must_not: ["allow_spot_three"],
      top_situations: ["iso_right"],
      danger_min: 3,
      danger_max: 5,
    },
  },

  // ─── PERFILES DIFÍCILES / EDGE CASES ─────────────────────────────────────

  {
    id: "cal014",
    name: "Role player — 3-and-D wing",
    note: "Spot-up corner, no self-creation, baseline cuts, low impact",
    inputs: {
      pos: "SF", hand: "R", ath: 3, phys: 3, usage: "role",
      selfCreation: "low",
      spotUpFreq: "S", spotZone: "corner", deepRange: true,
      cutFreq: "S", cutType: "basket",
      isoFreq: "N", pnrFreq: "N", postFreq: "N",
      transFreq: "R",
      orebThreat: "low",
      vision: 3, floater: "N",
      dhoFreq: "N", indirectFreq: "N",
      contactFinish: "neutral", offHandFinish: "capable",
      screenerAction: null, ballHandling: null, pressureResponse: null,
    },
    expect: {
      deny_must: ["deny_spot_corner"],
      deny_must_not: ["deny_iso_space", "deny_pnr_downhill", "deny_post_entry"],
      force_must_not: ["force_trap", "force_early"],
      allow_must_not: ["allow_iso"], // allow_iso solo si no tiene PnR/post — aquí role, ok permitirlo
      top_situations: ["catch_shoot"],
      danger_min: 1,
      danger_max: 3,
    },
  },

  {
    id: "cal015",
    name: "PnR Handler con ALLOW transition — Pika-style",
    note: "PnR primaria, transition threat con deepRange — no force_early, ALLOW transition",
    inputs: {
      pos: "PG", hand: "R", ath: 4, phys: 3, usage: "primary",
      selfCreation: "high",
      pnrFreq: "P", pnrEff: "high", pnrPri: "SF", trapResponse: "pass",
      spotUpFreq: "S", deepRange: true,
      transFreq: "P", transRole: "trail", transRolePrimary: "trail",
      transSubPrimary: "shoot_off_trail",
      isoFreq: "N", postFreq: "N",
      vision: 4, orebThreat: "low",
      floater: "N", cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      contactFinish: "neutral", offHandFinish: "capable",
      screenerAction: null, ballHandling: "capable", pressureResponse: "escapes",
    },
    clubContext: { gender: "F" },
    expect: {
      deny_must: ["deny_pnr_downhill"],
      deny_must_not: ["deny_oreb"],
      // deepRange + transFreq = force_early debe ser bajo o no aparecer
      force_must_not: ["force_early", "force_trap", "force_contact"],
      allow_must_not: ["allow_spot_three"],
      top_situations: ["pnr_ball"],
      danger_min: 3,
    },
  },

  {
    id: "cal016",
    name: "Post Screener — Pop con rango",
    note: "Pop screener con deep range, spot-up secundario, no ISO",
    inputs: {
      pos: "PF", hand: "R", ath: 3, phys: 4, usage: "secondary",
      selfCreation: "medium",
      screenerAction: "pop", deepRange: true,
      spotUpFreq: "S", spotZone: "wing",
      pnrFreq: "S", pnrEff: "medium",
      postFreq: "R", postEff: "low",
      isoFreq: "N", transFreq: "R",
      orebThreat: "medium",
      vision: 3, floater: "N",
      cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      contactFinish: "neutral", offHandFinish: "capable",
      ballHandling: null, pressureResponse: null,
    },
    expect: {
      deny_must: ["deny_pnr_pop", "deny_spot_deep"],
      deny_must_not: ["deny_iso_space", "deny_post_entry"],
      force_must_not: ["force_early"],
      allow_must_not: ["allow_spot_three"],
      top_situations: ["pnr_screener", "catch_shoot"],
      danger_min: 2,
      danger_max: 4,
    },
  },

  {
    id: "cal017",
    name: "Pressure Vulnerability — PnR handler bajo presión",
    note: "PnR handler que lucha vs blitz — debe aparecer force_full_court o aware_pressure_vuln",
    inputs: {
      pos: "SG", hand: "R", ath: 3, phys: 3, usage: "primary",
      selfCreation: "high",
      pnrFreq: "P", pnrEff: "medium", pnrPri: "SF", trapResponse: "struggle",
      isoFreq: "R",
      spotUpFreq: "R", deepRange: false,
      postFreq: "N", transFreq: "S",
      vision: 2, orebThreat: "low",
      floater: "N", cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      contactFinish: "neutral", offHandFinish: "capable",
      screenerAction: null, ballHandling: "limited", pressureResponse: "struggles",
    },
    expect: {
      deny_must: ["deny_pnr_downhill"],
      force_must: ["force_trap"],
      alert_keys: ["aware_pressure_vuln"],
      top_situations: ["pnr_ball"],
      danger_min: 2,
      danger_max: 4,
    },
  },

  {
    id: "cal018",
    name: "Interior role player — sin amenaza exterior",
    note: "C/PF sin tiro, rol pequeño, solo rebote y duck-in. Allow spot-up obvio",
    inputs: {
      pos: "C", hand: "R", ath: 3, phys: 4, usage: "role",
      selfCreation: "low",
      postFreq: "R", postEntry: "duck_in",
      orebThreat: "high", putbackQuality: "capable",
      transFreq: "S", transRole: "rim_run",
      transFinishing: "medium",
      isoFreq: "N", pnrFreq: "N",
      spotUpFreq: "N", deepRange: false,
      vision: 2, floater: "N",
      cutFreq: "S", cutType: "basket",
      dhoFreq: "N", indirectFreq: "N",
      contactFinish: "neutral", offHandFinish: "capable",
      screenerAction: null, ballHandling: null, pressureResponse: null,
    },
    expect: {
      deny_must: ["deny_trans_rim"],
      deny_must_not: ["deny_iso_space", "deny_pnr_downhill"],
      force_must_not: ["force_early"],
      allow_must: ["allow_spot_three"],
      allow_must_not: ["allow_iso"],
      danger_min: 1,
      danger_max: 3,
    },
  },

];

// ─── RUN CALIBRATION ─────────────────────────────────────────────────────────

interface ProfileResult {
  id: string;
  name: string;
  passed: boolean;
  score: number;
  failures: string[];
  output: {
    archetype: string;
    danger: number;
    difficulty: number;
    top_situations: string[];
    deny: string;
    deny_alts: string[];
    force: string;
    force_alts: string[];
    allow: string;
    alerts: string[];
    deny_text: string;
    force_text: string;
    allow_text: string;
  };
}

const results: ProfileResult[] = [];
let totalPassed = 0;
let totalFailed = 0;
let totalChecks = 0;
let passedChecks = 0;

for (const profile of profiles) {
  const failures: string[] = [];
  const e = profile.expect;

  let result: ReturnType<typeof generateMotorV4>;
  try {
    result = generateMotorV4(profile.inputs as any, profile.clubContext as any);
  } catch (err) {
    failures.push(`CRASH: ${err}`);
    results.push({ id: profile.id, name: profile.name, passed: false, score: 0, failures, output: {} as any });
    totalFailed++;
    continue;
  }

  // Render text
  let rendered: ReturnType<typeof renderReport>;
  try {
    rendered = renderReport(result, { locale: "en", gender: "n" });
  } catch (err) {
    failures.push(`RENDER_CRASH: ${err}`);
    results.push({ id: profile.id, name: profile.name, passed: false, score: 0, failures, output: {} as any });
    totalFailed++;
    continue;
  }

  const denyKey = result.defense.deny.winner.key;
  const forceKey = result.defense.force.winner.key;
  const allowKey = result.defense.allow.winner.key;
  const denyAltKeys = result.defense.deny.alternatives.map(a => a.key);
  const forceAltKeys = result.defense.force.alternatives.map(a => a.key);
  const allDenyKeys = [denyKey, ...denyAltKeys];
  const allForceKeys = [forceKey, ...forceAltKeys];
  const situationIds = result.situations.slice(0, 3).map(s => s.id);
  const alertKeys = result.alerts.map(a => a.key);

  const denyText = rendered.defense.deny.instruction;
  const forceText = rendered.defense.force.instruction;
  const allowText = rendered.defense.allow.instruction;

  const check = (label: string, condition: boolean) => {
    totalChecks++;
    if (condition) {
      passedChecks++;
    } else {
      failures.push(label);
    }
  };

  // deny_must
  for (const key of e.deny_must ?? []) {
    check(`deny_must[${key}] — got: ${allDenyKeys.join(",")}`, allDenyKeys.includes(key));
  }
  // deny_must_not
  for (const key of e.deny_must_not ?? []) {
    check(`deny_must_not[${key}] — got: ${allDenyKeys.join(",")}`, !allDenyKeys.includes(key));
  }
  // force_must
  for (const key of e.force_must ?? []) {
    check(`force_must[${key}] — got: ${allForceKeys.join(",")}`, allForceKeys.includes(key));
  }
  // force_must_not
  for (const key of e.force_must_not ?? []) {
    check(`force_must_not[${key}] — got: ${allForceKeys.join(",")}`, !allForceKeys.includes(key));
  }
  // allow_must
  for (const key of e.allow_must ?? []) {
    check(`allow_must[${key}] — got: ${allowKey}`, allowKey === key || result.defense.allow.alternatives.some(a => a.key === key));
  }
  // allow_must_not
  for (const key of e.allow_must_not ?? []) {
    const allAllowKeys = [allowKey, ...result.defense.allow.alternatives.map(a => a.key)];
    check(`allow_must_not[${key}] — got: ${allAllowKeys.join(",")}`, !allAllowKeys.includes(key));
  }
  // top_situations
  for (const sit of e.top_situations ?? []) {
    check(`top_sit[${sit}] in top3 — got: ${situationIds.join(",")}`, situationIds.includes(sit));
  }
  // not_top_situations
  for (const sit of e.not_top_situations ?? []) {
    check(`not_top_sit[${sit}] NOT in top3 — got: ${situationIds.join(",")}`, !situationIds.includes(sit));
  }
  // danger
  if (e.danger_min !== undefined) {
    check(`danger_min(${e.danger_min}) — got: ${result.identity.dangerLevel}`, result.identity.dangerLevel >= e.danger_min);
  }
  if (e.danger_max !== undefined) {
    check(`danger_max(${e.danger_max}) — got: ${result.identity.dangerLevel}`, result.identity.dangerLevel <= e.danger_max);
  }
  // alerts
  for (const key of e.alert_keys ?? []) {
    check(`alert[${key}] — got: ${alertKeys.join(",")}`, alertKeys.includes(key));
  }
  for (const key of e.alert_keys_not ?? []) {
    check(`alert_not[${key}] — got: ${alertKeys.join(",")}`, !alertKeys.includes(key));
  }
  // text
  for (const substr of e.deny_text_contains ?? []) {
    check(`deny_text contains "${substr}" — got: "${denyText}"`, denyText.toLowerCase().includes(substr.toLowerCase()));
  }
  for (const substr of e.force_text_contains ?? []) {
    check(`force_text contains "${substr}" — got: "${forceText}"`, forceText.toLowerCase().includes(substr.toLowerCase()));
  }
  for (const substr of e.allow_text_contains ?? []) {
    check(`allow_text contains "${substr}" — got: "${allowText}"`, allowText.toLowerCase().includes(substr.toLowerCase()));
  }

  const profileChecks = (e.deny_must?.length ?? 0) + (e.deny_must_not?.length ?? 0) +
    (e.force_must?.length ?? 0) + (e.force_must_not?.length ?? 0) +
    (e.allow_must?.length ?? 0) + (e.allow_must_not?.length ?? 0) +
    (e.top_situations?.length ?? 0) + (e.not_top_situations?.length ?? 0) +
    (e.danger_min !== undefined ? 1 : 0) + (e.danger_max !== undefined ? 1 : 0) +
    (e.alert_keys?.length ?? 0) + (e.alert_keys_not?.length ?? 0) +
    (e.deny_text_contains?.length ?? 0) + (e.force_text_contains?.length ?? 0) +
    (e.allow_text_contains?.length ?? 0);

  const profilePassed = failures.length === 0;
  const score = profileChecks > 0 ? Math.round(((profileChecks - failures.length) / profileChecks) * 100) : 100;

  if (profilePassed) totalPassed++; else totalFailed++;

  results.push({
    id: profile.id,
    name: profile.name,
    passed: profilePassed,
    score,
    failures,
    output: {
      archetype: result.identity.archetypeKey,
      danger: result.identity.dangerLevel,
      difficulty: result.identity.difficultyLevel,
      top_situations: situationIds,
      deny: denyKey,
      deny_alts: denyAltKeys.slice(0, 3),
      force: forceKey,
      force_alts: forceAltKeys.slice(0, 2),
      allow: allowKey,
      alerts: alertKeys,
      deny_text: denyText,
      force_text: forceText,
      allow_text: allowText,
    },
  });
}

// ─── REPORT ───────────────────────────────────────────────────────────────────

const globalScore = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;

console.log(`\n${"=".repeat(60)}`);
console.log(`  U Scout Motor Calibration — ${new Date().toLocaleDateString()}`);
console.log(`${"=".repeat(60)}`);
console.log(`  Profiles: ${profiles.length} | ✓ ${totalPassed} | ✗ ${totalFailed}`);
console.log(`  Checks:   ${totalChecks} total | ${passedChecks} passed | Score: ${globalScore}%`);
console.log(`${"=".repeat(60)}\n`);

for (const r of results) {
  const icon = r.passed ? "✓" : "✗";
  const bar = `[${"█".repeat(Math.floor(r.score / 10))}${"░".repeat(10 - Math.floor(r.score / 10))}]`;
  console.log(`${icon} ${bar} ${r.score}% — ${r.name}`);
  console.log(`    archetype: ${r.output.archetype} | danger: ${r.output.danger} | situations: ${r.output.top_situations.join(", ")}`);
  console.log(`    DENY: ${r.output.deny} | FORCE: ${r.output.force} | ALLOW: ${r.output.allow}`);
  if (r.output.deny_text) console.log(`    deny_text: "${r.output.deny_text.slice(0, 80)}"`);
  if (r.output.force_text) console.log(`    force_text: "${r.output.force_text.slice(0, 80)}"`);
  if (r.failures.length > 0) {
    r.failures.forEach(f => console.log(`    ⚠ ${f}`));
  }
  console.log();
}

// Write JSON
const jsonPath = "scripts/calibration-results.json";
fs.writeFileSync(jsonPath, JSON.stringify({ date: new Date().toISOString(), globalScore, totalPassed, totalFailed, passedChecks, totalChecks, results }, null, 2));
console.log(`Results written to ${jsonPath}`);
