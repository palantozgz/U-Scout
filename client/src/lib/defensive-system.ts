// Pure logic ported from defensive-system-builder-elite.html
// No DOM, no React.

export interface StepOption { v: string; t: string; d?: string; }
export interface Step { id: string; q: string; h: string; opts: StepOption[]; }
export interface Answers { [key: string]: string; }
export interface Tactics {
  priority: string; driveDirection: string; onBall: string;
  pnrCoverage: string; coverageSubtype: string; sideRule: string; middleRule: string;
  rimProtection: string; mobilityBig: string; switchability: string; discipline: string;
  transitionSafety: string; transitionPriority: string; reboundBalance: string;
  helpStructure: string; helpTiming: string; helpIntensity: string; tag: string;
  rotation: string; pop: string; skip: string; penetration: string; peel: string;
  shortRoll: string; mismatch: string; closeouts: string;
  sidePnR: string; forceDirection: string; bigRole?: string; lowMan?: string;
  middlePnR: string; sidePnRRule: string; middlePnRRule: string; rotationModel: string;
  mismatchResponse: string; lowManTag: string; offBallPosition: string;
  kypDenyMode: string; kypHelpOff: string; kypStuntUsage: string;
  postDefense: string; earlyScreen: string;
  [key: string]: string | undefined;
}
export interface DerivationResult {
  tactics: Tactics;
  explanations: { title: string; text: string }[];
  warnings: string[];
  tradeOffs: string[];
}
export interface Report {
  name: string; identity: string; anchor: string[]; derivedSystem: string[];
  causal: string[]; tradeOffs: string[]; warnings: string[];
  trans: string[]; reb: string[]; early: string[]; st: string[]; wk: string[]; us: string[];
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
  { id: 'priority', q: 'Defensive priority', h: 'What you protect at all costs (identity).', opts: [
    { v: 'rim', t: 'Protect the rim', d: 'Shrink paint; contest twos.' },
    { v: 'three', t: 'Protect the 3', d: 'High contests; nail help.' },
    { v: 'disrupt', t: 'Disrupt the ball', d: 'Pressure; gaps; turnovers.' },
  ]},
  { id: 'driveDirection', q: 'Drive direction philosophy', h: 'Forcing rules (identity).', opts: [
    { v: 'noMiddle', t: 'No middle', d: 'Baseline / sideline walls.' },
    { v: 'forceMiddle', t: 'Force middle', d: 'Pack paint; tags.' },
    { v: 'funnel', t: 'Funnel', d: 'Channel to defined help pockets.' },
  ]},
  { id: 'onBall', q: 'On-ball pressure', h: 'Default ball pressure (identity).', opts: [
    { v: 'contain', t: 'Contain', d: 'Gap; feet on floor; wall drives.' },
    { v: 'pressure', t: 'Pressure', d: 'Up touch; shrink clock; more risk.' },
    { v: 'turn', t: 'Turn', d: 'Force pick-up; deny rhythm; high foul discipline.' },
  ]},
  { id: 'pnrCoverage', q: 'Pick-and-roll coverage (anchor)', h: 'Determines help, rotations, and paint answers downstream.', opts: [
    { v: 'drop', t: 'Drop', d: 'Contain two to the ball; low rotation volume.' },
    { v: 'switch', t: 'Switch', d: 'Exchange shell; stay square.' },
    { v: 'blitz', t: 'Blitz', d: 'Trap; early help; X-out chain.' },
    { v: 'hedge', t: 'Hedge / show', d: 'Touch time; tag roller; recover or rotate by load.' },
  ]},
  { id: 'sideRule', q: 'Side Pick & Roll coverage', h: 'How you defend side PnR (wing).', opts: [
    { v: 'ice', t: 'ICE (baseline)', d: 'Force baseline, deny middle.' },
    { v: 'weak', t: 'WEAK', d: 'Force weak hand.' },
    { v: 'standard', t: 'Standard', d: 'No directional force.' },
  ]},
  { id: 'middleRule', q: 'Middle Pick & Roll coverage', h: 'Top PnR rules.', opts: [
    { v: 'weak', t: 'WEAK', d: 'Force weak hand.' },
    { v: 'standard', t: 'Standard', d: 'Contain.' },
    { v: 'switch', t: 'Switch', d: 'Switch middle.' },
  ]},
  { id: 'coverageSubtype', q: 'Coverage subtype', h: 'Refines the anchor technique (staff vocabulary).', opts: [] },
  { id: 'rimProtection', q: 'Personnel — rim protection', h: 'Big / back-line rim deterrence.', opts: [
    { v: 'low', t: 'Low', d: 'Limited rim vertical or small lineups.' },
    { v: 'medium', t: 'Medium', d: 'Balanced rim presence.' },
    { v: 'high', t: 'High', d: 'Elite rim protection anchor.' },
  ]},
  { id: 'mobilityBig', q: 'Personnel — big mobility', h: 'Ability to show, recover, blitz.', opts: [
    { v: 'low', t: 'Low', d: 'Stay home / drop biased.' },
    { v: 'high', t: 'High', d: 'Comfortable showing and recovering.' },
  ]},
  { id: 'switchability', q: 'Personnel — switchability', h: 'Positional size and switch tolerance.', opts: [
    { v: 'low', t: 'Low', d: 'Traditional matchups; scram late.' },
    { v: 'medium', t: 'Medium', d: 'Selective switches.' },
    { v: 'high', t: 'High', d: 'Switch-heavy personnel.' },
  ]},
  { id: 'discipline', q: 'Personnel — discipline', h: 'Foul and scramble execution.', opts: [
    { v: 'low', t: 'Low', d: 'Youth / volatile foul environment.' },
    { v: 'high', t: 'High', d: 'Veteran execution; situational scrams.' },
  ]},
  { id: 'transitionSafety', q: 'Transition safety', h: 'Getting back (philosophy).', opts: [
    { v: 'oneBack', t: '1 back', d: 'One safety.' },
    { v: 'twoBack', t: '2 back', d: 'Double safety.' },
    { v: 'matchups', t: 'Matchups', d: 'No assigned safety.' },
    { v: 'tagUpTrans', t: 'Tag Up', d: 'Linked to Tag Up ORB.' },
  ]},
  { id: 'transitionPriority', q: 'Transition priority', h: 'Order in conversion (philosophy).', opts: [
    { v: 'stopBall', t: 'Stop ball', d: 'Pick up early.' },
    { v: 'protectRim', t: 'Protect rim', d: 'Pack first.' },
    { v: 'wall', t: 'Wall', d: 'Channel; contain.' },
  ]},
  { id: 'reboundBalance', q: 'Offensive rebounding', h: 'Glass rules (philosophy).', opts: [
    { v: 'crash', t: 'Crash', d: 'Maximum numbers.' },
    { v: 'balanced', t: 'Balanced', d: '2–3 crashers.' },
    { v: 'safetyFirst', t: 'Safety-first', d: '1–2 rarely crash.' },
    { v: 'tagUp', t: 'Tag Up', d: 'Five tag; matchup transition.' },
  ]},
];

