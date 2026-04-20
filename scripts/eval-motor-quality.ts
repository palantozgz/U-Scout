/**
 * U Scout — Motor Quality Evaluation Script
 *
 * Tests whether the motor produces CORRECT and PROFESSIONAL scouting reports.
 * Focus: does the motor detect what the player does a lot + what they do well,
 * and does it produce a logical, high-level defensive plan?
 *
 * This is NOT a bug-check — it's a quality review.
 * Run: npx tsx scripts/eval-motor-quality.ts
 * Output: scripts/eval-quality-results.txt (human-readable report card)
 */

import { generateMotorV4 } from "../client/src/lib/motor-v4";
import { renderReport } from "../client/src/lib/reportTextRenderer";
import * as fs from "fs";

// ─── Evaluation criteria ──────────────────────────────────────────────────────
interface QualityCheck {
  /** What we're checking */
  label: string;
  /** Must the top situation match one of these? */
  top_situation_is?: string[];
  /** Must the deny instruction contain these words? */
  deny_contains?: string[];
  /** Must the force instruction contain these words? */
  force_contains?: string[];
  /** Must the allow instruction contain these words? */
  allow_contains?: string[];
  /** Must the deny instruction NOT contain these words? (contradictions) */
  deny_not_contains?: string[];
  /** Must the force instruction NOT contain these words? (contradictions) */
  force_not_contains?: string[];
  /** The deny text must be longer than N chars (not a placeholder) */
  deny_min_length?: number;
  /** The force text must be longer than N chars (not a placeholder) */
  force_min_length?: number;
  /** Alert must mention one of these concepts */
  alerts_mention?: string[];
  /** Archetype must be one of these */
  archetype_is?: string[];
}

interface EvalProfile {
  id: string;
  /** Plain-text description of who this player is */
  description: string;
  /** What a good defensive plan should look like in plain English */
  expected_plan: string;
  inputs: any;
  clubContext?: any;
  quality: QualityCheck[];
}

