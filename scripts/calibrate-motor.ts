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
      deny_text_contains: ["catch"],  // "deep" removed — new text says "perimeter" instead
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
      alert_keys: ["aware_post_hook"],  // hook is the primary alert when both present
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
      allow_must: ["allow_iso_both"],  // allow_iso_both is the correct key when isoDir=null
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
      danger_max: 5,  // rim runners score high in transition even as role players
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
      // allow_iso is correct for pure 3-and-D with no PnR/post — no ball-creation threat
      top_situations: ["catch_shoot"],
      danger_min: 1,
      danger_max: 4,  // spot-up secondary with deepRange scores 0.8+ → danger 4 is correct
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
      deny_must_not: ["deny_iso_space", "deny_pnr_downhill"],
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
      danger_max: 5,  // pnr_ball primary always scores high regardless of weaknesses
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
      danger_max: 5,  // oreb+transition can score high even for role players
    },
  },

  // ─── PERFILES ADICIONALES — cobertura extendida ───────────────────────────

  {
    id: "cal019",
    name: "ISO puro europeo — weak hand, bajo atletismo",
    note: "ISO scorer con baja atletismo, timing como creación, izquierda débil",
    inputs: {
      pos: "SF", hand: "R", ath: 2, phys: 3, usage: "primary",
      selfCreation: "high",
      isoFreq: "P", isoEff: "medium", isoDir: "R", isoDec: "S",
      pnrFreq: "R", postFreq: "N",
      spotUpFreq: "S", deepRange: false,
      transFreq: "R",
      vision: 3, orebThreat: "low",
      floater: "N", cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      contactFinish: "neutral", offHandFinish: "weak",
      screenerAction: null, ballHandling: "capable", pressureResponse: null,
    },
    expect: {
      deny_must: ["deny_iso_space"],
      force_must: ["force_weak_hand"],
      force_must_not: ["force_contact"],
      deny_text_contains: ["right"],
      top_situations: ["iso_right"],
      danger_min: 2,
      danger_max: 4,
    },
  },

  {
    id: "cal020",
    name: "DHO primario — giver + shooter",
    note: "DHO handler principal, da y recibe, spot-up secondary",
    inputs: {
      pos: "SG", hand: "R", ath: 3, phys: 2, usage: "secondary",
      selfCreation: "medium",
      dhoFreq: "P", dhoRole: "both", dhoAction: "shoot",
      spotUpFreq: "S", deepRange: true,
      isoFreq: "R", pnrFreq: "N", postFreq: "N",
      transFreq: "R",
      vision: 3, orebThreat: "low",
      floater: "N", cutFreq: "N", indirectFreq: "N",
      contactFinish: "neutral", offHandFinish: "capable",
      screenerAction: null, ballHandling: null, pressureResponse: null,
    },
    expect: {
      deny_must: ["deny_dho"],
      deny_must_not: ["deny_post_entry", "deny_pnr_downhill"],
      force_must_not: ["force_trap", "force_early"],
      top_situations: ["dho"],
      danger_min: 2,
      danger_max: 5,  // DHO primary scores high
    },
  },

  {
    id: "cal021",
    name: "Cutter primario — sin balón, acción compulsiva",
    note: "Cortador compulsivo, rol puro, sin tiro exterior",
    inputs: {
      pos: "SF", hand: "R", ath: 4, phys: 3, usage: "role",
      selfCreation: "low",
      cutFreq: "P", cutType: "backdoor",
      offBallRole: "cutter",
      freeCutsFrequency: "Primary", freeCutsType: "basket",
      isoFreq: "N", pnrFreq: "N", postFreq: "N",
      spotUpFreq: "N", deepRange: false,
      transFreq: "S",
      vision: 3, orebThreat: "low",
      floater: "N", dhoFreq: "N", indirectFreq: "N",
      contactFinish: "neutral", offHandFinish: "capable",
      screenerAction: null, ballHandling: null, pressureResponse: null,
    },
    expect: {
      deny_must: ["deny_cut_backdoor"],
      deny_must_not: ["deny_iso_space", "deny_pnr_downhill", "deny_spot_deep"],
      force_must_not: ["force_early", "force_trap"],
      top_situations: ["cut"],
      danger_min: 1,
      danger_max: 4,  // cut primary with high athleticism
    },
  },

  {
    id: "cal022",
    name: "PnR Screener slip — ghost touch",
    note: "Screener que hace slip sistemático antes del contacto, PnR handler también",
    inputs: {
      pos: "PF", hand: "R", ath: 5, phys: 3, usage: "secondary",
      selfCreation: "medium",
      screenerAction: "slip", pnrScreenTiming: "ghost_touch",
      pnrFreq: "S",
      transFreq: "S", transRole: "rim_run",
      transFinishing: "high",
      spotUpFreq: "N", deepRange: false,
      isoFreq: "N", postFreq: "N",
      orebThreat: "medium",
      vision: 3, floater: "N",
      cutFreq: "S", cutType: "basket",
      dhoFreq: "N", indirectFreq: "N",
      contactFinish: "neutral", offHandFinish: "capable",
      ballHandling: null, pressureResponse: null,
    },
    expect: {
      deny_must: ["deny_pnr_slip"],
      deny_must_not: ["deny_iso_space", "deny_spot_deep"],
      force_must_not: ["force_early"],
      top_situations: ["pnr_screener"],
      danger_min: 2,
      danger_max: 5,  // slip ghost_touch scores high
    },
  },

  {
    id: "cal023",
    name: "Ball handling liability — turnovers under pressure",
    note: "Jugadora con manejo malo, full court pressure approach",
    inputs: {
      pos: "SG", hand: "R", ath: 3, phys: 3, usage: "secondary",
      selfCreation: "medium",
      spotUpFreq: "S", deepRange: false,
      isoFreq: "R", pnrFreq: "N", postFreq: "N",
      transFreq: "R",
      vision: 2, orebThreat: "low",
      floater: "N", cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      contactFinish: "neutral", offHandFinish: "capable",
      screenerAction: null, ballHandling: "liability", pressureResponse: "struggles",
    },
    expect: {
      force_must: ["force_no_ball"],
      // allow_iso correct for SG with spot-up secondary and no PnR/post primary
      danger_min: 1,
      danger_max: 3,
    },
  },

  {
    id: "cal024",
    name: "Ofensive rebounding specialist",
    note: "Oreb primario con putback primario, sin tiro, rol puro",
    inputs: {
      pos: "C", hand: "R", ath: 4, phys: 5, usage: "role",
      selfCreation: "low",
      orebThreat: "high", putbackQuality: "primary",
      postFreq: "R", postEntry: "duck_in",
      transFreq: "S", transRole: "rim_run",
      isoFreq: "N", pnrFreq: "N",
      spotUpFreq: "N", deepRange: false,
      vision: 2, floater: "N",
      cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      contactFinish: "seeks", offHandFinish: "capable",
      screenerAction: null, ballHandling: null, pressureResponse: null,
    },
    expect: {
      deny_must: ["deny_oreb"],
      deny_must_not: ["deny_iso_space", "deny_spot_deep", "deny_pnr_downhill"],
      force_must_not: ["force_early"],
      allow_must: ["allow_spot_three"],
      danger_min: 2,
      deny_text_contains: ["duck"],  // deny_duck_in wins when postEntry=duck_in
    },
  },

  {
    id: "cal025",
    name: "PnR Handler — asimetría forzar izquierda (force_direction)",
    note: "PnR handler hand=R con Drive por derecha y Pull-up por izquierda. Motor debe generar force_direction=L",
    inputs: {
      pos: "PG", hand: "R", ath: 4, phys: 3, usage: "primary",
      selfCreation: "high",
      pnrFreq: "P", pnrEff: "high", pnrPri: "SF", trapResponse: "pass",
      pnrFinishLeft: "Pull-up", pnrFinishRight: "Drive to Rim",
      spotUpFreq: "S", deepRange: true,
      transFreq: "P", transRole: "fill", transRolePrimary: "pusher",
      transSubPrimary: "dribble_push",
      isoFreq: "N", postFreq: "N",
      vision: 5, orebThreat: "low",
      floater: "N", cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      contactFinish: "avoids", offHandFinish: "capable",
      screenerAction: null, ballHandling: "elite", pressureResponse: "escapes",
    },
    clubContext: { gender: "F" },
    expect: {
      deny_must: ["deny_pnr_downhill"],
      force_must: ["force_direction"],
      force_must_not: ["force_early", "force_trap", "force_contact"],
      force_text_contains: ["left"],
      allow_must_not: ["allow_spot_three"],
      top_situations: ["pnr_ball"],
      danger_min: 3,
      alert_keys: ["aware_passer"],
    },
  },

  {
    id: "cal026",
    name: "Floater primary threat — guard sin post",
    note: "Guard con floater primario en PnR, no hace post, usa el floater como finish principal",
    inputs: {
      pos: "PG", hand: "R", ath: 4, phys: 2, usage: "primary",
      selfCreation: "high",
      pnrFreq: "P", pnrEff: "high", pnrPri: "SF",
      pnrFinishLeft: "Floater", pnrFinishRight: "Floater",
      floater: "P",
      isoFreq: "S", isoEff: "medium",
      spotUpFreq: "S", deepRange: true,
      postFreq: "N", transFreq: "S",
      vision: 4, orebThreat: "low",
      contactFinish: "neutral", offHandFinish: "capable",
      cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      screenerAction: null, ballHandling: "elite", pressureResponse: "escapes",
      trapResponse: "escape",
    },
    expect: {
      deny_must: ["deny_pnr_downhill"],
      deny_must_not: ["deny_post_entry"],
      force_must_not: ["force_early", "force_trap"],
      top_situations: ["pnr_ball"],
      danger_min: 3,
      danger_max: 5,
    },
  },


  // ─── PERFILES ADICIONALES BATCH 2 — NBA/WNBA fiables + amateur + edge cases ──

  {
    id: "cal027",
    name: "Damian Lillard — ISO + PnR deep range",
    note: "Elite ISO scorer, clutch, deep 3PT, pull-up specialist, left hand dominant",
    inputs: {
      pos: "PG", hand: "R", ath: 4, phys: 3, usage: "primary",
      selfCreation: "high", starPlayer: true, personality: ["clutch"],
      isoFreq: "P", isoEff: "high", isoDir: "L", isoDec: "S",
      pnrFreq: "P", pnrEff: "high", pnrPri: "SF", trapResponse: "escape",
      pnrFinishLeft: "Pull-up", pnrFinishRight: "Drive to Rim",
      spotUpFreq: "S", deepRange: true,
      floater: "R", transFreq: "S",
      postFreq: "N", vision: 4, orebThreat: "low",
      contactFinish: "seeks", offHandFinish: "capable",
      cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      screenerAction: null, ballHandling: "elite", pressureResponse: "breaks",
    },
    expect: {
      deny_must: ["deny_iso_space", "deny_pnr_downhill"],
      force_must_not: ["force_early", "force_trap"],
      allow_must_not: ["allow_iso", "allow_spot_three"],
      top_situations: ["iso_left", "pnr_ball"],
      danger_min: 5,
      // Lillard attacks LEFT — his dominant side — so force_direction should go RIGHT
      // hand=R → renderer always says "left" (weak side), correct for Lillard
    },
  },

  {
    id: "cal028",
    name: "Devin Booker — ISO pull-up specialist",
    note: "Elite pull-up ISO, mid-range specialist AND 3PT, no weak hand issues, clutch",
    inputs: {
      pos: "SG", hand: "R", ath: 4, phys: 3, usage: "primary",
      selfCreation: "high", starPlayer: true, personality: ["clutch"],
      isoFreq: "P", isoEff: "high", isoDir: "R", isoDec: "S",
      pnrFreq: "S", pnrEff: "high", pnrPri: "SF", trapResponse: "pass",
      spotUpFreq: "S", deepRange: true,
      floater: "N", transFreq: "S",
      postFreq: "N", vision: 4, orebThreat: "low",
      contactFinish: "neutral", offHandFinish: "capable",
      cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      screenerAction: null, ballHandling: "elite", pressureResponse: "escapes",
    },
    expect: {
      deny_must: ["deny_iso_space"],
      force_must_not: ["force_trap", "force_early"],
      allow_must_not: ["allow_iso", "allow_spot_three"],
      top_situations: ["iso_right"],
      danger_min: 4,
      deny_text_contains: ["left", "right"],
    },
  },

  {
    id: "cal029",
    name: "Bam Adebayo — PnR Roll + Post",
    note: "PnR roll primary, face-up post, high phys, vision 4, no deep range, transition threat",
    inputs: {
      pos: "C", hand: "R", ath: 4, phys: 5, usage: "primary",
      selfCreation: "medium", starPlayer: true,
      screenerAction: "roll",
      pnrFreq: "S", pnrEff: "high",
      postFreq: "S", postEff: "high", postProfile: "FU",
      postShoulder: "R", postMoves: ["hook", "drop_step"],
      transFreq: "S", transRole: "rim_run",
      spotUpFreq: "N", deepRange: false,
      orebThreat: "high", putbackQuality: "capable",
      isoFreq: "N", vision: 4,
      contactFinish: "seeks", offHandFinish: "capable",
      floater: "N", cutFreq: "S", cutType: "basket",
      dhoFreq: "N", indirectFreq: "N",
      ballHandling: null, pressureResponse: null,
    },
    expect: {
      deny_must: ["deny_pnr_roll"],
      deny_must_not: ["deny_spot_deep", "deny_iso_space"],
      force_must_not: ["force_early"],
      allow_must: ["allow_spot_three"],
      top_situations: ["pnr_screener"],
      danger_min: 3,
    },
  },

  {
    id: "cal030",
    name: "Ja Morant — Transition + PnR Rim Attacker",
    note: "Elite transition, PnR Drive to Rim, ath=5, seeks contact, weak off-hand",
    inputs: {
      pos: "PG", hand: "R", ath: 5, phys: 3, usage: "primary",
      selfCreation: "high", starPlayer: true,
      pnrFreq: "P", pnrEff: "high", pnrPri: "SF", trapResponse: "escape",
      pnrFinishLeft: "Drive to Rim", pnrFinishRight: "Drive to Rim",
      isoFreq: "S", isoEff: "high", isoDir: "R", isoDec: "F",
      transFreq: "P", transRole: "rim_run", transRolePrimary: "rim_runner",
      transFinishing: "high",
      floater: "P",
      spotUpFreq: "N", deepRange: false,
      postFreq: "N", vision: 3,
      orebThreat: "low", contactFinish: "seeks", offHandFinish: "weak",
      cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      screenerAction: null, ballHandling: "elite", pressureResponse: "breaks",
    },
    expect: {
      deny_must: ["deny_pnr_downhill", "deny_trans_rim"],
      deny_must_not: ["deny_spot_deep"],
      force_must: ["force_weak_hand"],
      force_must_not: ["force_early"],
      allow_must: ["allow_spot_three"],
      top_situations: ["pnr_ball", "transition"],
      danger_min: 5,
    },
  },

  {
    id: "cal031",
    name: "Diana Taurasi — WNBA Veteran ISO + Spot-up",
    note: "Elite ISO + spot-up, deep range, vision élite, clutch player, aging but smart",
    inputs: {
      pos: "SG", hand: "R", ath: 3, phys: 2, usage: "primary",
      selfCreation: "high", starPlayer: true, personality: ["clutch"],
      isoFreq: "P", isoEff: "high", isoDir: "R", isoDec: "S",
      pnrFreq: "S", pnrPri: "SF", trapResponse: "escape",
      spotUpFreq: "P", spotZone: "wing", deepRange: true,
      floater: "N", transFreq: "R",
      postFreq: "N", vision: 5, orebThreat: "low",
      contactFinish: "avoids", offHandFinish: "capable",
      cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      screenerAction: null, ballHandling: "elite", pressureResponse: "escapes",
    },
    clubContext: { gender: "F" },
    expect: {
      deny_must: ["deny_iso_space", "deny_spot_deep"],
      force_must_not: ["force_contact", "force_early"],
      allow_must_not: ["allow_spot_three"],
      top_situations: ["iso_right", "catch_shoot"],
      danger_min: 4,
    },
  },

  {
    id: "cal032",
    name: "Draymond Green — Playmaking Big sin tiro",
    note: "Vision 5, sin tiro exterior, slip screener, high post passer, never ISO",
    inputs: {
      pos: "PF", hand: "R", ath: 3, phys: 4, usage: "role",
      selfCreation: "low",
      screenerAction: "slip", pnrScreenTiming: "ghost_touch",
      pnrFreq: "N",
      highPostZones: { leftElbow: "pass_to_cutter", rightElbow: "pass_to_cutter" },
      postFreq: "N",
      isoFreq: "N",
      spotUpFreq: "N", deepRange: false,
      cutFreq: "S", cutType: "basket",
      transFreq: "S", transRole: "fill",
      orebThreat: "medium", putbackQuality: "palms_only",
      vision: 5, floater: "N",
      dhoFreq: "N", indirectFreq: "N",
      contactFinish: "neutral", offHandFinish: "capable",
      ballHandling: null, pressureResponse: null,
    },
    expect: {
      deny_must: ["deny_pnr_slip", "deny_high_post_catch"],
      deny_must_not: ["deny_iso_space", "deny_spot_deep"],
      force_must_not: ["force_early"],
      allow_must: ["allow_spot_three"],
      alert_keys: ["aware_passer"],
      danger_min: 2,
      danger_max: 5,  // Draymond slip/highpost can score high
    },
  },

  {
    id: "cal033",
    name: "Anthony Edwards — ISO Driver + 3PT",
    note: "ISO primary, drives right, spot-up secondary, elite ath, personality clutch",
    inputs: {
      pos: "SG", hand: "R", ath: 5, phys: 4, usage: "primary",
      selfCreation: "high", starPlayer: true, personality: ["clutch"],
      isoFreq: "P", isoEff: "high", isoDir: "R", isoDec: "F",
      pnrFreq: "S", pnrEff: "high", pnrPri: "SF",
      spotUpFreq: "S", deepRange: true,
      floater: "N", transFreq: "S", transRole: "rim_run",
      postFreq: "N", vision: 3, orebThreat: "low",
      contactFinish: "seeks", offHandFinish: "capable",
      cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      screenerAction: null, ballHandling: "elite", pressureResponse: "escapes",
      trapResponse: "pass",
    },
    expect: {
      deny_must: ["deny_iso_space"],
      force_must_not: ["force_trap", "force_contact"],
      allow_must_not: ["allow_iso", "allow_spot_three"],
      top_situations: ["iso_right"],
      danger_min: 5,
      // Edwards drives right (dominant) — isoDir=R + hand=R = no force_direction generated
    },
  },

  {
    id: "cal034",
    name: "Nikola Vucevic — Post scorer mid-range",
    note: "Post face-up, mid-range shooter, no drive, high post, no transition",
    inputs: {
      pos: "C", hand: "R", ath: 2, phys: 4, usage: "primary",
      selfCreation: "high",
      postFreq: "P", postEff: "high", postProfile: "FU",
      postShoulder: "R", postMoves: ["turnaround", "fade"],
      highPostZones: { leftElbow: "pull_up", rightElbow: "pull_up" },
      isoFreq: "R", isoEff: "medium",
      spotUpFreq: "S", deepRange: false,
      pnrFreq: "R", transFreq: "N",
      orebThreat: "medium", putbackQuality: "capable",
      vision: 3, floater: "N",
      contactFinish: "neutral", offHandFinish: "capable",
      cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      screenerAction: null, ballHandling: null, pressureResponse: null,
    },
    expect: {
      deny_must: ["deny_post_entry", "deny_high_post_catch"],
      deny_must_not: ["deny_trans_rim", "deny_spot_deep"],
      force_must_not: ["force_early"],
      // allow: iso_both or spot_three both valid — Vucevic has R iso and no deep range
      top_situations: ["post_right"],
      danger_min: 3,
      danger_max: 5,
    },
  },

  {
    id: "cal035",
    name: "Khris Middleton — Mid-range ISO + PnR",
    note: "ISO mid-range specialist, pull-up expert, PnR secondary, no transition",
    inputs: {
      pos: "SF", hand: "R", ath: 3, phys: 3, usage: "primary",
      selfCreation: "high", starPlayer: true,
      isoFreq: "P", isoEff: "high", isoDir: "R", isoDec: "S",
      pnrFreq: "S", pnrEff: "high", pnrPri: "SF",
      pnrFinishLeft: "Pull-up", pnrFinishRight: "Pull-up",
      spotUpFreq: "S", deepRange: false,
      floater: "N", transFreq: "R",
      postFreq: "N", vision: 4, orebThreat: "low",
      contactFinish: "neutral", offHandFinish: "capable",
      cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      screenerAction: null, ballHandling: "capable", pressureResponse: "escapes",
    },
    expect: {
      deny_must: ["deny_iso_space"],
      // force_early valid: ISO primary without deepRange, pull-up decision
      // allow: transition or allow_pnr_mid_range both valid
      top_situations: ["iso_right"],
      danger_min: 3,
      danger_max: 5,
    },
  },

  {
    id: "cal036",
    name: "Trae Young — PnR floater specialist",
    note: "PnR primary, elite floater, deep range, vision 5, physically weak",
    inputs: {
      pos: "PG", hand: "R", ath: 2, phys: 1, usage: "primary",
      selfCreation: "high", starPlayer: true,
      pnrFreq: "P", pnrEff: "high", pnrPri: "PF", trapResponse: "escape",
      pnrFinishLeft: "Floater", pnrFinishRight: "Floater",
      isoFreq: "S", isoEff: "high",
      spotUpFreq: "S", deepRange: true,
      floater: "P",
      transFreq: "S", postFreq: "N",
      vision: 5, orebThreat: "low",
      contactFinish: "avoids", offHandFinish: "capable",
      cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      screenerAction: null, ballHandling: "elite", pressureResponse: "breaks",
    },
    expect: {
      deny_must: ["deny_pnr_downhill"],
      deny_must_not: ["deny_post_entry"],
      force_must_not: ["force_contact", "force_early", "force_trap"],
      allow_must_not: ["allow_spot_three"],
      top_situations: ["pnr_ball"],
      danger_min: 4,
      // aware_passer may be crowded out by aware_oreb + aware_physical
      // alert_keys: ["aware_passer"],  // removed — physical + oreb take priority slots
    },
  },

  {
    id: "cal037",
    name: "OG Anunoby — 3-and-D Wing elite",
    note: "Spot-up primario, sin creación, transition secondary, cortes ocasionales, phys fuerte",
    inputs: {
      pos: "SF", hand: "R", ath: 4, phys: 4, usage: "secondary",
      selfCreation: "low",
      spotUpFreq: "P", spotZone: "corner", deepRange: true,
      cutFreq: "S", cutType: "basket",
      transFreq: "S", transRole: "rim_run",
      isoFreq: "N", pnrFreq: "N", postFreq: "N",
      orebThreat: "medium",
      vision: 3, floater: "N",
      dhoFreq: "N", indirectFreq: "N",
      contactFinish: "neutral", offHandFinish: "capable",
      screenerAction: null, ballHandling: null, pressureResponse: null,
    },
    expect: {
      deny_must: ["deny_spot_corner"],
      deny_must_not: ["deny_iso_space", "deny_pnr_downhill"],
      force_must_not: ["force_trap", "force_early"],
      allow_must_not: ["allow_spot_three"],
      top_situations: ["catch_shoot"],
      danger_min: 2,
      danger_max: 5,
    },
  },

  {
    id: "cal038",
    name: "Arike Ogunbowale — WNBA ISO Scorer",
    note: "Elite ISO scorer WNBA, clutch, right hand dominant, pull-up + floater",
    inputs: {
      pos: "SG", hand: "R", ath: 4, phys: 3, usage: "primary",
      selfCreation: "high", starPlayer: true, personality: ["clutch"],
      isoFreq: "P", isoEff: "high", isoDir: "R", isoDec: "S",
      pnrFreq: "S", pnrEff: "medium", pnrPri: "SF",
      spotUpFreq: "S", deepRange: true,
      floater: "S", transFreq: "S",
      postFreq: "N", vision: 3, orebThreat: "low",
      contactFinish: "neutral", offHandFinish: "capable",
      cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      screenerAction: null, ballHandling: "elite", pressureResponse: "escapes",
    },
    clubContext: { gender: "F" },
    expect: {
      deny_must: ["deny_iso_space"],
      force_must_not: ["force_trap", "force_early"],
      allow_must_not: ["allow_spot_three"],
      top_situations: ["iso_right"],
      danger_min: 4,
      // FORCE=none when ISO+deepRange without PnR asymmetry
    },
  },

  {
    id: "cal039",
    name: "Amateur — Base ofensiva sin tiro exterior",
    note: "Jugador amateur PG, PnR handler sin rango, sin creación real, nivel U18",
    inputs: {
      pos: "PG", hand: "R", ath: 3, phys: 2, usage: "primary",
      selfCreation: "high",
      pnrFreq: "P", pnrEff: "medium", pnrPri: "SF", trapResponse: "struggle",
      pnrFinishLeft: "Pull-up", pnrFinishRight: "Drive to Rim",
      isoFreq: "R", isoEff: "low",
      spotUpFreq: "R", deepRange: false,
      floater: "N", transFreq: "S",
      postFreq: "N", vision: 3, orebThreat: "low",
      contactFinish: "neutral", offHandFinish: "capable",
      cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      screenerAction: null, ballHandling: "capable", pressureResponse: null,
    },
    clubContext: { level: "developmental" },
    expect: {
      deny_must: ["deny_pnr_downhill"],
      force_must: ["force_trap"],
      allow_must: ["allow_spot_three"],
      top_situations: ["pnr_ball"],
      danger_min: 2,
      danger_max: 5,  // primary PnR always high score
    },
  },

  {
    id: "cal040",
    name: "Amateur — Interior sin habilidad",
    note: "C amateur, sin tiro, solo rebote y catch en pintua, nivel competitivo bajo",
    inputs: {
      pos: "C", hand: "R", ath: 2, phys: 4, usage: "role",
      selfCreation: "low",
      postFreq: "R", postEntry: "duck_in",
      screenerAction: "roll",
      isoFreq: "N", pnrFreq: "N",
      transFreq: "R", transRole: "rim_run",
      spotUpFreq: "N", deepRange: false,
      orebThreat: "high", putbackQuality: "capable",
      vision: 1, floater: "N",
      cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      contactFinish: "neutral", offHandFinish: "capable",
      ballHandling: "liability", pressureResponse: null,
    },
    clubContext: { level: "developmental" },
    expect: {
      deny_must: ["deny_pnr_roll"],
      deny_must_not: ["deny_iso_space", "deny_spot_deep"],
      force_must: ["force_no_ball"],
      allow_must: ["allow_spot_three"],
      danger_min: 1,
      danger_max: 5,  // roll+oreb can score high
    },
  },

  {
    id: "cal041",
    name: "ACB — Ala-pívot versátil europeo",
    note: "PF europeo: post + spot-up, sin ISO, PnR screener pop, europeo nivel Euroleague",
    inputs: {
      pos: "PF", hand: "R", ath: 3, phys: 4, usage: "secondary",
      selfCreation: "medium",
      postFreq: "S", postEff: "high", postProfile: "B2B",
      postShoulder: "R", postMoves: ["hook", "fade"],
      screenerAction: "pop", deepRange: true,
      spotUpFreq: "S", spotZone: "wing",
      pnrFreq: "S",
      isoFreq: "N", transFreq: "R",
      orebThreat: "medium",
      vision: 3, floater: "N",
      contactFinish: "neutral", offHandFinish: "capable",
      cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      ballHandling: null, pressureResponse: null,
    },
    clubContext: { leagueType: "acb" },
    expect: {
      deny_must: ["deny_pnr_pop", "deny_post_entry"],
      deny_must_not: ["deny_iso_space"],
      force_must_not: ["force_early"],
      top_situations: ["pnr_screener", "post_right"],
      danger_min: 2,
      danger_max: 5,
    },
  },

  {
    id: "cal042",
    name: "Chinese Women's — Post técnica sin atletismo",
    note: "C WCBA: post técnica, fade + hook, phys alta, ath baja, sin transición",
    inputs: {
      pos: "C", hand: "R", ath: 1, phys: 5, usage: "primary",
      selfCreation: "high",
      postFreq: "P", postEff: "high", postProfile: "B2B",
      postShoulder: "L", postMoves: ["hook", "fade", "up_and_under"],
      postEntry: "seal",
      isoFreq: "N", pnrFreq: "N", transFreq: "N",
      spotUpFreq: "N", deepRange: false,
      orebThreat: "high", putbackQuality: "primary",
      vision: 2, floater: "N",
      contactFinish: "seeks", offHandFinish: "capable",
      cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      screenerAction: null, ballHandling: null, pressureResponse: null,
    },
    clubContext: { leagueType: "wcba", gender: "F" },
    expect: {
      deny_must: ["deny_post_entry"],
      deny_must_not: ["deny_trans_rim", "deny_spot_deep"],
      force_must_not: ["force_early"],
      allow_must: ["allow_spot_three"],
      top_situations: ["post_left"],
      danger_min: 3,
      alert_keys: ["aware_post_hook"],
    },
  },

  {
    id: "cal043",
    name: "Stretch Big — Interior espaciador puro",
    note: "PF: pop screener, spot-up deep range, sin ISO, sin post, solo aro por transición",
    inputs: {
      pos: "PF", hand: "R", ath: 3, phys: 3, usage: "secondary",
      selfCreation: "low",
      screenerAction: "pop", deepRange: true,
      spotUpFreq: "P", spotZone: "top",
      pnrFreq: "S",
      transFreq: "S", transRole: "trail",
      isoFreq: "N", postFreq: "N",
      orebThreat: "low",
      vision: 3, floater: "N",
      contactFinish: "neutral", offHandFinish: "capable",
      cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      ballHandling: null, pressureResponse: null,
    },
    expect: {
      deny_must: ["deny_pnr_pop", "deny_spot_deep"],
      deny_must_not: ["deny_iso_space", "deny_post_entry"],
      force_must_not: ["force_early"],
      allow_must_not: ["allow_spot_three"],
      top_situations: ["pnr_screener", "catch_shoot"],
      danger_min: 2,
      danger_max: 5,
    },
  },

  {
    id: "cal044",
    name: "Lethon Gizmo — Off-screen curler + spot-up",
    note: "Wing que vive de off-screens, curl threat, spot-up secondary, deepRange",
    inputs: {
      pos: "SG", hand: "R", ath: 4, phys: 2, usage: "secondary",
      selfCreation: "low",
      indirectFreq: "P", offBallCutAction: "curl",
      spotUpFreq: "S", deepRange: true,
      cutFreq: "S", cutType: "curl",
      isoFreq: "N", pnrFreq: "N", postFreq: "N",
      transFreq: "R", orebThreat: "low",
      vision: 3, floater: "N",
      dhoFreq: "N",
      contactFinish: "neutral", offHandFinish: "capable",
      screenerAction: null, ballHandling: null, pressureResponse: null,
    },
    expect: {
      deny_must: ["deny_off_ball_curl", "deny_spot_deep"],
      deny_must_not: ["deny_iso_space", "deny_pnr_downhill"],
      force_must_not: ["force_early", "force_trap"],
      top_situations: ["off_ball", "catch_shoot"],
      danger_min: 2,
      danger_max: 4,
    },
  },

  {
    id: "cal045",
    name: "Selfish ISO — baja eficiencia pero no para",
    note: "Jugador egoísta: siempre tira ISO aunque sea ineficiente, baja eficiencia",
    inputs: {
      pos: "SG", hand: "R", ath: 3, phys: 3, usage: "secondary",
      selfCreation: "medium", personality: ["selfish"],
      isoFreq: "P", isoEff: "low", isoDir: "R", isoDec: "S",
      pnrFreq: "N", postFreq: "N",
      spotUpFreq: "R", deepRange: false,
      transFreq: "R", orebThreat: "low",
      vision: 2, floater: "N",
      contactFinish: "neutral", offHandFinish: "capable",
      cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      screenerAction: null, ballHandling: "capable", pressureResponse: null,
    },
    expect: {
      // Selfish + low eff → allow_iso should appear (let them shoot bad shots)
      allow_must: ["allow_iso"],
      deny_must_not: ["deny_pnr_downhill", "deny_post_entry"],
      force_must_not: ["force_trap"],
      danger_min: 1,
      danger_max: 3,
    },
  },

  {
    id: "cal046",
    name: "DHO Specialist — handoff primario giver+receiver",
    note: "Jugadora que domina el DHO como tanto giver como receiver, spot-up secondary",
    inputs: {
      pos: "SG", hand: "R", ath: 3, phys: 2, usage: "secondary",
      selfCreation: "medium",
      dhoFreq: "P", dhoRole: "both", dhoAction: "shoot",
      spotUpFreq: "S", deepRange: true,
      isoFreq: "N", pnrFreq: "N", postFreq: "N",
      transFreq: "R", orebThreat: "low",
      vision: 3, floater: "N",
      contactFinish: "neutral", offHandFinish: "capable",
      cutFreq: "N", indirectFreq: "N",
      screenerAction: null, ballHandling: null, pressureResponse: null,
    },
    clubContext: { gender: "F" },
    expect: {
      deny_must: ["deny_dho"],
      deny_must_not: ["deny_pnr_downhill", "deny_post_entry"],
      force_must_not: ["force_trap", "force_early"],
      top_situations: ["dho"],
      danger_min: 2,
      danger_max: 5,
    },
  },


  // ─── EUROLIGA / INTERNACIONALES ──────────────────────────────────────────

  {
    id: "cal027",
    name: "Vasilije Micic — EuroLeague PnR Maestro",
    note: "PnR handler pass-first, floater frecuente, deep range, escape artista vs traps",
    inputs: {
      pos: "PG", hand: "R", ath: 3, phys: 2, usage: "primary",
      selfCreation: "high",
      pnrFreq: "P", pnrEff: "high", pnrPri: "PF", trapResponse: "escape",
      pnrFinishLeft: "Floater", pnrFinishRight: "Pull-up",
      floater: "P",
      isoFreq: "S", isoEff: "medium",
      spotUpFreq: "S", deepRange: true,
      transFreq: "S",
      postFreq: "N",
      vision: 5, orebThreat: "low",
      cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      contactFinish: "neutral", offHandFinish: "capable",
      screenerAction: null, ballHandling: "elite", pressureResponse: "escapes",
    },
    expect: {
      deny_must: ["deny_pnr_downhill"],
      deny_must_not: ["deny_post_entry", "deny_oreb"],
      force_must_not: ["force_early", "force_trap"],
      allow_must_not: ["allow_spot_three"],
      top_situations: ["pnr_ball"],
      danger_min: 4,
      alert_keys: ["aware_passer"],
    },
  },

  {
    id: "cal028",
    name: "Nikola Mirotic — Stretch Big Euro",
    note: "PF con deep range, spot-up primario, PnR pop, sin juego de poste real",
    inputs: {
      pos: "PF", hand: "R", ath: 3, phys: 3, usage: "secondary",
      selfCreation: "medium",
      spotUpFreq: "P", spotZone: "top", deepRange: true,
      screenerAction: "pop",
      pnrFreq: "S", pnrEff: "medium",
      isoFreq: "R", postFreq: "R",
      transFreq: "R",
      orebThreat: "medium", // PF con algo de rebote
      vision: 3, floater: "N",
      cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      contactFinish: "neutral", offHandFinish: "capable",
      ballHandling: null, pressureResponse: null,
    },
    expect: {
      deny_must: ["deny_pnr_pop", "deny_spot_deep"],
      deny_must_not: ["deny_pnr_downhill"],  // iso from isoFreq=R and post from postFreq=R acceptable as alts
      force_must_not: ["force_early", "force_trap"],
      allow_must_not: ["allow_spot_three"],
      top_situations: ["pnr_screener", "catch_shoot"],
      danger_min: 3,
      danger_max: 5,
    },
  },

  {
    id: "cal029",
    name: "Shai Gilgeous-Alexander — ISO Scorer Elite",
    note: "ISO primario, va por la izquierda, seeks contact, floater, pull-up ambas manos",
    inputs: {
      pos: "SG", hand: "R", ath: 5, phys: 3, usage: "primary",
      selfCreation: "high", starPlayer: true,
      isoFreq: "P", isoEff: "high", isoDir: "L", isoDec: "F",
      pnrFreq: "S", pnrEff: "high", pnrPri: "SF",
      pnrFinishLeft: "Drive to Rim", pnrFinishRight: "Pull-up",
      floater: "S",
      spotUpFreq: "R", deepRange: false,
      transFreq: "S",
      postFreq: "N",
      vision: 4, orebThreat: "low",
      contactFinish: "seeks", offHandFinish: "capable",
      cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      screenerAction: null, ballHandling: "elite", pressureResponse: "escapes",
    },
    expect: {
      deny_must: ["deny_iso_space"],
      deny_must_not: ["deny_post_entry", "deny_spot_deep"],
      // seeks contact + no spotUp primary = force_contact valid
      allow_must_not: ["allow_iso", "allow_spot_three"],
      top_situations: ["iso_left"],
      danger_min: 5,
      deny_text_contains: ["left"],
    },
  },

  {
    id: "cal030",
    name: "Domantas Sabonis — Post + PnR Passer",
    note: "Post primario B2B, PnR pass-first, duck-in, oreb élite, high post passer",
    inputs: {
      pos: "C", hand: "R", ath: 3, phys: 5, usage: "primary",
      selfCreation: "high", starPlayer: true,
      postFreq: "P", postEff: "high", postProfile: "B2B",
      postShoulder: "R", postMoves: ["hook", "drop_step", "turnaround"],
      postEntry: "duck_in",
      highPostZones: { leftElbow: "pass_to_cutter", rightElbow: "face_up_drive" },
      pnrFreq: "S", pnrEff: "high", pnrPri: "PF", trapResponse: "escape",
      isoFreq: "N",
      transFreq: "R",
      spotUpFreq: "N", deepRange: false,
      orebThreat: "high", putbackQuality: "primary",
      contactFinish: "seeks", offHandFinish: "capable",
      vision: 4, floater: "N",
      cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      screenerAction: null, ballHandling: null, pressureResponse: null,
    },
    expect: {
      deny_must: ["deny_post_entry", "deny_duck_in"],
      deny_must_not: ["deny_spot_deep", "deny_iso_space"],
      allow_must_not: ["allow_iso"],
      top_situations: ["post_right"],
      danger_min: 4,
      // Sabonis has vision=4 + trapResponse=escape + pnrPri=PF → aware_passer correct
      alert_keys: ["aware_passer"],
    },
  },

  {
    id: "cal031",
    name: "Devin Booker — ISO + PnR Scorer",
    note: "ISO y PnR handler, pull-up primario, mid-range specialist, deep range, clutch",
    inputs: {
      pos: "SG", hand: "R", ath: 4, phys: 3, usage: "primary",
      selfCreation: "high", starPlayer: true, personality: ["clutch"],
      isoFreq: "P", isoEff: "high", isoDir: "R", isoDec: "S",
      pnrFreq: "P", pnrEff: "high", pnrPri: "SF",
      pnrFinishLeft: "Pull-up", pnrFinishRight: "Pull-up",
      spotUpFreq: "S", deepRange: true,
      transFreq: "R",
      postFreq: "N",
      vision: 3, orebThreat: "low",
      floater: "N",
      contactFinish: "neutral", offHandFinish: "capable",
      cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      screenerAction: null, ballHandling: "elite", pressureResponse: "escapes",
    },
    expect: {
      deny_must: ["deny_iso_space", "deny_pnr_downhill"],
      deny_must_not: ["deny_post_entry", "deny_oreb"],
      // PnR handler with deepRange = no force_early
      force_must_not: ["force_early", "force_trap"],
      allow_must_not: ["allow_spot_three"],
      top_situations: ["iso_right", "pnr_ball"],
      danger_min: 4,
    },
  },

  {
    id: "cal032",
    name: "Jaylen Brown — Wing Scorer ISO",
    note: "ISO izquierda, drives al aro, contacto, sin rango exterior prioritario",
    inputs: {
      pos: "SG", hand: "R", ath: 5, phys: 4, usage: "primary",
      selfCreation: "high", starPlayer: true,
      isoFreq: "P", isoEff: "high", isoDir: "L", isoDec: "F",
      pnrFreq: "R", postFreq: "N",
      spotUpFreq: "S", deepRange: true,
      transFreq: "P", transRole: "rim_run", transRolePrimary: "rim_runner",
      transFinishing: "high",
      orebThreat: "low",
      contactFinish: "seeks", offHandFinish: "capable",
      vision: 3, floater: "N",
      cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      screenerAction: null, ballHandling: "capable", pressureResponse: null,
    },
    expect: {
      deny_must: ["deny_iso_space"],
      deny_must_not: ["deny_post_entry"],
      // seeks contact + no spotUp primary = force_contact valid here
      force_must_not: ["force_early"],
      allow_must_not: ["allow_iso"],
      top_situations: ["iso_left"],
      danger_min: 4,
      deny_text_contains: ["left"],
    },
  },

  {
    id: "cal033",
    name: "Anthony Davis — Post + PnR Roll",
    note: "Post y PnR screener roll, físico máximo, oreb élite, sin rango exterior",
    inputs: {
      pos: "C", hand: "R", ath: 5, phys: 5, usage: "primary",
      selfCreation: "high", starPlayer: true,
      postFreq: "P", postEff: "high", postProfile: "B2B",
      postShoulder: "L", postMoves: ["hook", "fade", "drop_step"],
      postEntry: "seal",
      screenerAction: "roll",
      pnrFreq: "S", pnrEff: "high",
      isoFreq: "R", isoDec: "F",
      transFreq: "S", transRole: "rim_run",
      transFinishing: "high",
      spotUpFreq: "N", deepRange: false,
      orebThreat: "high", putbackQuality: "primary",
      contactFinish: "seeks", offHandFinish: "capable",
      vision: 3, floater: "N",
      cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      ballHandling: null, pressureResponse: null,
    },
    expect: {
      deny_must: ["deny_post_entry", "deny_pnr_roll"],
      deny_must_not: ["deny_spot_deep", "deny_spot_corner"],
      force_must_not: ["force_early"],
      allow_must: ["allow_spot_three"],
      allow_must_not: ["allow_iso"],
      top_situations: ["post_left"],
      danger_min: 4,
    },
  },

  {
    id: "cal034",
    name: "Trae Young — PnR Maestro Floater",
    note: "PnR pass-first, floater élite, pull-up profundo, trap escape artista",
    inputs: {
      pos: "PG", hand: "R", ath: 2, phys: 1, usage: "primary",
      selfCreation: "high", starPlayer: true,
      pnrFreq: "P", pnrEff: "high", pnrPri: "PF", trapResponse: "escape",
      pnrFinishLeft: "Floater", pnrFinishRight: "Pull-up",
      floater: "P",
      isoFreq: "S", isoEff: "high",
      spotUpFreq: "S", deepRange: true,
      transFreq: "R",
      postFreq: "N",
      vision: 5, orebThreat: "low",
      cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      contactFinish: "avoids", offHandFinish: "capable",
      screenerAction: null, ballHandling: "elite", pressureResponse: "escapes",
    },
    expect: {
      deny_must: ["deny_pnr_downhill"],
      deny_must_not: ["deny_post_entry", "deny_oreb"],
      // phys=1 + avoids contact + deepRange = no force_contact, no force_early
      force_must_not: ["force_early", "force_trap", "force_contact"],
      allow_must_not: ["allow_spot_three"],
      top_situations: ["pnr_ball"],
      danger_min: 4,
      alert_keys: ["aware_passer"],
    },
  },

  {
    id: "cal035",
    name: "Khris Middleton — Wing Midrange Specialist",
    note: "ISO mid-range, PnR pull-up, no deepRange, timing-based creator, seeks contact",
    inputs: {
      pos: "SF", hand: "R", ath: 3, phys: 3, usage: "primary",
      selfCreation: "high",
      isoFreq: "P", isoEff: "high", isoDir: "R", isoDec: "S",
      pnrFreq: "S", pnrEff: "medium", pnrPri: "SF",
      pnrFinishLeft: "Pull-up", pnrFinishRight: "Pull-up",
      spotUpFreq: "R", deepRange: false,
      postFreq: "R", postEff: "medium",
      transFreq: "R",
      vision: 3, orebThreat: "low",
      floater: "N",
      contactFinish: "seeks", offHandFinish: "capable",
      cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      screenerAction: null, ballHandling: "capable", pressureResponse: null,
    },
    expect: {
      deny_must: ["deny_iso_space"],
      deny_must_not: ["deny_spot_deep"],  // postFreq=R may generate deny_post_entry at low weight
      force_must_not: ["force_trap"],
      // no deepRange → allow_spot_three or allow_distance generated correctly
      top_situations: ["iso_right"],
      danger_min: 3,
      danger_max: 5,
    },
  },

  {
    id: "cal036",
    name: "Bam Adebayo — PnR Handler Big + DHO",
    note: "PF/C handler en PnR, DHO, post secundario, face-up, pasa primero",
    inputs: {
      pos: "PF", hand: "R", ath: 5, phys: 5, usage: "primary",
      selfCreation: "high", starPlayer: true,
      pnrFreq: "P", pnrEff: "high", pnrPri: "PF", trapResponse: "pass",
      pnrFinishLeft: "Drive to Rim", pnrFinishRight: "Drive to Rim",
      postFreq: "S", postEff: "medium", postProfile: "FU",
      postShoulder: "R",
      dhoFreq: "S", dhoRole: "giver", dhoAction: "pass",
      isoFreq: "N",
      transFreq: "S", transRole: "rim_run",
      transFinishing: "high",
      spotUpFreq: "N", deepRange: false,
      orebThreat: "high", putbackQuality: "capable",
      contactFinish: "seeks", offHandFinish: "capable",
      vision: 4, floater: "N",
      cutFreq: "N", indirectFreq: "N",
      screenerAction: null, ballHandling: "capable", pressureResponse: null,
    },
    expect: {
      deny_must: ["deny_pnr_downhill"],
      deny_must_not: ["deny_spot_deep", "deny_spot_corner"],
      // both sides Drive to Rim → no force_direction from asymmetry; PF handler
      force_must_not: ["force_early"],
      allow_must: ["allow_spot_three"],
      allow_must_not: ["allow_iso"],
      top_situations: ["pnr_ball"],
      danger_min: 4,
      // alert_keys: ["aware_passer"],  // aware_oreb+physical fill the 2 aware slots
    },
  },

  // ─── WNBA / EUROPA FEMENINO ───────────────────────────────────────────────

  {
    id: "cal037",
    name: "Diana Taurasi — Veteran ISO + PnR",
    note: "ISO y PnR, deep range, pull-up master, clutch, seeks contact",
    inputs: {
      pos: "SG", hand: "R", ath: 3, phys: 3, usage: "primary",
      selfCreation: "high", starPlayer: true, personality: ["clutch"],
      isoFreq: "P", isoEff: "high", isoDir: "R", isoDec: "S",
      pnrFreq: "S", pnrEff: "high", pnrPri: "SF",
      pnrFinishLeft: "Pull-up", pnrFinishRight: "Pull-up",
      spotUpFreq: "S", deepRange: true,
      transFreq: "R",
      postFreq: "N",
      vision: 4, orebThreat: "low",
      floater: "N",
      contactFinish: "seeks", offHandFinish: "capable",
      cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      screenerAction: null, ballHandling: "elite", pressureResponse: "escapes",
    },
    clubContext: { gender: "F" },
    expect: {
      deny_must: ["deny_iso_space", "deny_spot_deep"],
      deny_must_not: ["deny_post_entry"],
      force_must_not: ["force_early", "force_trap"],
      allow_must_not: ["allow_spot_three", "allow_iso"],
      top_situations: ["iso_right"],
      danger_min: 4,
    },
  },

  {
    id: "cal038",
    name: "Jonquel Jones — Stretch Big WNBA",
    note: "Interior con deep range, PnR pop, spot-up, poca amenaza de penetración",
    inputs: {
      pos: "PF", hand: "R", ath: 3, phys: 4, usage: "primary",
      selfCreation: "medium", starPlayer: true,
      spotUpFreq: "P", spotZone: "wing", deepRange: true,
      screenerAction: "pop",
      pnrFreq: "S", pnrEff: "medium",
      postFreq: "S", postEff: "medium", postProfile: "FU",
      isoFreq: "N",
      transFreq: "R",
      orebThreat: "medium",
      vision: 3, floater: "N",
      cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      contactFinish: "neutral", offHandFinish: "capable",
      ballHandling: null, pressureResponse: null,
    },
    clubContext: { gender: "F" },
    expect: {
      deny_must: ["deny_spot_deep", "deny_pnr_pop"],
      deny_must_not: ["deny_iso_space"],
      force_must_not: ["force_early", "force_trap"],
      allow_must_not: ["allow_spot_three"],
      top_situations: ["catch_shoot", "pnr_screener"],
      danger_min: 3,
      danger_max: 5,
    },
  },

  {
    id: "cal039",
    name: "Alyssa Thomas — Conector sin tiro",
    note: "DHO, PnR handler, sin tiro exterior, vision élite, contacto físico",
    inputs: {
      pos: "PF", hand: "R", ath: 4, phys: 4, usage: "primary",
      selfCreation: "high",
      dhoFreq: "P", dhoRole: "giver", dhoAction: "pass",
      pnrFreq: "S", pnrEff: "medium", pnrPri: "PF", trapResponse: "pass",
      pnrFinishLeft: "Drive to Rim", pnrFinishRight: "Drive to Rim",
      postFreq: "S", postEff: "medium",
      isoFreq: "N",
      transFreq: "S",
      spotUpFreq: "N", deepRange: false,
      orebThreat: "high", putbackQuality: "capable",
      contactFinish: "seeks", offHandFinish: "capable",
      vision: 5, floater: "N",
      cutFreq: "N", indirectFreq: "N",
      screenerAction: null, ballHandling: "capable", pressureResponse: null,
    },
    clubContext: { gender: "F" },
    expect: {
      deny_must: ["deny_dho", "deny_pnr_downhill"],
      deny_must_not: ["deny_spot_deep"],
      force_must_not: ["force_early"],
      allow_must: ["allow_spot_three"],
      allow_must_not: ["allow_iso"],
      top_situations: ["dho"],
      danger_min: 3,
      alert_keys: ["aware_passer"],
    },
  },

  // ─── PERFILES AMATEUR / SEMIPROFESIONAL ────────────────────────────────────

  {
    id: "cal040",
    name: "Base amateur — buen tirador sin creación",
    note: "Spot-up con rango, PnR handler secundario, poca creación propia, no elite",
    inputs: {
      pos: "PG", hand: "R", ath: 2, phys: 2, usage: "secondary",
      selfCreation: "medium",
      spotUpFreq: "P", spotZone: "corner", deepRange: true,
      pnrFreq: "S", pnrEff: "low", pnrPri: "SF",
      pnrFinishLeft: "Pull-up", pnrFinishRight: "Pull-up",
      isoFreq: "R", postFreq: "N",
      transFreq: "R",
      vision: 3, orebThreat: "low",
      floater: "N",
      contactFinish: "avoids", offHandFinish: "capable",
      cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      screenerAction: null, ballHandling: "capable", pressureResponse: null,
    },
    expect: {
      deny_must: ["deny_spot_corner"],
      deny_must_not: ["deny_post_entry", "deny_trans_rim"],
      force_must_not: ["force_early", "force_trap"],
      // avoids contact + spot-up primary = no force_contact
      force_must_not: ["force_contact"],
      allow_must_not: ["allow_spot_three"],
      top_situations: ["catch_shoot"],
      danger_min: 2,
      // spot-up Primary with deepRange scores 0.98 → danger 5 is correct for this profile
    },
  },

  {
    id: "cal041",
    name: "Ala amateur — penetrador puro sin tiro",
    note: "Penetra siempre por su mano fuerte, sin tiro, sin post, físico mediocre",
    inputs: {
      pos: "SF", hand: "R", ath: 4, phys: 3, usage: "secondary",
      selfCreation: "medium",
      isoFreq: "P", isoEff: "medium", isoDir: "R", isoDec: "F",
      pnrFreq: "N", postFreq: "N",
      spotUpFreq: "N", deepRange: false,
      transFreq: "S",
      vision: 2, orebThreat: "low",
      floater: "N",
      contactFinish: "neutral", offHandFinish: "weak",
      cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      screenerAction: null, ballHandling: "capable", pressureResponse: null,
    },
    expect: {
      deny_must: ["deny_iso_space"],
      deny_must_not: ["deny_post_entry", "deny_spot_deep"],
      // weak off-hand → force_weak_hand or force_contact
      force_must: ["force_weak_hand"],
      // allow_spot_three or allow_transition depending on motor selection
      top_situations: ["iso_right"],
      danger_min: 2,
      danger_max: 4,
      force_text_contains: ["hand"],
    },
  },

  {
    id: "cal042",
    name: "Pívot amateur — solo rebote y cortes",
    note: "C sin skills ofensivos, solo presencia física, sin tiro, roll o cortes",
    inputs: {
      pos: "C", hand: "R", ath: 2, phys: 4, usage: "role",
      selfCreation: "low",
      screenerAction: "roll",
      cutFreq: "S", cutType: "basket",
      postFreq: "N",
      transFreq: "S", transRole: "rim_run",
      transFinishing: "medium",
      orebThreat: "high", putbackQuality: "capable",
      isoFreq: "N", pnrFreq: "N",
      spotUpFreq: "N", deepRange: false,
      vision: 1, floater: "N",
      dhoFreq: "N", indirectFreq: "N",
      contactFinish: "neutral", offHandFinish: "capable",
      ballHandling: null, pressureResponse: null,
    },
    expect: {
      deny_must: ["deny_trans_rim", "deny_pnr_roll"],
      deny_must_not: ["deny_iso_space", "deny_spot_deep"],
      force_must_not: ["force_early"],
      allow_must: ["allow_spot_three"],
      allow_must_not: ["allow_iso"],
      // oreb+screener take priority in top3 due to role profile
      danger_min: 2,
    },
  },

  {
    id: "cal043",
    name: "Alero senior — experiencia sin atletismo",
    note: "ISO con timing, sin explosión, mid-range, visión media, no busca contacto",
    inputs: {
      pos: "SF", hand: "R", ath: 1, phys: 2, usage: "secondary",
      selfCreation: "medium",
      isoFreq: "S", isoEff: "medium", isoDir: "R", isoDec: "S",
      pnrFreq: "N", postFreq: "N",
      spotUpFreq: "S", deepRange: false,
      transFreq: "N",
      vision: 3, orebThreat: "low",
      floater: "N",
      contactFinish: "avoids", offHandFinish: "capable",
      cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      screenerAction: null, ballHandling: null, pressureResponse: null,
    },
    expect: {
      deny_must: ["deny_iso_space"],
      deny_must_not: ["deny_trans_rim", "deny_post_entry"],
      // ath=1 + selfCreation=high + iso=S → force_early valid if no exterior/trans threat
      force_must_not: ["force_trap"],
      // force_contact may appear (avoids + no spotUp primary) — acceptable
      // allow_spot_three or allow_iso_right depending on motor
      top_situations: ["iso_right"],
      danger_min: 1,
      danger_max: 3,
    },
  },

  {
    id: "cal044",
    name: "Escolta universitaria — off-screen y transición",
    note: "Off-screen primaria, catch-and-shoot, trail en transición, sin ISO",
    inputs: {
      pos: "SG", hand: "R", ath: 3, phys: 2, usage: "secondary",
      selfCreation: "low",
      indirectFreq: "P", offBallCutAction: "catch_and_shoot",
      spotUpFreq: "P", spotZone: "corner", deepRange: true,
      transFreq: "S", transRole: "trail", transRolePrimary: "trail",
      trailFrequency: "secondary", motorTransitionPrimary: "trail",
      transSubPrimary: "shoot_off_trail",
      isoFreq: "N", pnrFreq: "N", postFreq: "N",
      vision: 3, orebThreat: "low",
      floater: "N", dhoFreq: "N",
      contactFinish: "neutral", offHandFinish: "capable",
      screenerAction: null, ballHandling: null, pressureResponse: null,
    },
    expect: {
      deny_must: ["deny_spot_corner"],
      deny_must_not: ["deny_iso_space", "deny_pnr_downhill"],
      force_must_not: ["force_early", "force_trap"],
      allow_must_not: ["allow_spot_three"],
      top_situations: ["catch_shoot"],
      danger_min: 2,
      // Primary spot-up with deepRange scores very high → danger 5 is correct
    },
  },

  {
    id: "cal045",
    name: "Pivot universitario — post back-to-basket puro",
    note: "Post B2B sin rango, gancho y drop step, phys dominante, sin transición",
    inputs: {
      pos: "C", hand: "R", ath: 3, phys: 5, usage: "primary",
      selfCreation: "high",
      postFreq: "P", postEff: "high", postProfile: "B2B",
      postShoulder: "R", postMoves: ["hook", "drop_step"],
      postEntry: "seal",
      isoFreq: "N", pnrFreq: "N",
      transFreq: "N",
      spotUpFreq: "N", deepRange: false,
      orebThreat: "high", putbackQuality: "primary",
      contactFinish: "seeks", offHandFinish: "capable",
      vision: 2, floater: "N",
      cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      screenerAction: null, ballHandling: null, pressureResponse: null,
    },
    expect: {
      deny_must: ["deny_post_entry"],
      deny_must_not: ["deny_spot_deep", "deny_iso_space", "deny_pnr_downhill"],
      force_must_not: ["force_early"],
      allow_must: ["allow_spot_three"],
      allow_must_not: ["allow_iso"],
      top_situations: ["post_right"],
      danger_min: 3,
      alert_keys: ["aware_post_hook"],
    },
  },

  {
    id: "cal046",
    name: "Ala-pívot versátil — multiple threats",
    note: "PF con ISO, PnR handler, spot-up, post secundario — perfil complejo",
    inputs: {
      pos: "PF", hand: "R", ath: 4, phys: 4, usage: "primary",
      selfCreation: "high", starPlayer: true,
      isoFreq: "S", isoEff: "high", isoDir: "R", isoDec: "F",
      pnrFreq: "S", pnrEff: "high", pnrPri: "SF",
      pnrFinishLeft: "Pull-up", pnrFinishRight: "Drive to Rim",
      postFreq: "S", postEff: "medium", postProfile: "FU",
      spotUpFreq: "S", deepRange: true,
      transFreq: "S", transRole: "rim_run",
      orebThreat: "medium",
      contactFinish: "seeks", offHandFinish: "capable",
      vision: 4, floater: "S",
      cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      screenerAction: null, ballHandling: "capable", pressureResponse: "escapes",
    },
    expect: {
      deny_must: ["deny_spot_deep"],
      deny_must_not: ["deny_oreb"],
      force_must_not: ["force_early", "force_contact"],
      allow_must_not: ["allow_spot_three", "allow_iso"],
      danger_min: 4,
    },
  },

  {
    id: "cal_morant",
    name: "Ja Morant — PnR + Transition élite",
    note: "PnR handler explosivo, transición primaria, floater frecuente, ambidiestro, sin tiro exterior",
    inputs: {
      pos: "PG", hand: "R", ath: 5, phys: 2, usage: "primary",
      selfCreation: "high", starPlayer: true,
      pnrFreq: "P", pnrEff: "high", pnrPri: "SF", trapResponse: "escape",
      pnrFinishLeft: "Drive to Rim", pnrFinishRight: "Drive to Rim",
      isoFreq: "S", isoEff: "high", isoDir: "R", isoDec: "F",
      floater: "P",
      transFreq: "P", transRole: "rim_run", transRolePrimary: "rim_runner",
      transFinishing: "high",
      spotUpFreq: "N", deepRange: false,
      postFreq: "N",
      vision: 4, orebThreat: "low",
      contactFinish: "seeks", offHandFinish: "capable",
      cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      screenerAction: null, ballHandling: "elite", pressureResponse: "breaks",
    },
    expect: {
      deny_must: ["deny_pnr_downhill", "deny_trans_rim"],
      deny_must_not: ["deny_spot_deep", "deny_spot_corner", "deny_post_entry"],
      force_must_not: ["force_direction", "force_weak_hand", "force_early"],
      allow_must: ["allow_spot_three"],
      allow_must_not: ["allow_iso"],
      top_situations: ["pnr_ball", "transition"],
      danger_min: 5,
    },
  },

  // ─── SPOT SHOOTER CON MANO DÉBIL — perfiles críticos post-fix ───────────────

  {
    id: "cal_sheppard",
    name: "Aisha Sheppard — Spot-up primaria, mano izquierda débil",
    note: "SG diestra 5'9 145lb. Record triples ACC. Spot-up primaria C&S inmediato. Mano izquierda débil. Evita contacto. Sin deepRange. Channeleable a izquierda.",
    inputs: {
      pos: "SG", hand: "R", ath: 4, phys: 2, usage: "role",
      selfCreation: "low",
      spotUpFreq: "P", spotZone: "corner",
      spotZones: { cornerLeft: true, wing45Left: true, top: false, wing45Right: true, cornerRight: true },
      deepRange: false, spotUpAction: "shoot",
      isoFreq: "N", pnrFreq: "N", postFreq: "N",
      transFreq: "S", transRole: "trail",
      offHandFinish: "weak", contactFinish: "avoids",
      floater: "N", isoDir: null, isoDec: null, isoEff: null,
      postProfile: "M", postZone: null, postShoulder: null,
      postEff: null, postMoves: null, postEntry: null,
      pnrPri: null, pnrFinishLeft: null, pnrFinishRight: null,
      trapResponse: null, screenerAction: null, popRange: "midrange",
      dhoRole: null, dhoAction: null,
      ballHandling: "capable", pressureResponse: "escapes",
      cutFreq: "N", cutType: null, orebThreat: "low", vision: 3,
    },
    clubContext: { gender: "F" },
    expect: {
      force_must: ["force_weak_hand"],
      force_must_not: ["force_contact", "force_no_space"],
      deny_must: ["deny_spot_corner"],
      deny_must_not: ["deny_iso_space", "deny_pnr_downhill", "deny_spot_deep"],
      allow_must_not: ["allow_spot_three"],
      // role player spot-up: catch_shoot puede no llegar a top3 por usageM=0.6
      // lo importante es que el motor genera las instrucciones correctas
      danger_min: 1, danger_max: 4,
    },
  },

  {
    id: "cal_spot_weak_secondary",
    name: "Spot-up secundaria, mano débil, evita contacto",
    note: "SG spot-up secondary sin deepRange, mano izquierda débil. force_no_space sí puede aparecer (no es primaria), force_weak_hand también.",
    inputs: {
      pos: "SG", hand: "R", ath: 3, phys: 2, usage: "secondary",
      selfCreation: "medium",
      spotUpFreq: "S", spotZone: "corner", deepRange: false, spotUpAction: "shoot",
      isoFreq: "R", pnrFreq: "N", postFreq: "N", transFreq: "R",
      offHandFinish: "weak", contactFinish: "avoids",
      floater: "N", isoDir: null, isoDec: null, isoEff: null,
      postProfile: "M", postZone: null, postShoulder: null,
      postEff: null, postMoves: null, postEntry: null,
      pnrPri: null, pnrFinishLeft: null, pnrFinishRight: null,
      trapResponse: null, screenerAction: null, popRange: "midrange",
      dhoRole: null, dhoAction: null, ballHandling: null, pressureResponse: null,
      cutFreq: "N", cutType: null, orebThreat: "low", vision: 3,
    },
    expect: {
      force_must: ["force_weak_hand"],
      force_must_not: ["force_contact"],
      // isoFreq=R genera deny_iso_space con peso bajo — no pedimos que no aparezca
      deny_must: ["deny_spot_corner"],
      danger_min: 1, danger_max: 3,
    },
  },

  {
    id: "cal_spot_weak_seeks",
    name: "Spot-up primaria, mano débil, BUSCA contacto",
    note: "Tiradora que busca el contacto en el cierre. offHandFinish=weak + contactFinish=seeks → force_weak_hand por la rama else.",
    inputs: {
      pos: "SF", hand: "R", ath: 3, phys: 4, usage: "secondary",
      selfCreation: "low",
      spotUpFreq: "P", spotZone: "wing", deepRange: false, spotUpAction: "either",
      isoFreq: "N", pnrFreq: "N", postFreq: "N", transFreq: "R",
      offHandFinish: "weak", contactFinish: "seeks",
      floater: "N", isoDir: null, isoDec: null, isoEff: null,
      postProfile: "M", postZone: null, postShoulder: null,
      postEff: null, postMoves: null, postEntry: null,
      pnrPri: null, pnrFinishLeft: null, pnrFinishRight: null,
      trapResponse: null, screenerAction: null, popRange: "midrange",
      dhoRole: null, dhoAction: null, ballHandling: null, pressureResponse: null,
      cutFreq: "N", cutType: null, orebThreat: "low", vision: 3,
    },
    expect: {
      force_must: ["force_weak_hand"],
      force_must_not: ["force_no_space"],
      deny_must_not: ["deny_iso_space", "deny_pnr_downhill"],
      danger_min: 1, danger_max: 3,
    },
  },

  {
    id: "cal_pika_pressure_break",
    name: "Pika-style — pressureResponse=breaks independiente de trapResponse",
    note: "PG spot+PnR. pressureResponse=breaks (manejo bajo presión individual). trapResponse observado como pass (reacción hedge PnR). Los dos campos deben ser completamente independientes.",
    inputs: {
      pos: "PG", hand: "R", ath: 4, phys: 3, usage: "primary",
      selfCreation: "high",
      pnrFreq: "P", pnrEff: "high", pnrPri: "SF",
      trapResponse: "pass",
      spotUpFreq: "S", deepRange: false,
      isoFreq: "R", postFreq: "N", transFreq: "S",
      offHandFinish: "weak", contactFinish: "avoids",
      floater: "N", isoDir: null, isoDec: null, isoEff: null,
      postProfile: "M", postZone: null, postShoulder: null,
      postEff: null, postMoves: null, postEntry: null,
      pnrFinishLeft: null, pnrFinishRight: null,
      screenerAction: null, popRange: "midrange",
      dhoRole: null, dhoAction: null,
      ballHandling: "capable", pressureResponse: "breaks",
      cutFreq: "N", cutType: null, orebThreat: "low", vision: 4,
    },
    clubContext: { gender: "F" },
    expect: {
      deny_must: ["deny_pnr_downhill"],
      // pressureResponse=breaks NO debe generar force_trap ni force_full_court
      force_must_not: ["force_trap", "force_full_court"],
      top_situations: ["pnr_ball"],
      danger_min: 3,
    },
  },

  {
    id: "cal_driver_weak_avoids",
    name: "Guard driver puro — mano débil, evita contacto, sin spot-up",
    note: "ISO guard sin spotUpFreq activo. offHandFinish=weak + contactFinish=avoids + NO spot-up → debe generar force_contact (rama de no-shooter), no force_weak_hand.",
    inputs: {
      pos: "SG", hand: "R", ath: 4, phys: 2, usage: "primary",
      selfCreation: "high",
      isoFreq: "P", isoEff: "medium", isoDir: "R", isoDec: "F",
      pnrFreq: "N", postFreq: "N",
      spotUpFreq: "N", deepRange: false,
      transFreq: "R",
      offHandFinish: "weak", contactFinish: "avoids",
      floater: "N", isoDec: "F",
      postProfile: "M", postZone: null, postShoulder: null,
      postEff: null, postMoves: null, postEntry: null,
      pnrPri: null, pnrFinishLeft: null, pnrFinishRight: null,
      trapResponse: null, screenerAction: null, popRange: "midrange",
      dhoRole: null, dhoAction: null,
      ballHandling: "capable", pressureResponse: null,
      cutFreq: "N", cutType: null, orebThreat: "low", vision: 3,
    },
    expect: {
      deny_must: ["deny_iso_space"],
      // ISO driver sin spot-up: force_contact por physical_to_weak_hand (rama no-shooter)
      force_must: ["force_contact"],
      force_must_not: ["force_weak_hand"],
      top_situations: ["iso_right"],
      danger_min: 2, danger_max: 4,
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
