/**
 * U Scout — Archetype Test Suite
 *
 * Tests that buildIdentity assigns the correct primary archetype and sub-archetypes
 * based on the new situation-driven logic (not input-field conditions).
 *
 * Scientific basis:
 * - Archetype = most threatening situation for the defender
 * - Sub-archetype = second most threatening situation (if meaningfully different)
 * - Source: Basketball Immersion / Synergy sport type taxonomy
 *
 * Run: npx tsx scripts/test-archetypes.ts
 */

import { generateMotorV4 } from "../client/src/lib/motor-v4";
import * as fs from "fs";

interface ArchetypeExpectation {
  archetype: string;
  sub_archetype?: string;  // optional — at least one of these in candidates
  sub_archetype_not?: string[];  // these should NOT be in candidates
  danger_min?: number;
  danger_max?: number;
}

interface ArchetypeProfile {
  id: string;
  name: string;
  note: string;
  inputs: any;
  clubContext?: any;
  expect: ArchetypeExpectation;
}

const profiles: ArchetypeProfile[] = [

  // ─── SPOT-UP SHOOTERS ────────────────────────────────────────────────────

  {
    id: "arch_001",
    name: "Pika — tiradora spot-up primaria, PnR secondaria",
    note: "catch_shoot #1 → archetype_spot_up_shooter. pnr_ball #2 → sub pnr_orchestrator",
    inputs: {
      pos: "PG", hand: "R", ath: 5, phys: 3, usage: "primary",
      selfCreation: "high",
      pnrFreq: "P", pnrEff: "high", pnrPri: "SF", trapResponse: "struggle",
      spotUpFreq: "P", spotZone: "top", deepRange: false,
      isoFreq: "R", postFreq: "N", transFreq: "P",
      offHandFinish: "capable", contactFinish: "avoids",
      floater: "N", isoDir: null, isoDec: null, isoEff: null,
      postProfile: "M", postZone: null, postShoulder: null,
      postEff: null, postMoves: null, postEntry: null,
      pnrFinishLeft: "Mid-range", pnrFinishRight: "Mid-range",
      screenerAction: null, popRange: "midrange",
      dhoRole: null, dhoAction: null,
      ballHandling: "elite", pressureResponse: "breaks",
      cutFreq: "N", cutType: null, orebThreat: "low", vision: 4,
    },
    clubContext: { gender: "F" },
    expect: {
    archetype: "archetype_pnr_orchestrator",
    sub_archetype: "archetype_spot_up_shooter",
    },
  },

  {
    id: "arch_002",
    name: "Klay Thompson — spot-up + transición trail",
    note: "catch_shoot #1 → archetype_spot_up_shooter. transition #2 → sub transition_threat",
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
      archetype: "archetype_spot_up_shooter",
      sub_archetype: "archetype_transition_threat",
    },
  },

  {
    id: "arch_003",
    name: "Curry — spot-up + PnR off-screen",
    note: "catch_shoot #1 → archetype_spot_up_shooter (guard, not big)",
    inputs: {
      pos: "PG", hand: "R", ath: 4, phys: 2, usage: "primary",
      selfCreation: "high", starPlayer: true,
      spotUpFreq: "P", spotZone: "wing", deepRange: true,
      isoFreq: "S", isoEff: "high",
      pnrFreq: "S", pnrEff: "medium", pnrPri: "SF",
      indirectFreq: "P", offBallCutAction: "catch_and_shoot",
      cutFreq: "S", cutType: "curl",
      transFreq: "S", postFreq: "N",
      vision: 4, orebThreat: "low",
      floater: "N",
      contactFinish: "neutral", offHandFinish: "capable",
      dhoFreq: "N", screenerAction: null,
      ballHandling: "elite", pressureResponse: "escapes",
    },
    expect: {
      archetype: "archetype_spot_up_shooter",
      sub_archetype_not: ["archetype_post_scorer"],
    },
  },

  // ─── ISO SCORERS ─────────────────────────────────────────────────────────

  {
    id: "arch_004",
    name: "Luka — ISO + PnR dual threat",
    note: "iso_left #1 → archetype_iso_scorer. pnr_ball #2 → sub pnr_orchestrator",
    inputs: {
      pos: "SG", hand: "L", ath: 4, phys: 4, usage: "primary",
      selfCreation: "high", starPlayer: true,
      isoFreq: "P", isoEff: "high", isoDir: "L", isoDec: "F",
      pnrFreq: "P", pnrEff: "high", pnrPri: "SF", trapResponse: "escape",
      pnrFinishLeft: "Pull-up", pnrFinishRight: "Drive to Rim",
      postFreq: "S", spotUpFreq: "R", deepRange: true,
      transFreq: "S", vision: 5, orebThreat: "low",
      contactFinish: "neutral", offHandFinish: "capable",
      floater: "S", cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      screenerAction: null, ballHandling: "elite", pressureResponse: "escapes",
    },
    expect: {
      archetype: "archetype_iso_scorer",
      sub_archetype: "archetype_pnr_orchestrator",
    },
  },

  {
    id: "arch_005",
    name: "ISO puro — sin PnR ni transición",
    note: "iso_right #1 → archetype_iso_scorer. Sin sub significativo.",
    inputs: {
      pos: "SG", hand: "R", ath: 4, phys: 3, usage: "primary",
      selfCreation: "high",
      isoFreq: "P", isoEff: "high", isoDir: "R", isoDec: "F",
      pnrFreq: "N", postFreq: "N", transFreq: "N",
      spotUpFreq: "N", deepRange: false,
      vision: 3, orebThreat: "low",
      floater: "N", cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      contactFinish: "seeks", offHandFinish: "weak",
      screenerAction: null, ballHandling: "capable", pressureResponse: null,
    },
    expect: {
      archetype: "archetype_iso_scorer",
      sub_archetype_not: ["archetype_pnr_orchestrator", "archetype_post_scorer"],
    },
  },

  // ─── PnR ORCHESTRATORS ───────────────────────────────────────────────────

  {
    id: "arch_006",
    name: "Haliburton — PnR pass-first",
    note: "pnr_ball #1 → archetype_pnr_orchestrator",
    inputs: {
      pos: "PG", hand: "R", ath: 3, phys: 2, usage: "primary",
      selfCreation: "high",
      pnrFreq: "P", pnrEff: "high", pnrPri: "PF",
      pnrFinishLeft: "Pull-up", pnrFinishRight: "Pass",
      trapResponse: "escape",
      isoFreq: "R", isoEff: "low",
      spotUpFreq: "S", deepRange: true,
      dhoFreq: "S", dhoRole: "giver", dhoAction: "pass",
      transFreq: "S", postFreq: "N",
      vision: 5, orebThreat: "low",
      floater: "S", cutFreq: "N", indirectFreq: "N",
      contactFinish: "neutral", offHandFinish: "capable",
      screenerAction: null, ballHandling: "capable", pressureResponse: "escapes",
    },
    expect: {
      archetype: "archetype_pnr_orchestrator",
    },
  },

  {
    id: "arch_007",
    name: "PnR handler sin spot-up — solo bloqueo",
    note: "pnr_ball #1 → archetype_pnr_orchestrator. No catch_shoot.",
    inputs: {
      pos: "PG", hand: "R", ath: 4, phys: 2, usage: "primary",
      selfCreation: "high",
      pnrFreq: "P", pnrEff: "high", pnrPri: "SF", trapResponse: "pass",
      pnrFinishLeft: "Drive to Rim", pnrFinishRight: "Drive to Rim",
      spotUpFreq: "N", deepRange: false,
      isoFreq: "N", postFreq: "N", transFreq: "S",
      vision: 4, orebThreat: "low",
      floater: "P", cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      contactFinish: "seeks", offHandFinish: "capable",
      screenerAction: null, ballHandling: "elite", pressureResponse: "breaks",
    },
    expect: {
      archetype: "archetype_pnr_orchestrator",
      sub_archetype_not: ["archetype_spot_up_shooter"],
    },
  },

  // ─── POST SCORERS ────────────────────────────────────────────────────────

  {
    id: "arch_008",
    name: "Jokic — Post + PnR passer",
    note: "post_right #1 → archetype_post_scorer. pnr_ball #2 → sub pnr_orchestrator",
    inputs: {
      pos: "C", hand: "R", ath: 3, phys: 5, usage: "primary",
      selfCreation: "high", starPlayer: true,
      postFreq: "P", postEff: "high", postProfile: "B2B",
      postShoulder: "R", postMoves: ["hook", "fade", "turnaround"],
      postEntry: "seal",
      highPostZones: { leftElbow: "pass_to_cutter", rightElbow: "face_up_drive" },
      pnrFreq: "S", pnrEff: "high", pnrPri: "PF", trapResponse: "escape",
      isoFreq: "R", transFreq: "R",
      spotUpFreq: "N", deepRange: false,
      vision: 5, orebThreat: "medium", putbackQuality: "capable",
      contactFinish: "neutral", offHandFinish: "capable",
      floater: "N", cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      screenerAction: null, ballHandling: null, pressureResponse: null,
    },
    expect: {
      archetype: "archetype_post_scorer",
      sub_archetype: "archetype_pnr_orchestrator",
    },
  },

  {
    id: "arch_009",
    name: "Kalani — Post puro sin PnR",
    note: "post_right #1 → archetype_post_scorer. Sin sub PnR.",
    inputs: {
      pos: "C", hand: "L", ath: 3, phys: 5, usage: "primary",
      selfCreation: "high",
      postFreq: "P", postEff: "high", postProfile: "B2B",
      postShoulder: "R", postMoves: ["hook", "up_and_under"],
      postEntry: "seal",
      isoFreq: "N", pnrFreq: "N", transFreq: "N",
      spotUpFreq: "N", deepRange: false,
      orebThreat: "high", putbackQuality: "capable",
      contactFinish: "seeks", offHandFinish: "capable",
      vision: 2, floater: "N",
      cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      screenerAction: null, ballHandling: null, pressureResponse: null,
    },
    expect: {
      archetype: "archetype_post_scorer",
      sub_archetype_not: ["archetype_pnr_orchestrator", "archetype_spot_up_shooter"],
    },
  },

  // ─── STRETCH BIGS ────────────────────────────────────────────────────────

  {
    id: "arch_010",
    name: "Mirotic — Stretch big PF con deep range",
    note: "catch_shoot #1 + PF → archetype_stretch_big (not spot_up_shooter)",
    inputs: {
      pos: "PF", hand: "R", ath: 3, phys: 3, usage: "secondary",
      selfCreation: "medium",
      spotUpFreq: "P", spotZone: "top", deepRange: true,
      screenerAction: "pop",
      pnrFreq: "S", pnrEff: "medium",
      isoFreq: "R", postFreq: "R",
      transFreq: "R",
      orebThreat: "medium",
      vision: 3, floater: "N",
      cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      contactFinish: "neutral", offHandFinish: "capable",
      ballHandling: null, pressureResponse: null,
    },
    expect: {
      archetype: "archetype_stretch_big",
      sub_archetype_not: ["archetype_spot_up_shooter"],
    },
  },

  {
    id: "arch_011",
    name: "Jonquel Jones — Stretch big WNBA",
    note: "catch_shoot #1 + PF → archetype_stretch_big",
    inputs: {
      pos: "PF", hand: "R", ath: 3, phys: 4, usage: "primary",
      selfCreation: "medium", starPlayer: true,
      spotUpFreq: "P", spotZone: "wing", deepRange: true,
      screenerAction: "pop",
      pnrFreq: "S", pnrEff: "medium",
      postFreq: "S", postEff: "medium", postProfile: "FU",
      isoFreq: "N", transFreq: "R",
      orebThreat: "medium",
      vision: 3, floater: "N",
      cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      contactFinish: "neutral", offHandFinish: "capable",
      ballHandling: null, pressureResponse: null,
    },
    clubContext: { gender: "F" },
    expect: {
      archetype: "archetype_stretch_big",
    },
  },

  // ─── TRANSITION THREATS ──────────────────────────────────────────────────

  {
    id: "arch_012",
    name: "Transición primaria pura — sin creación en halfcourt",
    note: "transition #1 → archetype_transition_threat",
    inputs: {
      pos: "PG", hand: "R", ath: 5, phys: 3, usage: "primary",
      selfCreation: "medium",
      transFreq: "P", transRole: "rim_run", transRolePrimary: "rim_runner",
      transFinishing: "high",
      isoFreq: "N", pnrFreq: "N", postFreq: "N",
      spotUpFreq: "N", deepRange: false,
      vision: 3, orebThreat: "low",
      floater: "N", cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      contactFinish: "neutral", offHandFinish: "capable",
      screenerAction: null, ballHandling: "capable", pressureResponse: null,
    },
    expect: {
      archetype: "archetype_transition_threat",
    },
  },

  // ─── ROLE PLAYERS ────────────────────────────────────────────────────────

  {
    id: "arch_013",
    name: "Gobert — rol screener + rim runner",
    note: "transition/screener #1 + usage=role → archetype_role_player",
    inputs: {
      pos: "C", hand: "R", ath: 4, phys: 5, usage: "role",
      selfCreation: "low",
      screenerAction: "roll",
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
      archetype: "archetype_role_player",
    },
  },

  {
    id: "arch_014",
    name: "3-and-D wing puro — rol sin creación",
    note: "catch_shoot #1 + selfCreation=low + usage=role → archetype_role_player (no spot_up_shooter)",
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
      archetype: "archetype_role_player",
    },
  },

  // ─── VERSATILE / EDGE CASES ──────────────────────────────────────────────

  {
    id: "arch_015",
    name: "Draymond — playmaker sin tiro (conector)",
    note: "No deny outputs de alto peso → archetype_versatile o role_player (usage=role)",
    inputs: {
      pos: "PF", hand: "R", ath: 3, phys: 4, usage: "role",
      selfCreation: "low",
      screenerAction: "slip",
      highPostZones: { leftElbow: "pass_to_cutter", rightElbow: "pass_to_cutter" },
      postFreq: "N", isoFreq: "N",
      spotUpFreq: "N", deepRange: false,
      cutFreq: "S", cutType: "basket",
      transFreq: "S", transRole: "fill",
      orebThreat: "medium",
      vision: 5, floater: "N",
      dhoFreq: "N", indirectFreq: "N",
      contactFinish: "neutral", offHandFinish: "capable",
      ballHandling: null, pressureResponse: null,
      pnrFreq: "N",
    },
    expect: {
      archetype: "archetype_role_player",  // usage=role override
    },
  },

  {
    id: "arch_016",
    name: "Stewie — PF ISO + spot-up → ISO sobre spot",
    note: "iso_right #1 (PF) → archetype_iso_scorer (no post_scorer sin postFreq=P)",
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
      archetype: "archetype_iso_scorer",
      sub_archetype: "archetype_pnr_orchestrator",
    },
  },

];