// ─── Evaluation profiles ──────────────────────────────────────────────────────
const profiles: EvalProfile[] = [

  // ─── 1. Post scorer dominante ─────────────────────────────────────────────
  {
    id: "q001",
    description: "Dominant post scorer, right block, hook + fade, physical, no exterior range",
    expected_plan: "DENY: Front the right block — deny post entry. FORCE: No space in the paint. ALLOW: Spot-up threes. AWARE: Hook shot threat.",
    inputs: {
      pos: "C", hand: "R", ath: 3, phys: 5, usage: "primary",
      selfCreation: "high",
      postFreq: "P", postEff: "high", postProfile: "B2B",
      postShoulder: "R", postMoves: ["hook", "fade"],
      postEntry: "seal",
      isoFreq: "N", pnrFreq: "N", transFreq: "N",
      spotUpFreq: "N", deepRange: false,
      orebThreat: "high", putbackQuality: "primary",
      contactFinish: "seeks", offHandFinish: "capable",
      vision: 2, floater: "N",
      cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      screenerAction: null, ballHandling: null, pressureResponse: null,
    },
    quality: [
      { label: "Top situation is post", top_situation_is: ["post_right", "post_left", "post"] },
      { label: "DENY mentions blocking/fronting/entry", deny_contains: ["block", "front", "shoulder", "entry", "position", "right"] },
      { label: "DENY text is professional (>40 chars)", deny_min_length: 40 },
      { label: "ALLOW mentions spot-up/threes/perimeter", allow_contains: ["spot", "three", "perimeter", "range"] },
      { label: "DENY does not mention ISO", deny_not_contains: ["iso", "isolation", "dribble"] },
      { label: "Archetype is post scorer", archetype_is: ["archetype_post_scorer"] },
    ],
  },

  // ─── 2. PnR handler élite ─────────────────────────────────────────────────
  {
    id: "q002",
    description: "Elite PnR handler, drives right, pull-up left, deep range, vision 5",
    expected_plan: "DENY: Deny the PnR downhill catch, stay over screen. FORCE: Force left (weaker finish side). ALLOW: ISO low-efficiency. AWARE: Elite passer.",
    inputs: {
      pos: "PG", hand: "R", ath: 4, phys: 3, usage: "primary",
      selfCreation: "high", starPlayer: true,
      pnrFreq: "P", pnrEff: "high", pnrPri: "SF", trapResponse: "escape",
      pnrFinishLeft: "Pull-up", pnrFinishRight: "Drive to Rim",
      spotUpFreq: "S", deepRange: true,
      isoFreq: "R", isoEff: "low", postFreq: "N", transFreq: "S",
      vision: 5, orebThreat: "low",
      floater: "S", cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      contactFinish: "neutral", offHandFinish: "capable",
      screenerAction: null, ballHandling: "elite", pressureResponse: "escapes",
    },
    quality: [
      { label: "Top situation is PnR", top_situation_is: ["pnr_ball"] },
      { label: "DENY mentions screen/downhill/catch", deny_contains: ["screen", "downhill", "catch", "over"] },
      { label: "DENY text is professional (>50 chars)", deny_min_length: 50 },
      { label: "FORCE mentions direction (left/right)", force_contains: ["left", "force"] },
      { label: "Archetype is PnR orchestrator", archetype_is: ["archetype_pnr_orchestrator"] },
    ],
  },

  // ─── 3. ISO scorer puro, izquierda, busca contacto ───────────────────────
  {
    id: "q003",
    description: "ISO scorer, goes left (dominant), seeks contact, pull-up specialist, no PnR",
    expected_plan: "DENY: Deny left wing catch. FORCE: Force right (weak side). Expect contact. ALLOW: Transition.",
    inputs: {
      pos: "SG", hand: "L", ath: 4, phys: 3, usage: "primary",
      selfCreation: "high",
      isoFreq: "P", isoEff: "high", isoDir: "L", isoDec: "S",
      pnrFreq: "N", postFreq: "N",
      spotUpFreq: "S", deepRange: false,
      transFreq: "R",
      vision: 3, orebThreat: "low",
      floater: "N", cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      contactFinish: "seeks", offHandFinish: "capable",
      screenerAction: null, ballHandling: "capable", pressureResponse: null,
    },
    quality: [
      { label: "Top situation is ISO left", top_situation_is: ["iso_left", "iso_both"] },
      { label: "DENY mentions left", deny_contains: ["left"] },
      { label: "DENY text is professional (>40 chars)", deny_min_length: 40 },
      { label: "FORCE mentions right (push to weak side)", force_contains: ["right"] },
      { label: "FORCE does not mention trap (no PnR)", force_not_contains: ["trap", "hedge"] },
      { label: "Archetype is ISO scorer", archetype_is: ["archetype_iso_scorer"] },
    ],
  },

  // ─── 4. Screener pop + spot-up, sin ISO ──────────────────────────────────
  {
    id: "q004",
    description: "PF pop screener with deep range. Shoots immediately off the screen. No ISO, no post.",
    expected_plan: "DENY: Contest the pop — deny the catch at the arc. ALLOW: Post-up. No ISO threat.",
    inputs: {
      pos: "PF", hand: "R", ath: 3, phys: 4, usage: "secondary",
      selfCreation: "medium",
      screenerAction: "pop", deepRange: true,
      pnrFreq: "P", pnrEff: "medium",
      spotUpFreq: "S", spotZone: "wing",
      isoFreq: "N", postFreq: "N", transFreq: "R",
      orebThreat: "medium",
      vision: 3, floater: "N",
      cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      contactFinish: "neutral", offHandFinish: "capable",
      ballHandling: null, pressureResponse: null,
    },
    quality: [
      { label: "Top situation is pnr_screener or catch_shoot", top_situation_is: ["pnr_screener", "catch_shoot"] },
      { label: "DENY mentions pop/screen/contest/three", deny_contains: ["pop", "screen", "contest", "shoot", "space"] },
      { label: "DENY text is professional (>30 chars)", deny_min_length: 30 },
      { label: "DENY does not mention ISO", deny_not_contains: ["isolation", "iso "] },
    ],
  },

  // ─── 5. Role player off-ball — cortador compulsivo ───────────────────────
  {
    id: "q005",
    description: "Pure cutter/connector role player. Backdoor cuts, no self-creation, no shooting.",
    expected_plan: "DENY: Stay ball-side on cuts. No help off this player. ALLOW: Spot-up (no range). FORCE: None meaningful.",
    inputs: {
      pos: "SF", hand: "R", ath: 4, phys: 3, usage: "role",
      selfCreation: "low",
      cutFreq: "P", cutType: "backdoor",
      offBallRole: "cutter",
      isoFreq: "N", pnrFreq: "N", postFreq: "N",
      spotUpFreq: "N", deepRange: false,
      transFreq: "S",
      vision: 3, orebThreat: "low",
      floater: "N", dhoFreq: "N", indirectFreq: "N",
      contactFinish: "neutral", offHandFinish: "capable",
      screenerAction: null, ballHandling: null, pressureResponse: null,
    },
    quality: [
      { label: "Top situation is cut", top_situation_is: ["cut"] },
      { label: "DENY mentions cut/backdoor/ball-side", deny_contains: ["cut", "backdoor", "ball"] },
      { label: "DENY does not mention PnR handler", deny_not_contains: ["downhill", "pnr", "screen handler"] },
      { label: "DENY does not mention post entry", deny_not_contains: ["post entry", "block", "front the"] },
    ],
  },

  // ─── 6. Pressure liability — manejo terrible ─────────────────────────────
  {
    id: "q006",
    description: "Guard with ball-handling liability. Full-court pressure approach. Loses ball under pressure.",
    expected_plan: "FORCE: Attack the ball — deny touches. ALLOW: Ball handling (let her dribble, not drive). AWARE: Pressure vulnerability.",
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
    quality: [
      { label: "FORCE mentions ball/pressure/attack", force_contains: ["ball", "deny", "attack", "pressure", "liability"] },
      { label: "FORCE does not recommend trap (no PnR)", force_not_contains: ["trap", "hedge"] },
      { label: "ALLOW mentions ball handling", allow_contains: ["ball", "dribble"] },
      { label: "Alerts mention pressure vulnerability", alerts_mention: ["pressure", "vuln"] },
    ],
  },

  // ─── 7. Tiradora spot-up primaria — sin creación ─────────────────────────
  {
    id: "q007",
    description: "Primary spot-up shooter, corners, deep range, no self-creation, role player.",
    expected_plan: "DENY: No open catch in corners — aggressive closeout. ALLOW: ISO (no creation). No force_early.",
    inputs: {
      pos: "SG", hand: "R", ath: 3, phys: 2, usage: "role",
      selfCreation: "low",
      spotUpFreq: "P", spotZone: "corner", deepRange: true, spotUpAction: "shoot",
      isoFreq: "N", pnrFreq: "N", postFreq: "N",
      transFreq: "S",
      vision: 3, orebThreat: "low",
      floater: "N", dhoFreq: "N", indirectFreq: "N",
      contactFinish: "neutral", offHandFinish: "capable",
      screenerAction: null, ballHandling: null, pressureResponse: null,
    },
    quality: [
      { label: "Top situation is catch_shoot", top_situation_is: ["catch_shoot"] },
      { label: "DENY mentions corners/close out/catch", deny_contains: ["corner", "close", "catch", "contest"] },
      { label: "DENY text is professional (>40 chars)", deny_min_length: 40 },
      { label: "ALLOW mentions ISO (no creation)", allow_contains: ["iso", "dribble"] },
      { label: "FORCE does not mention early shot (role player)", force_not_contains: ["early", "clock"] },
    ],
  },

  // ─── 8. Big transition rim runner ────────────────────────────────────────
  {
    id: "q008",
    description: "C rim runner in transition, rolls hard, duck-in, high oreb. No exterior.",
    expected_plan: "DENY: Sprint to rim — no transition layups. Box out. ALLOW: Spot-up threes.",
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
    quality: [
      { label: "Top situation includes transition or pnr_screener", top_situation_is: ["transition", "pnr_screener", "oreb", "cut"] },
      { label: "DENY mentions rim/sprint", deny_contains: ["rim", "sprint", "run"] },
      { label: "ALLOW mentions spot-up/perimeter/range", allow_contains: ["perimeter", "range"] },
      { label: "DENY does not mention ISO", deny_not_contains: ["isolation", "iso space"] },
    ],
  },

  // ─── 9. ISO handler bajo presión — lucha en PnR ──────────────────────────
  {
    id: "q009",
    description: "PnR handler who struggles vs traps. Loses ball under blitz. Force trap approach.",
    expected_plan: "DENY: PnR downhill. FORCE: Trap/hedge — they struggle to escape. ALLOW: Ball handling.",
    inputs: {
      pos: "PG", hand: "R", ath: 3, phys: 2, usage: "primary",
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
    quality: [
      { label: "Top situation is pnr_ball", top_situation_is: ["pnr_ball"] },
      { label: "FORCE mentions trap/hedge", force_contains: ["trap", "hedge", "struggle"] },
      { label: "FORCE text is professional (>30 chars)", force_min_length: 30 },
      { label: "DENY does not recommend giving space (opposite of trap)", deny_not_contains: ["give space", "allow", "sag"] },
    ],
  },

  // ─── 10. Stretch big europeo — pop + triple ──────────────────────────────
  {
    id: "q010",
    description: "European stretch big: PnR pop screener, immediate 3PT shooter, no interior game.",
    expected_plan: "DENY: Contest the pop — no space to catch and shoot. ALLOW: Post-up (no threat). Force out of paint.",
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
      cutFreq: "N", dhoFreq: "N", indirectFreq: "N",
      contactFinish: "neutral", offHandFinish: "capable",
      ballHandling: null, pressureResponse: null,
    },
    quality: [
      { label: "Top situation is catch_shoot or pnr_screener", top_situation_is: ["catch_shoot", "pnr_screener"] },
      { label: "DENY mentions pop/screen/space/catch/contest", deny_contains: ["pop", "screen", "space", "catch", "contest", "shoot"] },
      { label: "ALLOW mentions post (no post threat)", allow_contains: ["post"] },
      { label: "DENY does not confuse with ISO", deny_not_contains: ["drive", "iso", "penetr"] },
    ],
  },

];