function tagUpOrb(a: Answers): boolean { return a.reboundBalance === 'tagUp'; }
function tagTransOk(a: Answers): boolean { return a.transitionSafety === 'tagUpTrans' || a.transitionSafety === 'matchups'; }

function lbl(a: Answers, id: string): string {
  const s = STEPS.find(z => z.id === id);
  if (!s) return '';
  const opts = id === 'coverageSubtype' ? (COV_SUBTYPE_OPTS[a.pnrCoverage] ?? []) : s.opts;
  return opts.find(z => z.v === a[id])?.t ?? '';
}

const DL: Record<string, Record<string, string>> = {
  rimProtection: { low: 'Rim protection: low', medium: 'Rim protection: medium', high: 'Rim protection: high' },
  mobilityBig: { low: 'Big mobility: low', high: 'Big mobility: high' },
  switchability: { low: 'Switchability: low', medium: 'Switchability: medium', high: 'Switchability: high' },
  discipline: { low: 'Discipline: low', high: 'Discipline: high' },
  helpStructure: { weak: 'Weak-side', strong: 'Strong-side', mixed: 'Mixed', none: 'Minimal (switch skeleton)' },
  sidePnRRule: { standard: 'Standard', switch: 'Switch', ice: 'ICE', weak: 'WEAK' },
  middlePnRRule: { weak: 'WEAK', standard: 'Standard', switch: 'Switch' },
  closeouts: { aggressive: 'Aggressive', controlled: 'Controlled' },
  earlyScreen: { switch: 'Switch', contain: 'Contain' },
};
function tlabel(t: Partial<Tactics>, id: string): string {
  return DL[id]?.[t[id] as string] ?? '';
}