// ─── Runner ───────────────────────────────────────────────────────────────────

interface TestResult {
  id: string;
  name: string;
  passed: boolean;
  failures: string[];
  archetype: string;
  sub_archetypes: string[];
  top_situations: string[];
  danger: number;
}

const results: TestResult[] = [];
let totalPassed = 0;
let totalFailed = 0;
let totalChecks = 0;
let passedChecks = 0;

for (const profile of profiles) {
  const failures: string[] = [];

  let result: ReturnType<typeof generateMotorV4>;
  try {
    result = generateMotorV4(profile.inputs, profile.clubContext);
  } catch (err) {
    failures.push(`CRASH: ${err}`);
    results.push({ id: profile.id, name: profile.name, passed: false, failures, archetype: "CRASH", sub_archetypes: [], top_situations: [], danger: 0 });
    totalFailed++;
    continue;
  }

  const archetype = result.identity.archetypeKey;
  const subArchetypes = result.identity.archetypeCandidates.map(c => c.key);
  const situations = result.situations.slice(0, 3).map(s => s.id);
  const e = profile.expect;

  const check = (label: string, ok: boolean) => {
    totalChecks++;
    if (ok) passedChecks++;
    else failures.push(label);
  };

  check(
    `archetype === "${e.archetype}" — got: "${archetype}"`,
    archetype === e.archetype,
  );

  if (e.sub_archetype) {
    check(
      `sub_archetype includes "${e.sub_archetype}" — got: [${subArchetypes.join(", ")}]`,
      subArchetypes.includes(e.sub_archetype),
    );
  }

  if (e.sub_archetype_not) {
    for (const key of e.sub_archetype_not) {
      check(
        `sub_archetype NOT includes "${key}" — got: [${subArchetypes.join(", ")}]`,
        !subArchetypes.includes(key),
      );
    }
  }

  if (e.danger_min !== undefined) {
    check(`danger >= ${e.danger_min} — got: ${result.identity.dangerLevel}`, result.identity.dangerLevel >= e.danger_min);
  }
  if (e.danger_max !== undefined) {
    check(`danger <= ${e.danger_max} — got: ${result.identity.dangerLevel}`, result.identity.dangerLevel <= e.danger_max);
  }

  const passed = failures.length === 0;
  if (passed) totalPassed++; else totalFailed++;

  results.push({ id: profile.id, name: profile.name, passed, failures, archetype, sub_archetypes: subArchetypes, top_situations: situations, danger: result.identity.dangerLevel });
}

