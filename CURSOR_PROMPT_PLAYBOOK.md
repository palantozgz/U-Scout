# Cursor Prompt — Playbook tabs + Defensive System Builder (React port)

## Scope
Two files to create/modify:
1. `client/src/lib/defensive-system.ts` — pure logic extracted from the HTML (no React, no DOM)
2. `client/src/pages/core/Playbook.tsx` — full rewrite: tabs + wizard UI

No other files. Run `npm run check` after. No drizzle-kit push.

---

## FILE 1: `client/src/lib/defensive-system.ts` — CREATE (new file)

Extract the logic from defensive-system-builder-elite.html verbatim.
Pure TypeScript, no DOM, no React.

```typescript
// defensive-system.ts
// Ported from defensive-system-builder-elite.html
// All logic is pure — no DOM, no React dependencies.

export interface StepOption {
  v: string;
  t: string;
  d?: string;
}

export interface Step {
  id: string;
  q: string;
  h: string;
  opts: StepOption[];
}

export interface Answers {
  [key: string]: string;
}

export interface Tactics {
  priority: string;
  driveDirection: string;
  onBall: string;
  pnrCoverage: string;
  coverageSubtype: string;
  sideRule: string;
  middleRule: string;
  rimProtection: string;
  mobilityBig: string;
  switchability: string;
  discipline: string;
  transitionSafety: string;
  transitionPriority: string;
  reboundBalance: string;
  helpStructure: string;
  helpTiming: string;
  helpIntensity: string;
  tag: string;
  rotation: string;
  pop: string;
  skip: string;
  penetration: string;
  peel: string;
  shortRoll: string;
  mismatch: string;
  closeouts: string;
  sidePnR: string;
  forceDirection: string;
  bigRole?: string;
  lowMan?: string;
  middlePnR: string;
  sidePnRRule: string;
  middlePnRRule: string;
  rotationModel: string;
  mismatchResponse: string;
  lowManTag: string;
  offBallPosition: string;
  kypDenyMode: string;
  kypHelpOff: string;
  kypStuntUsage: string;
  postDefense: string;
  earlyScreen: string;
  [key: string]: string | undefined;
}

export interface DerivationResult {
  tactics: Tactics;
  explanations: { title: string; text: string }[];
  warnings: string[];
  tradeOffs: string[];
}

export interface Report {
  name: string;
  identity: string;
  anchor: string[];
  derivedSystem: string[];
  causal: string[];
  tradeOffs: string[];
  warnings: string[];
  trans: string[];
  reb: string[];
  early: string[];
  st: string[];
  wk: string[];
  us: string[];
}

export const COV_SUBTYPE_OPTS: Record<string, StepOption[]> = {
  drop: [
    { v: 'deep', t: 'Deep drop', d: 'Big stays attached to roller; protect rim first.' },
    { v: 'high', t: 'High drop', d: 'Big higher; earlier touch on ballhandler.' },
  ],
  hedge: [
    { v: 'soft', t: 'Soft hedge / show', d: 'Brief touch; quick recover.' },
    { v: 'hard', t: 'Hard hedge / show', d: 'Longer show; more load on helpers.' },
  ],
  switch: [
    { v: 'flat', t: 'Flat switch', d: 'Exchange level; limit back-line exposure.' },
    { v: 'aggressive', t: 'Aggressive switch', d: 'Earlier exchange; more pressure on release.' },
  ],
  blitz: [
    { v: 'standard', t: 'Standard blitz', d: 'Classic two-to-the-ball trap look.' },
    { v: 'containTrap', t: 'Contain trap', d: 'Short-corner trap; contain first step then spring.' },
  ],
};

export const STEPS: Step[] = [
  {
    id: 'priority', q: 'Defensive priority', h: 'What you protect at all costs (identity).',
    opts: [
      { v: 'rim', t: 'Protect the rim', d: 'Shrink paint; contest twos.' },
      { v: 'three', t: 'Protect the 3', d: 'High contests; nail help.' },
      { v: 'disrupt', t: 'Disrupt the ball', d: 'Pressure; gaps; turnovers.' },
    ],
  },
  {
    id: 'driveDirection', q: 'Drive direction philosophy', h: 'Forcing rules (identity).',
    opts: [
      { v: 'noMiddle', t: 'No middle', d: 'Baseline / sideline walls.' },
      { v: 'forceMiddle', t: 'Force middle', d: 'Pack paint; tags.' },
      { v: 'funnel', t: 'Funnel', d: 'Channel to defined help pockets.' },
    ],
  },
  {
    id: 'onBall', q: 'On-ball pressure', h: 'Default ball pressure (identity).',
    opts: [
      { v: 'contain', t: 'Contain', d: 'Gap; feet on floor; wall drives.' },
      { v: 'pressure', t: 'Pressure', d: 'Up touch; shrink clock; more risk.' },
      { v: 'turn', t: 'Turn', d: 'Force pick-up; deny rhythm; high foul discipline.' },
    ],
  },
  {
    id: 'pnrCoverage', q: 'Pick-and-roll coverage (anchor)', h: 'Determines help, rotations, and paint answers downstream.',
    opts: [
      { v: 'drop', t: 'Drop', d: 'Contain two to the ball; low rotation volume.' },
      { v: 'switch', t: 'Switch', d: 'Exchange shell; stay square.' },
      { v: 'blitz', t: 'Blitz', d: 'Trap; early help; X-out chain.' },
      { v: 'hedge', t: 'Hedge / show', d: 'Touch time; tag roller; recover or rotate by load.' },
    ],
  },
  {
    id: 'sideRule', q: 'Side Pick & Roll coverage', h: 'How you defend side PnR (wing).',
    opts: [
      { v: 'ice', t: 'ICE (baseline)', d: 'Force baseline, deny middle.' },
      { v: 'weak', t: 'WEAK', d: 'Force weak hand.' },
      { v: 'standard', t: 'Standard', d: 'No directional force.' },
    ],
  },
  {
    id: 'middleRule', q: 'Middle Pick & Roll coverage', h: 'Top PnR rules.',
    opts: [
      { v: 'weak', t: 'WEAK', d: 'Force weak hand.' },
      { v: 'standard', t: 'Standard', d: 'Contain.' },
      { v: 'switch', t: 'Switch', d: 'Switch middle.' },
    ],
  },
  {
    id: 'coverageSubtype', q: 'Coverage subtype', h: 'Refines the anchor technique (staff vocabulary).',
    opts: [], // dynamic — populated from COV_SUBTYPE_OPTS[answers.pnrCoverage]
  },
  {
    id: 'rimProtection', q: 'Personnel — rim protection', h: 'Big / back-line rim deterrence.',
    opts: [
      { v: 'low', t: 'Low', d: 'Limited rim vertical or small lineups.' },
      { v: 'medium', t: 'Medium', d: 'Balanced rim presence.' },
      { v: 'high', t: 'High', d: 'Elite rim protection anchor.' },
    ],
  },
  {
    id: 'mobilityBig', q: 'Personnel — big mobility', h: 'Ability to show, recover, blitz.',
    opts: [
      { v: 'low', t: 'Low', d: 'Stay home / drop biased.' },
      { v: 'high', t: 'High', d: 'Comfortable showing and recovering.' },
    ],
  },
  {
    id: 'switchability', q: 'Personnel — switchability', h: 'Positional size and switch tolerance.',
    opts: [
      { v: 'low', t: 'Low', d: 'Traditional matchups; scram late.' },
      { v: 'medium', t: 'Medium', d: 'Selective switches.' },
      { v: 'high', t: 'High', d: 'Switch-heavy personnel.' },
    ],
  },
  {
    id: 'discipline', q: 'Personnel — discipline', h: 'Foul and scramble execution.',
    opts: [
      { v: 'low', t: 'Low', d: 'Youth / volatile foul environment.' },
      { v: 'high', t: 'High', d: 'Veteran execution; situational scrams.' },
    ],
  },
  {
    id: 'transitionSafety', q: 'Transition safety', h: 'Getting back (philosophy).',
    opts: [
      { v: 'oneBack', t: '1 back', d: 'One safety.' },
      { v: 'twoBack', t: '2 back', d: 'Double safety.' },
      { v: 'matchups', t: 'Matchups', d: 'No assigned safety.' },
      { v: 'tagUpTrans', t: 'Tag Up', d: 'Linked to Tag Up ORB.' },
    ],
  },
  {
    id: 'transitionPriority', q: 'Transition priority', h: 'Order in conversion (philosophy).',
    opts: [
      { v: 'stopBall', t: 'Stop ball', d: 'Pick up early.' },
      { v: 'protectRim', t: 'Protect rim', d: 'Pack first.' },
      { v: 'wall', t: 'Wall', d: 'Channel; contain.' },
    ],
  },
  {
    id: 'reboundBalance', q: 'Offensive rebounding', h: 'Glass rules (philosophy).',
    opts: [
      { v: 'crash', t: 'Crash', d: 'Maximum numbers.' },
      { v: 'balanced', t: 'Balanced', d: '2–3 crashers.' },
      { v: 'safetyFirst', t: 'Safety-first', d: '1–2 rarely crash.' },
      { v: 'tagUp', t: 'Tag Up', d: 'Five tag; matchup transition.' },
    ],
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function tagUpOrb(a: Answers): boolean {
  return a.reboundBalance === 'tagUp';
}

function tagTransOk(a: Answers): boolean {
  return a.transitionSafety === 'tagUpTrans' || a.transitionSafety === 'matchups';
}

function lbl(a: Answers, id: string): string {
  const s = STEPS.find(z => z.id === id);
  if (!s) return '';
  const opts = id === 'coverageSubtype'
    ? (COV_SUBTYPE_OPTS[a.pnrCoverage] ?? [])
    : s.opts;
  const o = opts.find(z => z.v === a[id]);
  return o ? o.t : '';
}

const DERIVED_LABELS: Record<string, Record<string, string>> = {
  rimProtection: { low: 'Rim protection: low', medium: 'Rim protection: medium', high: 'Rim protection: high' },
  mobilityBig: { low: 'Big mobility: low', high: 'Big mobility: high' },
  switchability: { low: 'Switchability: low', medium: 'Switchability: medium', high: 'Switchability: high' },
  discipline: { low: 'Discipline: low', high: 'Discipline: high' },
  helpStructure: { weak: 'Weak-side', strong: 'Strong-side', mixed: 'Mixed', none: 'Minimal (switch skeleton)' },
  helpTiming: { early: 'Early', late: 'Late' },
  helpIntensity: { none: 'None', stunt: 'Stunt', dig: 'Dig', full: 'Full' },
  rotationModel: { none: 'None', recover: 'Recover', conditional: 'Conditional', rotate: 'Rotation (X-out)', switch: 'Switch', peel: 'Peel' },
  mismatchResponse: { accept: 'Accept', scram: 'Scram', situationalScram: 'Situational scram' },
  sidePnRRule: { standard: 'Standard', switch: 'Switch', ice: 'ICE', weak: 'WEAK' },
  middlePnRRule: { weak: 'WEAK', standard: 'Standard', switch: 'Switch' },
  lowManTag: { always: 'Always tag', conditional: 'Conditional tag', none: 'None' },
  postDefense: { onev1: '1v1', dig: 'Dig', double: 'Double' },
  offBallPosition: { gap: 'Gap', deny: 'Deny', attached: 'Attached' },
  kypDenyMode: { shooters: 'Deny shooters', all: 'Deny all' },
  kypHelpOff: { yes: 'Help off yes', no: 'Help off no' },
  kypStuntUsage: { always: 'Always', situational: 'Situational' },
  closeouts: { aggressive: 'Aggressive', controlled: 'Controlled' },
  earlyScreen: { switch: 'Switch', contain: 'Contain' },
};

function tlabel(t: Partial<Tactics>, id: string): string {
  const L = DERIVED_LABELS[id];
  if (L && t[id] != null && L[t[id] as string]) return L[t[id] as string];
  return '';
}

function buildTradeOffs(t: Partial<Tactics>): string[] {
  const o: string[] = [];
  if (t.pnrCoverage === 'blitz') o.push('Blitz creates 4-on-3 behind the trap: skip passes, quick reversals, and long closeouts are the structural tax you accept for ball pressure.');
  if (t.pnrCoverage === 'switch') o.push('Switch trades matchup integrity for containment — small-on-big post-ups, isolations, and offensive rebounding on mismatches are the structural tax.');
  if (t.pnrCoverage === 'drop') o.push('Drop concedes clean rhythm midrange while the big contains two-on-two — that jumper pocket is the structural tax for rim protection.');
  if (t.pnrCoverage === 'hedge') o.push('Hedge lives on recovery: if the big cannot flatten out in time, pocket drives, throw-backs, and late-tag rollers are the structural tax.');
  return o;
}

// ── Derivation ────────────────────────────────────────────────────────────────

export function derive(inp: Answers): DerivationResult {
  const t: Partial<Tactics> = {};
  const cov = inp.pnrCoverage;
  const side = inp.sideRule;
  const mid = inp.middleRule;
  const pr = inp.priority;
  const dd = inp.driveDirection;
  const ob = inp.onBall;

  if (cov === 'switch') t.helpStructure = 'none';
  else if (cov === 'drop') {
    if (dd === 'noMiddle') t.helpStructure = 'weak';
    else if (dd === 'forceMiddle') t.helpStructure = 'strong';
    else t.helpStructure = 'mixed';
  } else if (cov === 'blitz') {
    if (pr === 'rim') t.helpStructure = 'weak';
    else if (pr === 'three') t.helpStructure = 'strong';
    else t.helpStructure = 'mixed';
  } else {
    t.helpStructure = 'mixed';
  }

  if (side === 'ice') {
    t.sidePnR = 'ICE'; t.forceDirection = 'baseline'; t.bigRole = 'drop lane line'; t.lowMan = 'weak side';
  } else if (side === 'weak') {
    t.sidePnR = 'WEAK'; t.forceDirection = 'weak hand'; t.lowMan = 'weak side';
  } else {
    t.sidePnR = 'standard'; t.forceDirection = 'neutral'; t.bigRole = 'shell';
  }

  t.middlePnR = mid === 'weak' ? 'WEAK' : mid === 'switch' ? 'SWITCH' : 'standard';
  t.helpTiming = (cov === 'drop' || cov === 'switch') ? 'late' : 'early';

  if (cov === 'switch') t.helpIntensity = 'none';
  else if (cov === 'blitz') t.helpIntensity = 'full';
  else if (cov === 'drop') t.helpIntensity = pr === 'three' ? 'dig' : 'stunt';
  else t.helpIntensity = 'dig';

  if (cov === 'switch') t.tag = 'none';
  else if (cov === 'blitz') t.tag = 'always early';
  else if (cov === 'hedge') t.tag = 'always';
  else t.tag = 'low man conditional';

  if (cov === 'switch') t.rotation = 'switch';
  else if (cov === 'blitz') t.rotation = 'x-out';
  else if (cov === 'drop') t.rotation = pr === 'three' ? 'x-out' : 'recover';
  else t.rotation = 'recover';

  t.pop = t.rotation === 'x-out' ? 'x-out' : 'direct closeout';
  t.skip = t.rotation === 'x-out' ? 'x-out chain' : 'recover / peel tags';
  t.penetration = cov === 'blitz' ? 'help chain' : 'contain';
  t.peel = 'enabled';
  t.shortRoll = cov === 'blitz' ? 'low man steps + rotate' : 'contain + recover';
  t.mismatch = inp.switchability === 'high' ? 'scram' : inp.discipline === 'high' ? 'situational scram' : 'accept';
  t.closeouts = pr === 'three' ? 'controlled' : 'aggressive';

  t.priority = pr; t.driveDirection = dd; t.onBall = ob;
  t.pnrCoverage = cov; t.coverageSubtype = inp.coverageSubtype;
  t.sideRule = side; t.middleRule = mid;
  t.rimProtection = inp.rimProtection; t.mobilityBig = inp.mobilityBig;
  t.switchability = inp.switchability; t.discipline = inp.discipline;
  t.transitionSafety = inp.transitionSafety; t.transitionPriority = inp.transitionPriority;
  t.reboundBalance = inp.reboundBalance;

  t.sidePnRRule = side === 'ice' ? 'ice' : side === 'weak' ? 'weak' : 'standard';
  t.middlePnRRule = mid === 'weak' ? 'weak' : mid === 'switch' ? 'switch' : 'standard';
  t.rotationModel = t.rotation === 'x-out' ? 'rotate' : t.rotation === 'switch' ? 'switch' : t.rotation === 'recover' ? 'recover' : 'conditional';
  t.mismatchResponse = t.mismatch === 'scram' ? 'scram' : t.mismatch === 'situational scram' ? 'situationalScram' : 'accept';
  t.lowManTag = t.tag === 'none' ? 'none' : (t.tag === 'always early' || t.tag === 'always') ? 'always' : 'conditional';
  t.offBallPosition = 'gap';
  t.kypDenyMode = 'shooters';
  t.kypHelpOff = 'yes';
  t.kypStuntUsage = cov === 'hedge' ? 'always' : 'situational';
  t.postDefense = 'onev1';
  t.earlyScreen = (ob === 'pressure' || ob === 'turn') ? 'switch' : 'contain';

  return {
    tactics: t as Tactics,
    explanations: [],
    warnings: [],
    tradeOffs: buildTradeOffs(t),
  };
}

export function assertInvariants(t: Tactics): boolean {
  if (t.pnrCoverage === 'switch') {
    if (t.helpStructure !== 'none' || t.helpTiming !== 'late') return false;
  }
  if (t.pnrCoverage === 'blitz') {
    if (t.rotation !== 'x-out' || t.penetration !== 'help chain' || t.helpIntensity !== 'full' || t.helpTiming !== 'early') return false;
  }
  if (t.pnrCoverage === 'hedge') {
    if (t.helpTiming !== 'early' || t.tag === 'none') return false;
  }
  return true;
}

// ── Validation ────────────────────────────────────────────────────────────────

export function coverageViabilityError(stepId: string, value: string, a: Answers): string | null {
  const m = { ...a, [stepId]: value };
  if (stepId === 'pnrCoverage' && value === 'switch' && m.switchability === 'low')
    return 'Switch shell is not viable with low switchability — change shell or personnel.';
  if (stepId === 'coverageSubtype' && m.pnrCoverage === 'hedge' && value === 'hard' && m.mobilityBig === 'low')
    return 'Hard hedge is not viable with a low-mobility big.';
  if (stepId === 'switchability' && value === 'low' && m.pnrCoverage === 'switch')
    return 'Low switchability cannot support a switch shell — change shell or switchability.';
  if (stepId === 'discipline' && value === 'low' && m.pnrCoverage === 'blitz')
    return 'Low discipline cannot support blitz volume — change shell or discipline.';
  if (stepId === 'mobilityBig' && value === 'low' && m.pnrCoverage === 'hedge' && m.coverageSubtype === 'hard')
    return 'Hard hedge requires big mobility — soften subtype or change shell.';
  return null;
}

export function validateAll(a: Answers): string[] {
  const errors: string[] = [];
  const ids = STEPS.map(s => s.id);
  for (const id of ids) {
    if (!a[id]) return ['Incomplete answers.'];
  }
  if (a.pnrCoverage === 'switch' && a.switchability === 'low')
    errors.push('Switch shell with low switchability is not viable.');
  if (a.pnrCoverage === 'blitz' && a.discipline === 'low')
    errors.push('Blitz with low discipline is not viable.');
  if (a.pnrCoverage === 'hedge' && a.coverageSubtype === 'hard' && a.mobilityBig === 'low')
    errors.push('Hard hedge with low big mobility is not viable.');
  if (tagUpOrb(a) && !tagTransOk(a))
    errors.push('Tag Up ORB requires Tag Up transition or matchup conversion.');
  if (a.transitionSafety === 'tagUpTrans' && a.reboundBalance !== 'tagUp')
    errors.push('Tag Up transition requires Tag Up rebounding.');
  if (a.reboundBalance === 'safetyFirst' && (tagUpOrb(a) || a.transitionSafety === 'tagUpTrans'))
    errors.push('Tag Up rules conflict with safety-first crashing.');
  return errors;
}

// ── Report builder ────────────────────────────────────────────────────────────

export function buildReport(a: Answers): Report {
  const pack = derive(a);
  const t = pack.tactics;

  // Name
  const np: string[] = [];
  if (tagUpOrb(a)) np.push('Tag Up');
  if (t.middlePnRRule === 'weak') np.push('WEAK');
  if (t.pnrCoverage === 'drop') np.push('Drop');
  else if (t.pnrCoverage === 'switch') np.push('Switch');
  else if (t.pnrCoverage === 'blitz') np.push('Blitz');
  else np.push('Hedge');
  const name = (np.length ? np.join(' · ') : 'Elite') + ' System';

  // Identity
  let id = '';
  if (t.priority === 'rim') id = 'Rim-first identity. ';
  else if (t.priority === 'three') id = 'Three-point protection identity. ';
  else id = 'Disruptive ball-pressure identity. ';
  id += t.driveDirection === 'noMiddle' ? 'No-middle drive rules. ' : t.driveDirection === 'forceMiddle' ? 'Force-middle pack rules. ' : 'Funnel channel rules. ';
  id += 'On-ball: ' + lbl(a, 'onBall') + '. ';
  id += 'Personnel: ' + tlabel(t, 'rimProtection') + ' · ' + tlabel(t, 'mobilityBig') + ' · ' + tlabel(t, 'switchability') + ' · ' + tlabel(t, 'discipline') + '.';

  const anchor = [
    'Shell: ' + lbl(a, 'pnrCoverage') + ' · subtype ' + lbl(a, 'coverageSubtype') + '.',
    'Side / middle alignment (derived): ' + tlabel(t, 'sidePnRRule') + ' · ' + tlabel(t, 'middlePnRRule') + '.',
  ];

  const derivedSystem = [
    'Side PnR: ' + t.sidePnR + ' (force ' + t.forceDirection + ')',
    'Middle PnR: ' + t.middlePnR,
    'Help: ' + t.helpStructure + ' | timing ' + t.helpTiming + ' | intensity ' + t.helpIntensity,
    'Tag: ' + t.tag,
    'Rotation: ' + t.rotation,
    'Pop: ' + t.pop,
    'Skip: ' + t.skip,
    'Penetration: ' + t.penetration,
    'Peel switch: ' + t.peel,
    'Short roll: ' + t.shortRoll,
    'Mismatch: ' + t.mismatch,
    'Closeouts: ' + t.closeouts,
  ];

  const trans: string[] = [lbl(a, 'transitionSafety') + ' · ' + lbl(a, 'transitionPriority') + '.'];
  if (tagUpOrb(a)) trans.push('Tag Up ORB: five contact tags, between man and basket, matchup transition — overrides fixed safety roles.');
  else if (t.transitionSafety === 'oneBack') trans.push('One safety to rim; release vs crash scripted.');
  else if (t.transitionSafety === 'twoBack') trans.push('Two safeties: ball then rim.');
  else trans.push('Matchup conversion; no assigned safety.');

  const reb: string[] = [];
  if (tagUpOrb(a)) reb.push('Maximum ORB with Tag Up rules; long-miss mismatch risk.');
  else if (t.reboundBalance === 'crash') reb.push('Crash when transition allows numbers.');
  else if (t.reboundBalance === 'balanced') reb.push('Balanced 2–3 crashers.');
  else reb.push('Safety-first release.');

  const early: string[] = [
    t.earlyScreen === 'switch'
      ? 'Early drags: switch exchanges before the shell is fully loaded (derived from on-ball pressure).'
      : 'Early drags: contain flat until the shell is set (derived from on-ball posture).',
  ];

  const st: string[] = [];
  const wk: string[] = [];
  const us: string[] = [];

  if (tagUpOrb(a)) { st.push('ORB volume without classic safety.'); wk.push('Tag fouls and transition mismatches.'); }
  if (t.pnrCoverage === 'blitz') st.push('Primary pressure: two to the ball forces predictable catches and long rotations when taught.');
  if (t.pnrCoverage === 'drop') st.push('Rim-first containment: two-on-two integrity vs common PnR looks.');
  if (t.transitionSafety === 'twoBack') st.push('Floor vs runners.');
  if (!st.length) st.push('Teachable layers for staff and players.');
  if (t.helpStructure === 'none') wk.push('Switch skeleton: elite isolation vs set matchups.');
  if (t.rotationModel === 'rotate') wk.push('Execution load: reversal speed and tag-up discipline on long rotations.');
  if (t.rotationModel === 'conditional') wk.push('Conditional gaps demand staff clarity on when low man lives vs recovers.');
  if (wk.length < 2) wk.push('Scouting still tests timing vs elite pull-up and transition.');
  if (t.priority === 'three') us.push('vs shooting.');
  if (t.transitionPriority === 'stopBall') us.push('vs transition.');
  if (t.pnrCoverage === 'switch') us.push('vs spread PnR.');
  if (us.length < 3) us.push('vs balanced: clarity wins.');

  return { name, identity: id, anchor, derivedSystem, causal: [], tradeOffs: pack.tradeOffs, warnings: pack.warnings, trans, reb, early, st, wk, us };
}
```