function buildTradeOffs(t: Partial<Tactics>): string[] {
  const o: string[] = [];
  if (t.pnrCoverage === 'blitz') o.push('Blitz creates 4-on-3 behind the trap: skip passes, quick reversals, and long closeouts are the structural tax you accept for ball pressure.');
  if (t.pnrCoverage === 'switch') o.push('Switch trades matchup integrity for containment — small-on-big post-ups, isolations, and offensive rebounding on mismatches are the structural tax.');
  if (t.pnrCoverage === 'drop') o.push('Drop concedes clean rhythm midrange while the big contains two-on-two — that jumper pocket is the structural tax for rim protection.');
  if (t.pnrCoverage === 'hedge') o.push('Hedge lives on recovery: if the big cannot flatten out in time, pocket drives, throw-backs, and late-tag rollers are the structural tax.');
  return o;
}

export function derive(inp: Answers): DerivationResult {
  const t: Partial<Tactics> = {};
  const cov = inp.pnrCoverage, side = inp.sideRule, mid = inp.middleRule, pr = inp.priority, dd = inp.driveDirection, ob = inp.onBall;

  if (cov === 'switch') t.helpStructure = 'none';
  else if (cov === 'drop') t.helpStructure = dd === 'noMiddle' ? 'weak' : dd === 'forceMiddle' ? 'strong' : 'mixed';
  else if (cov === 'blitz') t.helpStructure = pr === 'rim' ? 'weak' : pr === 'three' ? 'strong' : 'mixed';
  else t.helpStructure = 'mixed';

  if (side === 'ice') { t.sidePnR = 'ICE'; t.forceDirection = 'baseline'; t.bigRole = 'drop lane line'; t.lowMan = 'weak side'; }
  else if (side === 'weak') { t.sidePnR = 'WEAK'; t.forceDirection = 'weak hand'; t.lowMan = 'weak side'; }
  else { t.sidePnR = 'standard'; t.forceDirection = 'neutral'; t.bigRole = 'shell'; }

  t.middlePnR = mid === 'weak' ? 'WEAK' : mid === 'switch' ? 'SWITCH' : 'standard';
  t.helpTiming = (cov === 'drop' || cov === 'switch') ? 'late' : 'early';
  t.helpIntensity = cov === 'switch' ? 'none' : cov === 'blitz' ? 'full' : cov === 'drop' ? (pr === 'three' ? 'dig' : 'stunt') : 'dig';
  t.tag = cov === 'switch' ? 'none' : cov === 'blitz' ? 'always early' : cov === 'hedge' ? 'always' : 'low man conditional';
  t.rotation = cov === 'switch' ? 'switch' : cov === 'blitz' ? 'x-out' : cov === 'drop' ? (pr === 'three' ? 'x-out' : 'recover') : 'recover';
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
  t.offBallPosition = 'gap'; t.kypDenyMode = 'shooters'; t.kypHelpOff = 'yes';
  t.kypStuntUsage = cov === 'hedge' ? 'always' : 'situational';
  t.postDefense = 'onev1'; t.earlyScreen = (ob === 'pressure' || ob === 'turn') ? 'switch' : 'contain';

  return { tactics: t as Tactics, explanations: [], warnings: [], tradeOffs: buildTradeOffs(t) };
}