// ─── Evaluation engine ────────────────────────────────────────────────────────

interface CheckResult {
  label: string;
  passed: boolean;
  detail: string;
}

interface ProfileResult {
  id: string;
  description: string;
  expected_plan: string;
  passed: boolean;
  score: number;
  checks: CheckResult[];
  rendered: {
    archetype: string;
    danger: number;
    top_situations: string[];
    deny: string;
    force: string;
    allow: string;
    alerts: string[];
    deny_text: string;
    force_text: string;
    allow_text: string;
  };
}

function runChecks(profile: EvalProfile, result: ReturnType<typeof generateMotorV4>, rendered: ReturnType<typeof renderReport>): CheckResult[] {
  const checks: CheckResult[] = [];

  const denyText = rendered.defense.deny.instruction.toLowerCase();
  const forceText = rendered.defense.force.instruction.toLowerCase();
  const allowText = rendered.defense.allow.instruction.toLowerCase();
  const alertsText = result.alerts.map(a => a.key).join(" ").toLowerCase();
  const situations = result.situations.slice(0, 3).map(s => s.id);

  for (const q of profile.quality) {
    let passed = true;
    let detail = "";

    if (q.top_situation_is) {
      const match = q.top_situation_is.some(s => situations[0]?.includes(s) || situations[0] === s);
      if (!match) { passed = false; detail = `Top situation is "${situations[0]}", expected one of: ${q.top_situation_is.join(", ")}`; }
      else detail = `✓ Top situation: ${situations[0]}`;
    }

    if (q.deny_contains) {
      const missing = q.deny_contains.filter(w => !denyText.includes(w.toLowerCase()));
      if (missing.length > 0) { passed = false; detail = `Missing words in DENY: ${missing.join(", ")} — got: "${rendered.defense.deny.instruction.slice(0, 80)}"`; }
      else detail = `✓ DENY contains: ${q.deny_contains.join(", ")}`;
    }

    if (q.force_contains) {
      const missing = q.force_contains.filter(w => !forceText.includes(w.toLowerCase()));
      if (missing.length > 0) { passed = false; detail = `Missing words in FORCE: ${missing.join(", ")} — got: "${rendered.defense.force.instruction.slice(0, 80)}"`; }
      else detail = `✓ FORCE contains: ${q.force_contains.join(", ")}`;
    }

    if (q.allow_contains) {
      const missing = q.allow_contains.filter(w => !allowText.includes(w.toLowerCase()));
      if (missing.length > 0) { passed = false; detail = `Missing words in ALLOW: ${missing.join(", ")} — got: "${rendered.defense.allow.instruction.slice(0, 80)}"`; }
      else detail = `✓ ALLOW contains: ${q.allow_contains.join(", ")}`;
    }

    if (q.deny_not_contains) {
      const found = q.deny_not_contains.filter(w => denyText.includes(w.toLowerCase()));
      if (found.length > 0) { passed = false; detail = `DENY incorrectly contains: ${found.join(", ")} — contradiction`; }
      else detail = `✓ DENY correctly avoids: ${q.deny_not_contains.join(", ")}`;
    }

    if (q.force_not_contains) {
      const found = q.force_not_contains.filter(w => forceText.includes(w.toLowerCase()));
      if (found.length > 0) { passed = false; detail = `FORCE incorrectly contains: ${found.join(", ")} — contradiction`; }
      else detail = `✓ FORCE correctly avoids: ${q.force_not_contains.join(", ")}`;
    }

    if (q.deny_min_length !== undefined) {
      const len = rendered.defense.deny.instruction.length;
      if (len < q.deny_min_length) { passed = false; detail = `DENY text too short (${len} chars < ${q.deny_min_length}): "${rendered.defense.deny.instruction}"`; }
      else detail = `✓ DENY text length OK (${len} chars)`;
    }

    if (q.force_min_length !== undefined) {
      const len = rendered.defense.force.instruction.length;
      if (len < q.force_min_length) { passed = false; detail = `FORCE text too short (${len} chars < ${q.force_min_length}): "${rendered.defense.force.instruction}"`; }
      else detail = `✓ FORCE text length OK (${len} chars)`;
    }

    if (q.alerts_mention) {
      const match = q.alerts_mention.some(w => alertsText.includes(w.toLowerCase()));
      if (!match) { passed = false; detail = `Alerts missing concept: ${q.alerts_mention.join(", ")} — got: ${result.alerts.map(a => a.key).join(", ")}`; }
      else detail = `✓ Alerts mention: ${q.alerts_mention.join(", ")}`;
    }

    if (q.archetype_is) {
      const arch = result.identity.archetypeKey;
      if (!q.archetype_is.includes(arch)) { passed = false; detail = `Archetype is "${arch}", expected: ${q.archetype_is.join(", ")}`; }
      else detail = `✓ Archetype: ${arch}`;
    }

    checks.push({ label: q.label, passed, detail });
  }

  return checks;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const results: ProfileResult[] = [];
let totalProfiles = 0;
let passedProfiles = 0;
let totalChecks = 0;
let passedChecks = 0;

for (const profile of profiles) {
  totalProfiles++;
  let motorResult: ReturnType<typeof generateMotorV4>;
  let rendered: ReturnType<typeof renderReport>;

  try {
    motorResult = generateMotorV4(profile.inputs, profile.clubContext);
    rendered = renderReport(motorResult, { locale: "en", gender: "n" });
  } catch (err) {
    results.push({
      id: profile.id, description: profile.description, expected_plan: profile.expected_plan,
      passed: false, score: 0,
      checks: [{ label: "Motor/render crash", passed: false, detail: String(err) }],
      rendered: { archetype: "CRASH", danger: 0, top_situations: [], deny: "", force: "", allow: "", alerts: [], deny_text: String(err), force_text: "", allow_text: "" },
    });
    continue;
  }

  const checks = runChecks(profile, motorResult, rendered);
  const profilePassed = checks.every(c => c.passed);
  const profileScore = Math.round((checks.filter(c => c.passed).length / checks.length) * 100);
  if (profilePassed) passedProfiles++;
  totalChecks += checks.length;
  passedChecks += checks.filter(c => c.passed).length;

  results.push({
    id: profile.id, description: profile.description, expected_plan: profile.expected_plan,
    passed: profilePassed, score: profileScore,
    checks,
    rendered: {
      archetype: motorResult.identity.archetypeKey,
      danger: motorResult.identity.dangerLevel,
      top_situations: motorResult.situations.slice(0, 3).map(s => s.id),
      deny: motorResult.defense.deny.winner.key,
      force: motorResult.defense.force.winner.key,
      allow: motorResult.defense.allow.winner.key,
      alerts: motorResult.alerts.map(a => a.key),
      deny_text: rendered.defense.deny.instruction,
      force_text: rendered.defense.force.instruction,
      allow_text: rendered.defense.allow.instruction,
    },
  });
}

// ─── Output ───────────────────────────────────────────────────────────────────

const globalScore = Math.round((passedChecks / totalChecks) * 100);
const lines: string[] = [];

lines.push("╔══════════════════════════════════════════════════════════════╗");
lines.push("║          U Scout — Motor Quality Evaluation                  ║");
lines.push("╚══════════════════════════════════════════════════════════════╝");
lines.push(`  Profiles: ${totalProfiles} | ✓ ${passedProfiles} passed | Score: ${globalScore}% (${passedChecks}/${totalChecks} checks)`);
lines.push("");

for (const r of results) {
  const icon = r.passed ? "✅" : "❌";
  const bar = `[${"█".repeat(Math.floor(r.score / 10))}${"░".repeat(10 - Math.floor(r.score / 10))}]`;
  lines.push(`${icon} ${bar} ${r.score}% — [${r.id}] ${r.description}`);
  lines.push(`   Archetype: ${r.rendered.archetype} | Danger: ${r.rendered.danger} | Situations: ${r.rendered.top_situations.join(", ")}`);
  lines.push(`   Expected:  ${r.expected_plan}`);
  lines.push(`   DENY:  ${r.rendered.deny_text}`);
  lines.push(`   FORCE: ${r.rendered.force_text}`);
  lines.push(`   ALLOW: ${r.rendered.allow_text}`);
  if (r.rendered.alerts.length > 0) lines.push(`   ALERTS: ${r.rendered.alerts.join(", ")}`);
  lines.push("");
  for (const c of r.checks) {
    const ci = c.passed ? "  ✓" : "  ✗";
    lines.push(`${ci}  ${c.label}`);
    if (!c.passed) lines.push(`      → ${c.detail}`);
  }
  lines.push("");
}

lines.push("══════════════════════════════════════════════════════════════");
lines.push(`  OVERALL: ${globalScore}% (${passedChecks}/${totalChecks} checks | ${passedProfiles}/${totalProfiles} profiles)`);
lines.push("══════════════════════════════════════════════════════════════");

const output = lines.join("\n");
console.log(output);
fs.writeFileSync("scripts/eval-quality-results.txt", output);
console.log("\nResults written to scripts/eval-quality-results.txt");