// ─── Output ───────────────────────────────────────────────────────────────────

const globalScore = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;

console.log(`\n${"=".repeat(62)}`);
console.log(`  U Scout — Archetype Test Suite`);
console.log(`${"=".repeat(62)}`);
console.log(`  Profiles: ${profiles.length} | ✓ ${totalPassed} passed | ✗ ${totalFailed} failed`);
console.log(`  Score: ${globalScore}% (${passedChecks}/${totalChecks} checks)`);
console.log(`${"=".repeat(62)}\n`);

for (const r of results) {
  const icon = r.passed ? "✓" : "✗";
  console.log(`${icon} [${r.id}] ${r.name}`);
  console.log(`    archetype: ${r.archetype} | sub: [${r.sub_archetypes.join(", ")}]`);
  console.log(`    situations: ${r.top_situations.join(", ")} | danger: ${r.danger}`);
  if (r.failures.length > 0) {
    r.failures.forEach(f => console.log(`    ⚠ ${f}`));
  }
  console.log();
}

console.log(`${"=".repeat(62)}`);
console.log(`  OVERALL: ${globalScore}% (${passedChecks}/${totalChecks} checks | ${totalPassed}/${profiles.length} profiles)`);
console.log(`${"=".repeat(62)}`);

const jsonOut = {
  date: new Date().toISOString(),
  globalScore,
  totalPassed,
  totalFailed,
  passedChecks,
  totalChecks,
  results,
};
fs.writeFileSync("scripts/archetype-test-results.json", JSON.stringify(jsonOut, null, 2));
console.log(`\nResults written to scripts/archetype-test-results.json`);