export function assertInvariants(t: Tactics): boolean {
  if (t.pnrCoverage === 'switch' && (t.helpStructure !== 'none' || t.helpTiming !== 'late')) return false;
  if (t.pnrCoverage === 'blitz' && (t.rotation !== 'x-out' || t.penetration !== 'help chain' || t.helpIntensity !== 'full' || t.helpTiming !== 'early')) return false;
  if (t.pnrCoverage === 'hedge' && (t.helpTiming !== 'early' || t.tag === 'none')) return false;
  return true;
}

export function coverageViabilityError(stepId: string, value: string, a: Answers): string | null {
  const m = { ...a, [stepId]: value };
  if (stepId === 'pnrCoverage' && value === 'switch' && m.switchability === 'low') return 'Switch shell is not viable with low switchability — change shell or personnel.';
  if (stepId === 'coverageSubtype' && m.pnrCoverage === 'hedge' && value === 'hard' && m.mobilityBig === 'low') return 'Hard hedge is not viable with a low-mobility big.';
  if (stepId === 'switchability' && value === 'low' && m.pnrCoverage === 'switch') return 'Low switchability cannot support a switch shell — change shell or switchability.';
  if (stepId === 'discipline' && value === 'low' && m.pnrCoverage === 'blitz') return 'Low discipline cannot support blitz volume — change shell or discipline.';
  if (stepId === 'mobilityBig' && value === 'low' && m.pnrCoverage === 'hedge' && m.coverageSubtype === 'hard') return 'Hard hedge requires big mobility — soften subtype or change shell.';
  return null;
}

export function validateAll(a: Answers): string[] {
  const errors: string[] = [];
  if (STEPS.some(s => !a[s.id])) return ['Incomplete answers.'];
  if (a.pnrCoverage === 'switch' && a.switchability === 'low') errors.push('Switch shell with low switchability is not viable.');
  if (a.pnrCoverage === 'blitz' && a.discipline === 'low') errors.push('Blitz with low discipline is not viable.');
  if (a.pnrCoverage === 'hedge' && a.coverageSubtype === 'hard' && a.mobilityBig === 'low') errors.push('Hard hedge with low big mobility is not viable.');
  if (tagUpOrb(a) && !tagTransOk(a)) errors.push('Tag Up ORB requires Tag Up transition or matchup conversion.');
  if (a.transitionSafety === 'tagUpTrans' && a.reboundBalance !== 'tagUp') errors.push('Tag Up transition requires Tag Up rebounding.');
  if (a.reboundBalance === 'safetyFirst' && (tagUpOrb(a) || a.transitionSafety === 'tagUpTrans')) errors.push('Tag Up rules conflict with safety-first crashing.');
  return errors;
}