---

## FILE 2: `client/src/pages/core/Playbook.tsx` — FULL REWRITE

```typescript
import { useState } from 'react';
import { BookOpen, Shield, Zap, ChevronRight, RotateCcw, CheckCircle2, AlertCircle } from 'lucide-react';
import { ModuleNav } from '@/pages/core/ModuleNav';
import { ModuleHeader } from '@/components/branding/ModuleHeader';
import { useLocale } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import {
  STEPS,
  COV_SUBTYPE_OPTS,
  coverageViabilityError,
  validateAll,
  buildReport,
  type Answers,
  type Report,
} from '@/lib/defensive-system';

// ── Tab definitions ───────────────────────────────────────────────────────────

type PlaybookTab = 'defensive' | 'offensive' | 'atos';

const TABS: { id: PlaybookTab; label: string; icon: typeof Shield }[] = [
  { id: 'defensive', label: 'Defensiva', icon: Shield },
  { id: 'offensive', label: 'Ofensiva', icon: Zap },
  { id: 'atos', label: 'ATOs', icon: BookOpen },
];

// ── Placeholder tab ───────────────────────────────────────────────────────────

function ComingSoonTab({ icon: Icon, title, desc }: { icon: typeof Shield; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-5 pb-16 text-center px-6">
      <div className="relative flex items-center justify-center">
        <div className="absolute w-28 h-28 rounded-full bg-primary/8 blur-2xl" />
        <div className="relative w-16 h-16 rounded-2xl border border-primary/20 bg-primary/5 flex items-center justify-center">
          <Icon className="w-8 h-8 text-primary opacity-60" strokeWidth={1.5} />
        </div>
      </div>
      <div>
        <span className="inline-block text-[9px] font-black tracking-[3px] uppercase text-primary/50 mb-3 border border-primary/20 rounded-full px-3 py-1">
          EN DESARROLLO
        </span>
        <h2 className="text-xl font-black text-foreground mb-2">{title}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">{desc}</p>
      </div>
    </div>
  );
}

// ── Defensive System Builder ──────────────────────────────────────────────────

interface WizardState {
  answers: Answers;
  stepIndex: number;
  history: { stepIndex: number; answers: Answers }[];
}

function DefensiveSystemBuilder() {
  const [wizard, setWizard] = useState<WizardState>({ answers: {}, stepIndex: 0, history: [] });
  const [report, setReport] = useState<Report | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const N = STEPS.length;
  const done = wizard.stepIndex >= N;
  const pct = done ? 100 : Math.round(((wizard.stepIndex + 1) / N) * 100);

  function pick(stepId: string, value: string) {
    const newAnswers = { ...wizard.answers, [stepId]: value };
    // Reset dependent answers when pnrCoverage changes
    if (stepId === 'pnrCoverage') {
      delete newAnswers.coverageSubtype;
      delete newAnswers.sideRule;
      delete newAnswers.middleRule;
    }
    const newIndex = wizard.stepIndex + 1;
    setWizard({
      answers: newAnswers,
      stepIndex: newIndex,
      history: [...wizard.history, { stepIndex: wizard.stepIndex, answers: wizard.answers }],
    });

    if (newIndex >= N) {
      const errors = validateAll(newAnswers);
      if (errors.length) {
        setValidationErrors(errors);
        setReport(null);
      } else {
        setValidationErrors([]);
        setReport(buildReport(newAnswers));
      }
    }
  }

  function back() {
    if (!wizard.history.length) return;
    const prev = wizard.history[wizard.history.length - 1];
    setWizard({ ...prev, history: wizard.history.slice(0, -1) });
    setReport(null);
    setValidationErrors([]);
  }

  function restart() {
    setWizard({ answers: {}, stepIndex: 0, history: [] });
    setReport(null);
    setValidationErrors([]);
  }

  const step = STEPS[wizard.stepIndex];
  const opts = step?.id === 'coverageSubtype'
    ? (COV_SUBTYPE_OPTS[wizard.answers.pnrCoverage] ?? [])
    : step?.opts ?? [];

  return (
    <div className="flex flex-col flex-1 min-h-0">

      {/* Progress bar */}
      <div className="px-4 pb-3">
        <div className="flex justify-between text-[10px] font-semibold text-muted-foreground mb-1.5">
          <span>{done ? 'Completado' : `Paso ${wizard.stepIndex + 1} / ${N}`}</span>
          <span>{pct}%</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0 px-4 pb-4">

        {/* Final state */}
        {done ? (
          <div className="space-y-3">
            {validationErrors.length > 0 ? (
              <div className="rounded-xl border border-destructive/40 bg-destructive/8 p-4">
                <div className="flex items-start gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-sm font-bold text-destructive">Conflicto de viabilidad</p>
                </div>
                {validationErrors.map((e, i) => (
                  <p key={i} className="text-xs text-destructive/80 leading-relaxed">{e}</p>
                ))}
              </div>
            ) : report ? (
              <ReportView report={report} />
            ) : null}
          </div>
        ) : (
          /* Step */
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-black text-foreground leading-snug">{step?.q}</h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{step?.h}</p>
            </div>
            <div className="space-y-2.5">
              {opts.map((o) => {
                const errMsg = coverageViabilityError(step.id, o.v, wizard.answers);
                const blocked = !!errMsg;
                return (
                  <button
                    key={o.v}
                    type="button"
                    disabled={blocked}
                    onClick={() => pick(step.id, o.v)}
                    className={cn(
                      'w-full text-left rounded-xl border-2 p-4 transition-all duration-100',
                      blocked
                        ? 'border-border/30 bg-card/30 opacity-40 cursor-not-allowed'
                        : 'border-border bg-card hover:border-primary/60 hover:bg-primary/5 active:scale-[0.99]',
                    )}
                  >
                    <p className="text-sm font-bold text-foreground leading-snug">{o.t}</p>
                    {o.d && <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{o.d}</p>}
                    {errMsg && <p className="text-xs text-destructive mt-1.5 font-medium leading-relaxed">{errMsg}</p>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Nav buttons */}
      <div className="px-4 pb-4 pt-2 flex gap-2 border-t border-border/40">
        <button
          type="button"
          disabled={!wizard.history.length}
          onClick={back}
          className="flex-1 h-11 rounded-xl border border-border text-sm font-semibold text-muted-foreground disabled:opacity-30 hover:text-foreground hover:border-border/80 transition-colors"
        >
          Atrás
        </button>
        <button
          type="button"
          onClick={restart}
          className="flex items-center gap-1.5 px-4 h-11 rounded-xl border border-destructive/30 text-xs font-semibold text-destructive/70 hover:text-destructive hover:border-destructive/60 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reiniciar
        </button>
      </div>
    </div>
  );
}

// ── Report view ───────────────────────────────────────────────────────────────

function ReportSection({ title, items, type = 'list' }: { title: string; items: string[]; type?: 'list' | 'text' }) {
  if (!items.length) return null;
  return (
    <div className="space-y-1.5">
      <h4 className="text-[9px] font-black tracking-[2px] uppercase text-primary/70">{title}</h4>
      {type === 'text' ? (
        <p className="text-xs text-foreground/80 leading-relaxed">{items.join(' ')}</p>
      ) : (
        <ul className="space-y-1">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-foreground/80 leading-relaxed">
              <ChevronRight className="w-3 h-3 text-primary/50 shrink-0 mt-0.5" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReportView({ report }: { report: Report }) {
  return (
    <div className="space-y-4">
      {/* System name */}
      <div className="flex items-start gap-2">
        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-[9px] font-black tracking-[2px] uppercase text-emerald-500/70 mb-0.5">Sistema generado</p>
          <h3 className="text-lg font-black text-foreground leading-tight">{report.name}</h3>
        </div>
      </div>

      {/* Sections */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <ReportSection title="Identidad defensiva" items={[report.identity]} type="text" />
        <ReportSection title="Ancla (shell + subtipo)" items={report.anchor} />
        <ReportSection title="Sistema de media cancha derivado" items={report.derivedSystem} />
        <ReportSection title="Trade-offs estructurales" items={report.tradeOffs} />
        <ReportSection title="Fortalezas" items={report.st} />
        <ReportSection title="Debilidades" items={report.wk} />
        <ReportSection title="Plan de transición" items={report.trans} />
        <ReportSection title="Plan de rebote" items={report.reb} />
        <ReportSection title="Defensa temprana" items={report.early} type="text" />
        <ReportSection title="Uso ideal" items={report.us} />
        {report.warnings.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/8 p-3">
            <p className="text-[9px] font-black tracking-[2px] uppercase text-amber-500/70 mb-1.5">Avisos de staff</p>
            {report.warnings.map((w, i) => (
              <p key={i} className="text-xs text-amber-600 dark:text-amber-400 leading-relaxed">{w}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Playbook page ────────────────────────────────────────────────────────

export default function Playbook() {
  const { locale } = useLocale();
  const [activeTab, setActiveTab] = useState<PlaybookTab>('defensive');

  const tagline =
    locale === 'zh' ? '球队战术与策略' :
    locale === 'es' ? 'Táctica y estrategia de equipo' :
    'Team tactics & strategy';

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden md:pl-12 lg:pl-48">
      <main className="relative z-10 flex flex-col flex-1 min-h-0 max-w-2xl w-full mx-auto">

        <ModuleHeader module="playbook" tagline={tagline} />

        {/* Tabs */}
        <div className="flex gap-1 px-4 pb-3">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors',
                  active
                    ? 'bg-primary/10 text-primary border border-primary/30'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent',
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="flex flex-col flex-1 min-h-0">
          {activeTab === 'defensive' && <DefensiveSystemBuilder />}
          {activeTab === 'offensive' && (
            <ComingSoonTab
              icon={Zap}
              title="Sistema ofensivo"
              desc="Diseño de jugadas, acciones base y principios de ataque compartidos — próximamente."
            />
          )}
          {activeTab === 'atos' && (
            <ComingSoonTab
              icon={BookOpen}
              title="ATOs"
              desc="After Timeout plays y end-of-game sequences — próximamente."
            />
          )}
        </div>

      </main>

      <ModuleNav />
    </div>
  );
}
```

---

## Card Scout title fix (same Cursor session)

In `client/src/lib/locales/es.ts`, `en.ts`, and `zh.ts`:

Change ONLY `ucore_card_scout_title`:
- `es.ts`: `"Scout"` → `"U Scout"`
- `en.ts`: `"Scout"` → `"U Scout"`
- `zh.ts`: `"Scout"` → `"U Scout"` (brand name, not translated)

Do NOT change `ucore_nav_scout` — nav bar labels stay as-is.

---

## After implementation

Run `npm run check` — must be 0 errors before finishing.