export function buildReport(a: Answers): Report {
  const pack = derive(a);
  const t = pack.tactics;
  const np: string[] = [];
  if (tagUpOrb(a)) np.push('Tag Up');
  if (t.middlePnRRule === 'weak') np.push('WEAK');
  np.push(t.pnrCoverage === 'drop' ? 'Drop' : t.pnrCoverage === 'switch' ? 'Switch' : t.pnrCoverage === 'blitz' ? 'Blitz' : 'Hedge');
  const name = (np.length ? np.join(' · ') : 'Elite') + ' System';
  let id = (t.priority === 'rim' ? 'Rim-first identity. ' : t.priority === 'three' ? 'Three-point protection identity. ' : 'Disruptive ball-pressure identity. ');
  id += (t.driveDirection === 'noMiddle' ? 'No-middle drive rules. ' : t.driveDirection === 'forceMiddle' ? 'Force-middle pack rules. ' : 'Funnel channel rules. ');
  id += 'On-ball: ' + lbl(a, 'onBall') + '. ';
  id += 'Personnel: ' + tlabel(t, 'rimProtection') + ' · ' + tlabel(t, 'mobilityBig') + ' · ' + tlabel(t, 'switchability') + ' · ' + tlabel(t, 'discipline') + '.';
  const anchor = ['Shell: ' + lbl(a, 'pnrCoverage') + ' · subtype ' + lbl(a, 'coverageSubtype') + '.', 'Side / middle (derived): ' + tlabel(t, 'sidePnRRule') + ' · ' + tlabel(t, 'middlePnRRule') + '.'];
  const derivedSystem = ['Side PnR: ' + t.sidePnR + ' (force ' + t.forceDirection + ')', 'Middle PnR: ' + t.middlePnR, 'Help: ' + t.helpStructure + ' | timing ' + t.helpTiming + ' | intensity ' + t.helpIntensity, 'Tag: ' + t.tag, 'Rotation: ' + t.rotation, 'Pop: ' + t.pop, 'Skip: ' + t.skip, 'Penetration: ' + t.penetration, 'Peel: ' + t.peel, 'Short roll: ' + t.shortRoll, 'Mismatch: ' + t.mismatch, 'Closeouts: ' + t.closeouts];
  const trans: string[] = [lbl(a, 'transitionSafety') + ' · ' + lbl(a, 'transitionPriority') + '.'];
  if (tagUpOrb(a)) trans.push('Tag Up ORB: five contact tags, matchup transition — overrides fixed safety roles.');
  else if (t.transitionSafety === 'oneBack') trans.push('One safety to rim; release vs crash scripted.');
  else if (t.transitionSafety === 'twoBack') trans.push('Two safeties: ball then rim.');
  else trans.push('Matchup conversion; no assigned safety.');
  const reb: string[] = [tagUpOrb(a) ? 'Maximum ORB with Tag Up rules; long-miss mismatch risk.' : t.reboundBalance === 'crash' ? 'Crash when transition allows numbers.' : t.reboundBalance === 'balanced' ? 'Balanced 2–3 crashers.' : 'Safety-first release.'];
  const early = [t.earlyScreen === 'switch' ? 'Early drags: switch exchanges before the shell is fully loaded.' : 'Early drags: contain flat until the shell is set.'];
  const st: string[] = [];
  const wk: string[] = [];
  const us: string[] = [];
  if (tagUpOrb(a)) { st.push('ORB volume without classic safety.'); wk.push('Tag fouls and transition mismatches.'); }
  if (t.pnrCoverage === 'blitz') st.push('Primary pressure: two to the ball forces predictable catches.');
  if (t.pnrCoverage === 'drop') st.push('Rim-first containment: two-on-two integrity vs common PnR looks.');
  if (!st.length) st.push('Teachable layers for staff and players.');
  if (t.helpStructure === 'none') wk.push('Switch skeleton: elite isolation vs set matchups.');
  if (t.rotationModel === 'rotate') wk.push('Execution load: reversal speed and tag-up discipline on long rotations.');
  if (wk.length < 2) wk.push('Scouting still tests timing vs elite pull-up and transition.');
  if (t.priority === 'three') us.push('vs shooting.');
  if (t.transitionPriority === 'stopBall') us.push('vs transition.');
  if (t.pnrCoverage === 'switch') us.push('vs spread PnR.');
  if (us.length < 3) us.push('vs balanced: clarity wins.');
  return { name, identity: id, anchor, derivedSystem, causal: [], tradeOffs: pack.tradeOffs, warnings: pack.warnings, trans, reb, early, st, wk, us };
}
