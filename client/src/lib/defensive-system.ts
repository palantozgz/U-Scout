// @ts-nocheck — ported from defensive-system-builder-v6.html (pure logic, no DOM/React).

export interface StepOption { v: string; t: string; d?: string; }

export interface KypRule { role: string; action: string; }

export interface Answers {
  [key: string]: string | KypRule[] | undefined;
}

export interface SectionDef {
  id: string;
  label: string;
  color: string;
  steps: string[];
}

export interface StepDef {
  id: string;
  section: string;
  q: string;
  h: string;
  type?: 'text' | 'subtype' | 'kyp' | 'options';
  placeholder?: string;
  skippable?: boolean;
  opts?: StepOption[];
  showIf?: (a: Answers) => boolean;
}

export interface PersonnelIssue {
  field: string;
  detail: string;
}

export interface TacDerived {
  helpStructure: string;
  helpTiming: string;
  helpIntensity: string;
  lowManTag: string;
  rotationModel: string;
  pop: string;
  skip: string;
  penetration: string;
  mismatchSummary: string;
  rescramSummary: string;
  closeoutStyle: string;
  earlyPnrSummary: string;
  earlyBigRole: string;
  earlyRescreenRule: string;
  nextCoverageSummary: string;
  popAnswerSummary: string;
  iceCornerX3Summary: string;
  iceSnakeSummary: string;
  spainSummary: string;
  offBallStance: string;
  helpSideAnchor: string;
  postAnswer: string;
  transitionDesc: string;
  cognitiveLoad: number;
  cognitiveRating: string;
  tradeoffs: string[];
  personnelIssues: PersonnelIssue[];
  personnelWarnings: PersonnelIssue[];
  [key: string]: string | number | string[] | PersonnelIssue[] | undefined;
}

export interface CheckResult {
  errors: string[];
  warnings: string[];
}

export interface Report {
  name: string;
  tac: TacDerived;
  checks: CheckResult;
  answers: Answers;
}

export const SECTIONS = [
  { id:'identity',     label:'Identity',          color:'#3d7fff', steps:['systemName','priority','driveDirection','onBall','pickupPoint'] },
  { id:'offball',      label:'Off-Ball',           color:'#00e5a0', steps:['offBallPosition','onePassDeny','helpSideDepth'] },
  { id:'ballscreen',   label:'Ball Screens',       color:'#ff8c3d', steps:['pnrCoverage','coverageSubtype','sideRule','middleRule','dhoRule','nextCoverage','popAnswer'] },
  { id:'icevariant',   label:'ICE Details',        color:'#38bdf8', steps:['iceCornerX3','iceSnake'] },
  { id:'earlyoffense', label:'Early Offense',      color:'#ff6b6b', steps:['earlyPnrCoverage','earlyPnrBig','earlyRescreenRule','earlyPostRule'] },
  { id:'offscreen',    label:'Off-Ball Screens',   color:'#f5c542', steps:['pinDownRule','backScreenRule','flareRule','stagRule','dhoOffBall'] },
  { id:'spainpnr',     label:'Spain PnR',          color:'#c084fc', steps:['spainCoverage'] },
  { id:'switchmgmt',   label:'Switch Management',  color:'#fb923c', steps:['rescramRule','xoutModel','mismatchResponse'] },
  { id:'post',         label:'Post Defense',       color:'#b47aff', steps:['postDefense','postDigger','postFront'] },
  { id:'personnel',    label:'Personnel',          color:'#ff4f6a', steps:['rimProtection','mobilityBig','switchability','discipline'] },
  { id:'transition',   label:'Transition',         color:'#3d7fff', steps:['transitionSafety','transitionPriority','reboundBalance'] },
  { id:'kyp',          label:'KYP Rules',          color:'#00e5a0', steps:['kypRules'] },
];

export const COV_SUBTYPE_OPTS = {
  drop:[
    {v:'deep', t:'Deep drop',      d:'Big stays low, attached to roller. Rim first — contests all drives before the pull-up.'},
    {v:'high', t:'High drop',      d:'Big at level of screen. Earlier touch on ball-handler; concedes roller more.'}
  ],
  hedge:[
    {v:'soft', t:'Soft hedge / show', d:'Brief touch, instant recover. On-ball defender must get back fast.'},
    {v:'hard', t:'Hard hedge',     d:'Aggressive show — 1+ full step. High mobility big required. Requires long recovery.'}
  ],
  switch:[
    {v:'flat', t:'Flat switch',    d:'Exchange at screen level. Limits immediate back-cut exposure. Most common.'},
    {v:'early',t:'Early switch',   d:'Call switch before the screen is fully set. More aggressive; less recovery risk.'}
  ],
  blitz:[
    {v:'standard',    t:'Standard blitz',   d:'Classic two-to-the-ball trap. 3 defenders must X-out immediately.'},
    {v:'containTrap', t:'Contain trap',     d:'Short-corner containment first, spring on the pick-up. Limits split drives.'}
  ]
};

export const STEPS_DEF = [
  /* IDENTITY */
  { id:'systemName', section:'identity', type:'text',
    q:'Name this defensive system', h:'Give it a name your staff will use: "ROCA", "Plan A", "Wall", "Blue"…',
    placeholder:'e.g. "Plan A", "ROCA", "Wall"' },
  { id:'priority', section:'identity',
    q:'Defensive priority', h:'The non-negotiable — what you protect at all costs. Everything else is derived from this.',
    opts:[
      {v:'rim',     t:'Protect the rim',  d:'Shrink paint; force misses. Concede the pull-up midrange as structural tax.'},
      {v:'three',   t:'Protect the 3',    d:'High contests; nail help; shell closures. Concede clean midrange pull-ups.'},
      {v:'disrupt', t:'Disrupt the ball', d:'Pressure; force picks; turnovers first. High athleticism requirement.'}
    ]},
  { id:'driveDirection', section:'identity',
    q:'Drive direction philosophy', h:'Forcing rules for the entire defense. Determines where helpside lives.',
    opts:[
      {v:'noMiddle',    t:'No middle',     d:'Force baseline / sideline. Helpside loads weak side. Classic and teachable.'},
      {v:'forceMiddle', t:'Force middle',  d:'Pack paint; all help loads strong side. Effective but requires disciplined back-line.'},
      {v:'funnel',      t:'Funnel',        d:'Channel to defined paint pockets regardless of side. Requires high IQ.'}
    ]},
  { id:'onBall', section:'identity',
    q:'On-ball pressure', h:'Default pressure posture. This determines how many fouls your system generates.',
    opts:[
      {v:'contain',  t:'Contain',  d:'Gap stance; feet on floor; wall drives. Low foul risk. High execution floor.'},
      {v:'pressure', t:'Pressure', d:'Up-touch; early ball denial. More turnovers, more fouls. Medium risk.'},
      {v:'turn',     t:'Turn',     d:'Force ball-handler to pick it up; deny rhythm dribble. High foul discipline needed.'}
    ]},
  { id:'pickupPoint', section:'identity',
    q:'Pickup point', h:'When does your defense start? Determines pressure exposure and early offense options.',
    opts:[
      {v:'half',    t:'Half court',       d:'Standard pickup. Defense sets in half court before engagement.'},
      {v:'threeq',  t:'Three-quarter',    d:'Pick up at 3/4 court. Moderate pressure; disrupts early offense.'},
      {v:'full',    t:'Full court press', d:'Pickup from inbound. High pressure; requires deep rotation depth.'},
      {v:'forty',   t:'Forty-foot rule',  d:'Pick up at 40ft (between 3/4 and full). Common in Euroleague.'}
    ]},

  /* OFF-BALL */
  { id:'offBallPosition', section:'offball',
    q:'Off-ball positioning (one pass away)', h:'How do you guard players who are one pass from the ball? This determines your rotation baseline.',
    opts:[
      {v:'gap',      t:'Gap stance',      d:'Step off the line, two steps from check. Help available. Cannot deny wing entry. Fewest turnovers forced.'},
      {v:'semiDeny', t:'Semi-deny',       d:'On the line, one step toward ball. Can help AND contest the entry pass. Balanced approach. Most common at pro level.'},
      {v:'fullDeny', t:'Full deny',       d:'On the line, body toward check. Maximum pressure on catch. Vulnerable to back-cuts. Generates turnovers.'}
    ]},
  { id:'onePassDeny', section:'offball',
    q:'Denial exceptions', h:'Most systems full-deny certain threats regardless of base positioning.',
    opts:[
      {v:'shooters',  t:'Deny elite shooters only',  d:'Tag the top 1–2 shooters on their roster regardless of position.'},
      {v:'allWings',  t:'Deny all wing catches',      d:'Deny every one-pass-away catch on wings. Classic pressure defense.'},
      {v:'noDeny',    t:'No denial — contest catches', d:'Contest everything at catch, deny nothing pre-catch. Gap-based system.'}
    ]},
  { id:'helpSideDepth', section:'offball',
    q:'Help-side depth (two passes away)', h:'How far do defenders drop off on the weak side? The "pistol position" determines your rotation chain.',
    opts:[
      {v:'nail',    t:'Nail (high post)',  d:'Weak-side defender at nail. Cuts off middle drives and basket cuts. Classic.'},
      {v:'paint',   t:'Deep paint',        d:'Defender drops into paint. Maximum rim protection. Concedes weak-side catch.'},
      {v:'shallow', t:'Shallow / I-line',  d:'Defenders stay I-line with ball side. Less rim protection, faster recovery.'}
    ]},

  /* BALL SCREENS */
  { id:'pnrCoverage', section:'ballscreen',
    q:'Pick-and-roll coverage (anchor)', h:'Your primary PnR answer. This is the most consequential decision — it defines your help structure, rotation model, and paint rules.',
    opts:[
      {v:'drop',   t:'Drop',        d:'Big drops to protect roller and rim. Guard fights over or under. Concedes midrange pull-up.'},
      {v:'switch', t:'Switch',      d:'Instant exchange. No help structure needed. Requires switchable personnel.'},
      {v:'hedge',  t:'Hedge / show',d:'Big shows hard; guard recovers. Tag roller immediately. Recovery load is high.'},
      {v:'blitz',  t:'Blitz / trap',d:'Two defenders trap ball-handler. X-out chain activates. Requires discipline and depth.'}
    ]},
  { id:'coverageSubtype', section:'ballscreen', type:'subtype',
    q:'Coverage subtype', h:'Refines the anchor. Clarifies staff vocabulary and drills.' },
  { id:'sideRule', section:'ballscreen',
    q:'Side PnR rule', h:'How you defend wing pick-and-roll (most common location). ICE is the Euroleague/WCBA standard.',
    opts:[
      {v:'ice',      t:'ICE',       d:'Force baseline, deny middle. Big drops lane line. Most common at pro level.'},
      {v:'weak',     t:'WEAK',      d:'Force to weaker hand of ball-handler. Requires scouting-based execution.'},
      {v:'standard', t:'Standard',  d:'No directional force — contain neutrally.'}
    ]},
  { id:'middleRule', section:'ballscreen',
    q:'Middle / top PnR rule', h:'Top-of-key and middle ball screens.',
    opts:[
      {v:'weak',     t:'WEAK',     d:'Force to weak hand — harder to execute, disruptive if done correctly.'},
      {v:'standard', t:'Standard', d:'Contain — no directional force.'},
      {v:'switch',   t:'Switch',   d:'Switch middle automatically. Cleaner but exposes post mismatches.'}
    ]},
  { id:'dhoRule', section:'ballscreen',
    q:'DHO (dribble hand-off) coverage', h:'DHOs are increasingly common in Euroleague / WCBA motion systems. Treat separately from PnR.',
    opts:[
      {v:'switch',  t:'Switch',      d:'Auto-switch all DHOs. Clean, no recovery needed. Standard in Spain.'},
      {v:'contain', t:'Contain',     d:'On-ball defender fights through. Receiver defender steps to ball level.'},
      {v:'hedge',   t:'Hedge / show',d:'Same rules as PnR hedge. Big shows, guard recovers around.'}
    ]},

  { id:'nextCoverage', section:'ballscreen',
    showIf: function(a){ return a.pnrCoverage && a.pnrCoverage !== 'switch'; },
    q:'Next coverage (PnR toward full side)', h:'When the PnR attacks toward the side with 2 off-ball defenders (the "full side") — do you use Next? Mechanic: X5 stays ATTACHED to the roller at all times (his only job). The nearest perimeter defender (the "next") jump-switches to the ball-handler when he breaks the 3pt line with X1 trailing. X1 peels off and takes the next\'s original man. Guards rotate among themselves. Big never leaves the roller. (Gonzalo Rodríguez / Monbus Obradoiro system).',
    opts:[
      {v:'no',          t:'No — standard coverage',   d:'No Next. X5 reads the PnR as normal (drop/hedge/blitz based on anchor). Full-side rotations via standard tag and nail help.'},
      {v:'next',        t:'Next',                      d:'X5 attached to roller always. Nearest perimeter guard jumps to ball when X1 trails 3pt line. X1 peels to next\'s man. Guards rotate. Big never touches ball.'},
      {v:'hot',         t:'Hot (aggressive Next)',      d:'Same as Next but the rotating defender approaches the ball-handler at high speed as a surprise — not a clean switch, a trap appearance. Harder to pass out of. More rotation chain required.'},
      {v:'conditional', t:'Next or Hot — player reads', d:'The decision is made by the players based on the ball-handler\'s position and trailing distance. Obradoiro full system: players decide Next vs Hot in real time.'}
    ]},

  { id:'popAnswer', section:'ballscreen',
    showIf: function(a){ return !!a.pnrCoverage; },
    q:'Pop answer — when the screener pops instead of rolls', h:'Every anchor has a structural vulnerability to the pop. The right answer depends on your anchor: in HEDGE/SHOW, X5 is already close to the pop (short recovery). In DROP, X5 is far (long closeout). In BLITZ, X5 is trapping and cannot close. Note: ICE-specific X3 pop options appear in the ICE Details section.',
    opts:[
      {v:'x5ImmediateRecover', t:'X5 recovers immediately to pop',         d:'Best for HEDGE/SHOW: X5 is already at screen level — short recovery to the pop. Nearest off-ball defender stunts briefly at the drive to cover X5\'s rotation. X5 contests before the shot is set. This is your described approach for show systems.'},
      {v:'x5Closeout',         t:'X5 long closeout to pop',                d:'Standard for DROP: X5 sprints from paint level to the pop. Long path — gives shooter time to set feet. Accepted structural tax of the drop. Most common drop answer.'},
      {v:'stuntNextClose',     t:'X5 stunts at drive + next player closes pop', d:'X5 makes a 0.5s stunt toward the drive to disrupt the pocket pass, then the nearest shell player closes to the pop. X5 stays anchored. Shorter closeout for the closer player. Works with both drop and hedge when shell is loaded.'},
      {v:'nailCloses',         t:'Nail defender closes to pop',             d:'Nail help defender reads the pop and closes out. X5 stays attached to the short-roll or paint area. Requires early read from nail. Concedes the nail spot temporarily — ball movement can attack.'},
      {v:'switchToX1',         t:'X1 takes pop, X5 stays on ball-handler', d:'X1 (on-ball defender) peels off the ball-handler on the pop and closes to the popper. X5 stays with the ball-handler. Guard-on-big at pop location — limited post threat from that distance. Used in some switch systems.'}
    ]},

  /* ICE VARIANTS — only shown when sideRule = ICE */
  { id:'iceCornerX3', section:'icevariant',
    showIf: function(a){ return a.sideRule === 'ice'; },
    q:'ICE + strong-side corner occupied — X3 role', h:'When the ball-side corner has an offensive player (the "Shake" or "Corner Fill" PnR), X3 cannot help freely. This is a separate situation from empty-corner ICE. What does X3 do?',
    opts:[
      {v:'stayHome',    t:'Stay home on corner shooter',    d:'X3 stays glued to the corner player. If the screener pops to X3\'s area, X5 closes out alone — longer path. Correct when corner player is an elite shooter. Zero help from X3.'},
      {v:'stuntRecover',t:'Stunt + recover',                d:'X3 does a 0.5s stunt toward the drive or the pop to break rhythm, then snaps back to the corner player. Concedes nothing but disrupts timing. Most common pro answer.'},
      {v:'closeoutPop', t:'X3 closes out if screener pops', d:'If the screener pops toward X3\'s area, X3 closes to the popper while X5 covers the vacated corner player. Creates guard (X3) on big (popper) mismatch — popper has limited drive; if cut, X5 can scram. Your described approach.'},
      {v:'switchX3X5',  t:'Switch X3 ↔ X5 on pop',         d:'X5 takes the corner player (big on guard — easy scram if cuts). X3 goes to the popper (guard on big at pop spot — limited post threat). Cleaner rotation. Scrammable if corner cuts.'}
    ]},

  { id:'iceSnake', section:'icevariant',
    showIf: function(a){ return a.sideRule === 'ice'; },
    q:'ICE — snake dribble counter', h:'The ball-handler rejects the ICE and attacks middle (snake dribble) instead of going baseline. How does the defense respond?',
    opts:[
      {v:'x1Anticipate', t:'X1 anticipates and cuts snake',  d:'On-ball defender reads the snake pre-rejection and shades body position to block the middle cut before it happens. Requires recognition and early positioning. Best answer but hardest to execute.'},
      {v:'x5Jumps',      t:'X5 jumps to snake — shuts middle',d:'X5 (screener\'s defender in ICE drop) reads the rejection and pivots to block the middle drive lane. Effectively turns into a soft hedge or show. X5 must be mobile. Leaves roller open briefly.'},
      {v:'nailHelp',     t:'Nail defender shuts middle drive', d:'Nail defender reads the snake and collapses to the driving lane. X5 tags roller. X1 continues to contain. Three defenders involved — manageable if nail reads early, risky if ball moves fast.'},
      {v:'accept',       t:'Accept + contain',                d:'Accept the snake happened. X1 contains as best possible; X5 stays in ICE position; nail stunts. This is the structural concession of ICE — snake is the tax. Well-taught teams live with it.'}
    ]},

  /* EARLY OFFENSE DEFENSE */
  { id:'earlyPnrCoverage', section:'earlyoffense',
    q:'Early offense PnR — base coverage', h:'Drag screen / secondary break PnR. Your big is trailing — hedge is almost always wrong here. NBA teams default to drop or switch on transition PnR for this reason.',
    opts:[
      {v:'dropUnder',   t:'Drop + under',        d:'Big drops immediately; guard passes under. No hedge risk. Accept pull-up. Best when big is trailing. Your "stop ball high, pass under, recover" plan.'},
      {v:'switch',      t:'Auto-switch',          d:'Switch the drag automatically. Most common NBA solution. Requires switchable G-F. Eliminates big recovery problem entirely.'},
      {v:'containLoad', t:'Contain + load weak',  d:'Guard contains flat; big loads paint. No show, no hedge. Strong-side tags only. Shell builds as players arrive.'},
      {v:'stopBallTag', t:'Stop ball + tag',      d:'Guard stops ball high; low man immediately tags the roller. Shell loads from weak side as defense organizes. Your described approach: stop high, pass under, tag roller.'}
    ]},
  { id:'earlyPnrBig', section:'earlyoffense',
    q:'Big role in early PnR', h:'The big is trailing — what is their priority before they arrive in position?',
    opts:[
      {v:'sprintRim',   t:'Sprint to rim first',  d:'Big ignores ball, gets to paint. On-ball guard must stop ball alone. Prevents lob and layup chain.'},
      {v:'sprintTouch', t:'Sprint to touch level', d:'Big sprints to reach screen level if possible — brief contain, recover. High risk if late.'},
      {v:'callSwitch',  t:'Call switch early',     d:'Big calls the switch before the screen — guard accepts the big, big takes the handler. Cleanest solution if personnel allows.'},
      {v:'tagAndLoad',  t:'Tag roller + load',     d:'Big sprints to tag the roll man first, then releases to recover when shell is set. Your described plan.'}
    ]},
  { id:'earlyRescreenRule', section:'earlyoffense',
    q:'Rescreen / secondary screen in early offense', h:'If the offense rescreens after the initial drag (double drag, Ram Spain into drag, Spain action off drag) — when do you switch to base half-court coverage?',
    opts:[
      {v:'immediate',   t:'Immediately — base rules apply', d:'Any rescreen triggers your half-court PnR rules. Cleanest. No second exception layer.'},
      {v:'onceOrg',     t:'Once shell is organized',        d:'Base rules apply only once weak side is set. Until then, continue early-offense rules. Your described approach.'},
      {v:'alwaysSwitch',t:'Always switch rescreens',        d:'Auto-switch all rescreens in early offense regardless of personnel. Prevents compounding coverage breakdown.'}
    ]},
  { id:'earlyPostRule', section:'earlyoffense',
    q:'Early post-up defense (transition post)', h:'Big posts up in transition before defense is set — distinct from half-court post.',
    opts:[
      {v:'loadHelp',    t:'Load immediate help',    d:'On-ball defender fights; two nearest defenders load weak-side help immediately. Accept 1v1 with help.'},
      {v:'frontImmed',  t:'Front immediately',      d:'Front the post even in transition. Requires help recognition before shell sets.'},
      {v:'accept1v1',   t:'Accept 1v1 + stunt',     d:'Pure 1v1 — on-ball defender holds, others stunt. No rotation until shell is set.'},
      {v:'doubleOnCatch',t:'Double on catch',        d:'Two defenders trap on catch. X-out chain activates. High risk in transition.'}
    ]},

  /* OFF-BALL SCREENS */
  { id:'pinDownRule', section:'offscreen',
    q:'Pin-down (down screen) rule', h:'Most common in WCBA. Big sets screen for shooter coming to three-point line.',
    opts:[
      {v:'over',     t:'Chase / fight over', d:'Trail the receiver over the screen. Hard on shooters; allows curl drive.'},
      {v:'under',    t:'Under',              d:'Slide under the screen. Gives up catch-and-shoot catch. Limits curl.'},
      {v:'topLock',  t:'Top-lock',           d:'Lock at the top of the screen — deny catch entirely. Aggressive.'},
      {v:'switch',   t:'Switch',             d:'Auto-switch. Clean. Possible mismatch on big-small.'}
    ]},
  { id:'backScreenRule', section:'offscreen',
    q:'Back screen rule', h:'Off-ball player sets screen behind a defender — creates backdoor cuts and lobs.',
    opts:[
      {v:'switch',   t:'Switch',       d:'Call and switch on contact. Safest. Auto-removes backdoor.'},
      {v:'chase',    t:'Chase',        d:'Screened defender goes around behind. Screener defender shows briefly.'},
      {v:'show',     t:'Show & recover',d:'Screener defender shows hard, screened defender slips around.'}
    ]},
  { id:'flareRule', section:'offscreen',
    q:'Flare screen rule', h:'Screen set away from ball toward corner/wing — creates corner three.',
    opts:[
      {v:'over',    t:'Chase over',    d:'Defender goes over the flare. Contests catch. Standard.'},
      {v:'switch',  t:'Switch',        d:'Auto-switch on the flare. Clean — no chase.'},
      {v:'under',   t:'Under',         d:'Give up the three — guard drops under. Used vs non-shooters.'}
    ]},
  { id:'stagRule', section:'offscreen',
    q:'Stagger (double screen) rule', h:'Two-player double screen for a shooter — extremely common in WCBA.',
    opts:[
      {v:'through', t:'Through / fight through', d:'Defender chases through both screens. Hardest but keeps matchup.'},
      {v:'switch',  t:'Switch',                  d:'Switch at first contact. Forces communication under fatigue.'},
      {v:'topLock', t:'Top-lock',                d:'Deny above the stagger entirely. Most aggressive.'}
    ]},
  { id:'dhoOffBall', section:'offscreen',
    q:'DHO as off-ball screen rule', h:'When a DHO action is used to free a shooter away from the ball.',
    opts:[
      {v:'switch',  t:'Switch',    d:'Auto-switch all DHO off-ball actions. Consistent with DHO on-ball rule.'},
      {v:'contain', t:'Contain',   d:'Receiver defender fights through. Gives up a step.'},
      {v:'deny',    t:'Deny',      d:'Deny the receiver pre-catch. Aggressive; vulnerable to backdoor.'}
    ]},

  /* SPAIN PnR */
  { id:'spainCoverage', section:'spainpnr',
    q:'Spain PnR — coverage', h:'Spain / Stack PnR = ball screen + simultaneous back screen on the rolling big\'s defender. Creates 3 threats: ball-handler drive, roller lob, back-screener pop. Each option below defines all 3 defender roles. Resulting mismatches are handled by your general mismatch protocol (Switch Management section).',
    opts:[
      {v:'switch13',    t:'1-3 switch (back-screener\'s def ↔ ball-handler)',  d:'X-backscreener switches to take the ball-handler. X1 peels to take the back-screener. X5 stays on roller. Prevents the lob. Most common NBA/Euroleague answer. Note: if X5 also switches (switchAll), X5 would take ball-handler.'},
      {v:'bump',        t:'Bump + recover',                                    d:'X5 bumps the back-screener\'s path before recovering to the roller. X-backscreener stays home on the pop. X1 fights over/around the ball screen. Disrupts timing without full switch; requires athletic X5.'},
      {v:'blitzSpain',  t:'Blitz PnR + deny back screen',                     d:'X1 and X5 blitz the ball-handler. X-backscreener denies the back-screen catch/cut. X-out chain activates on the 4v3. Highest disruption, highest load.'},
      {v:'switchAll',   t:'Switch all 3 defenders',                            d:'Full 3-man rotation: X5 takes ball-handler, X1 takes roller, X-backscreener takes back-screener position. Eliminates lob and back-cut entirely. Creates triple cross-mismatch — use your general mismatch protocol.'},
      {v:'iceSpain',    t:'ICE PnR + tag back-screen',                         d:'ICE the ball screen (force baseline). X5 drops to tag the roller. X-backscreener stays attached to the back-screener\'s pop. Avoids the lob lane; concedes the pop catch — accept or close from X-backscreener\'s position.'}
    ]},

  /* SWITCH MANAGEMENT */
  { id:'rescramRule', section:'switchmgmt',
    q:'Reswitch / scram switch protocol', h:'After an unwanted switch — do you try to restore original matchups? Define the rule.',
    opts:[
      {v:'always',      t:'Always rescram',         d:'Default rule: restore original matchup at first pass or dead ball. Keeps personnel matchup integrity. High communication requirement.'},
      {v:'mismatchOnly',t:'Rescram on dangerous mismatches only', d:'Only rescram when the mismatch is actionable (big on guard in space, guard on big in post). Accept safe switches.'},
      {v:'never',       t:'Never rescram — live with it', d:'No rescram. New matchup holds until next possession. Lower communication load. Accepted by switch-heavy teams.'},
      {v:'peel',        t:'Peel switch (Beat → Peel → Switch)', d:'When beaten, defender peels off; nearest teammate switches to ball; chain zippers. Modern NBA approach. Auto-solves mismatches on penetration.'}
    ]},
  { id:'xoutModel', section:'switchmgmt',
    q:'X-out — penetration rotation model', h:'When a defender helps to stop penetration — how do the remaining defenders rotate to cover the open players?',
    opts:[
      {v:'lastNextBeaten',  t:'Last helps · Next reads first pass · Beaten recovers second', d:'The lowest (last) weak-side defender stops penetration. The next defender covers a 2v1 alone and goes WHERE THE FIRST PASS ARRIVES — wing or corner, reads the pass, not scripted. The beaten ball-handler recovers to the second pass, completing the chain. High IQ required; minimal scripting.'},
      {v:'rotate',          t:'Scripted rotate (1→2→3 toward ball)',                         d:'Defenders rotate in a fixed chain toward the ball: strong-side wing closes to corner, weak-side wing closes to strong corner, nail closes to weak wing. Scripted and teachable but predictable and slow vs fast ball movement.'},
      {v:'peel',            t:'Peel / recover first (help and recover)',                      d:'Each defender closes to their nearest threat and immediately recovers. No fixed chain. The helper stays on the offensive player they stopped. Faster individual recovery; relies on stunts to buy time. Modern NBA trend.'},
      {v:'zoneLook',        t:'Zone shrink (Barcelona-style)',                               d:'After help, defense shrinks to blocks/elbows in a zone shape. Accepts a perimeter catch but contests the closeout. Works with switchable teams. Reduces rotation errors at the cost of conceding catch-and-shoot rhythm.'}
    ]},
  { id:'mismatchResponse', section:'switchmgmt',
    q:'General mismatch philosophy', h:'When a mismatch exists after any switch — what is your team\'s default protocol? This applies to all mismatches: big-on-guard, guard-on-big, and cross-mismatches from Spain PnR or switchAll.',
    opts:[
      {v:'frontBig',    t:'Front big + big challenges guard',    d:'Guard-on-big: guard fronts in post immediately, lob help assigned, nail plugs high-post flash. Big-on-guard: big pressures, dares drive, stunt help from weak side on penetration, tries to reswitch on kick. Active, aggressive philosophy.'},
      {v:'shrinkHelp',  t:'Shrink help — let each player compete', d:'Guard-on-big: 1v1 behind + collapse paint on catch (Switch & Shrink). Big-on-guard: big sags off, paint loaded, dares jump shot. Passive, zone-like. Accepts the mismatch but removes the drive lane.'},
      {v:'2v1fast',     t:'2v1 fast — immediate double on catch', d:'Regardless of which mismatch: as soon as the mismatched player catches, send a second defender immediately. Force the quick decision and accept the kick-out. Works for both big-on-guard and guard-on-big.'},
      {v:'accept1v1',   t:'Accept + compete — no special protocol', d:'Trust individual defense. No help rotation unless drive occurs. Only viable with high switchability and athleticism across the roster.'}
    ]},

  /* POST */
  { id:'postDefense', section:'post',
    q:'Post defense philosophy', h:'How do you defend the catch in the low post?',
    opts:[
      {v:'onev1',  t:'1v1 — behind',     d:'On-ball defender behind the post player. Help lives on weak side. Standard.'},
      {v:'threeFront', t:'3/4 front',    d:'Defender on high side, arm in passing lane. Requires dedicated low help.'},
      {v:'front',  t:'Full front',       d:'Deny the catch entirely. Requires lob help defender.'},
      {v:'dig',    t:'Dig / double',     d:'1v1 until catch, then dig from weak side. Best for post scorers without elbow game.'}
    ]},
  { id:'postDigger', section:'post',
    showIf: function(a){ return a.postDefense === 'dig'; },
    q:'Post dig source', h:'Who sends the help when the post catches?',
    opts:[
      {v:'weakWing',  t:'Weak-side wing',   d:'Most common. Wing drops to paint on catch. Weak-side rotation activates.'},
      {v:'nail',      t:'Nail defender',    d:'Top defender collapses. Works well with help-and-recover discipline.'},
      {v:'corner',    t:'Weak-side corner', d:'Corner player steps to dig. Gives up corner shot if kicked.'},
      {v:'none',      t:'No dig — 1v1',     d:'Trust 1v1 everywhere. No double-team at any point.'}
    ]},
  { id:'postFront', section:'post',
    showIf: function(a){ return a.postDefense === 'front' || a.postDefense === 'threeFront'; },
    q:'Front / 3/4 front — lob help', h:'Who covers the lob pass when you front the post?',
    opts:[
      {v:'weakBig',   t:'Weak-side big',   d:'Second big or center responsible for lob. Best matchup protection.'},
      {v:'helpChain', t:'Help chain',       d:'Nearest help defender takes lob. Requires recognition.'},
      {v:'na',        t:'N/A — playing behind',d:'Using 1v1 or dig — no front, no lob concern.'}
    ]},

  /* PERSONNEL */
  { id:'rimProtection', section:'personnel',
    q:'Personnel — rim protection', h:'Deterrence level at the basket.',
    opts:[
      {v:'low',    t:'Low',    d:'Small lineups or limited rim deterrence. Drop must compensate.'},
      {v:'medium', t:'Medium', d:'Serviceable rim protection — can show briefly, recover.'},
      {v:'high',   t:'High',   d:'Elite rim presence. Can front, dig, and recover. Enables aggressive coverage.'}
    ]},
  { id:'mobilityBig', section:'personnel',
    q:'Personnel — big mobility', h:'Can your big show, hedge, recover, and blitz?',
    opts:[
      {v:'low',    t:'Low',    d:'Drop-biased. Stay home. Cannot execute hedge or blitz reliably.'},
      {v:'medium', t:'Medium', d:'Can soft-hedge and recover. Blitz is risky.'},
      {v:'high',   t:'High',   d:'Comfortable hedging hard and recovering. Blitz viable.'}
    ]},
  { id:'switchability', section:'personnel',
    q:'Personnel — switchability', h:'1-through-5 size and positional matching for switches.',
    opts:[
      {v:'low',    t:'Low',    d:'Traditional matchups. Switches create mismatches. Use scram late.'},
      {v:'medium', t:'Medium', d:'Can switch guard-guard and forward-guard. Avoid G-C switches.'},
      {v:'high',   t:'High',   d:'Switch 1-through-5 consistently. Requires athletic bigs.'}
    ]},
  { id:'discipline', section:'personnel',
    q:'Personnel — execution discipline', h:'Foul rate and scramble execution quality.',
    opts:[
      {v:'low',  t:'Low',  d:'High foul environment. Avoid blitz volume. Simplify rotation chain.'},
      {v:'high', t:'High', d:'Veteran execution. Situational scrambles and late switches viable.'}
    ]},

  /* TRANSITION */
  { id:'transitionSafety', section:'transition',
    q:'Transition safety', h:'Who gets back and when.',
    opts:[
      {v:'oneBack',    t:'1 back',   d:'One assigned safety to rim.'},
      {v:'twoBack',    t:'2 back',   d:'Ball safety + rim safety. Protects vs two-man games in transition.'},
      {v:'matchups',   t:'Matchups', d:'No fixed safety — match up in conversion. Requires recognition.'},
      {v:'tagUpTrans', t:'Tag Up',   d:'Five-man tag; matchup transition. Linked to Tag Up ORB.'}
    ]},
  { id:'transitionPriority', section:'transition',
    q:'Transition priority', h:'First-pass principles when converting from offense to defense.',
    opts:[
      {v:'stopBall',   t:'Stop ball',   d:'Pick up dribbler immediately. Prevents layups.'},
      {v:'protectRim', t:'Protect rim', d:'Get to the paint first — help before ball pressure.'},
      {v:'wall',       t:'Wall',        d:'Channel into defined half-court coverage — contain width.'}
    ]},
  { id:'reboundBalance', section:'transition',
    q:'Offensive rebounding', h:'Glass rules after your shot attempts.',
    opts:[
      {v:'crash',       t:'Crash',        d:'Maximum crashers. Accepts transition exposure.'},
      {v:'balanced',    t:'Balanced',     d:'2–3 crashers. One safety always back.'},
      {v:'safetyFirst', t:'Safety-first', d:'1 crasher only. Transition defense priority.'},
      {v:'tagUp',       t:'Tag Up',       d:'Five contact tags; matchup-based conversion.'}
    ]},

  /* KYP */
  { id:'kypRules', section:'kyp', type:'kyp',
    q:'KYP — Know Your Personnel rules', h:'Define 0–5 opponent-specific rules. These are your game-day adjustments. Leave empty to use base philosophy only.' }
];

export const KYP_ROLES = [
  'Elite shooter (corner)',
  'Elite shooter (wing)',
  'Ball-handler creator',
  'Post scorer',
  'PnR screener (pop)',
  'PnR screener (roll)',
  'Off-ball cutter',
  'Transition threat',
  'Mid-range specialist',
  'DHO initiator'
];
export const KYP_ACTIONS = [
  'Full deny — no catch',
  'Chase over every screen',
  'ICE all ball screens',
  'Switch all screens',
  'Blitz on first PnR',
  'Front in post',
  'Double on catch',
  'No dig — trust 1v1',
  'Shade baseline on drives',
  'Force to weak hand',
  'Box & 1 principle',
  'Help off early — no threat'
];
export function sectionForStep(stepId) {
  for(var i=0;i<SECTIONS.length;i++) {
    if(SECTIONS[i].steps.indexOf(stepId)>=0) return SECTIONS[i];
  }
  return null;
}

export function stepLabel(stepId, value, answers) {
  var s = STEPS_DEF.find(function(x){return x.id===stepId;});
  if(!s) return '';
  if(s.type==='text') return value||'—';
  if(s.type==='subtype') {
    var arr = COV_SUBTYPE_OPTS[answers.pnrCoverage]||[];
    var o = arr.find(function(x){return x.v===value;});
    return o?o.t:value||'—';
  }
  if(s.type==='kyp') return '(see KYP rules)';
  var o = (s.opts||[]).find(function(x){return x.v===value;});
  return o?o.t:value||'—';
}

/* ═══════════════════════════════════════════════════
   VALIDATION / INCOMPATIBILITIES
═══════════════════════════════════════════════════ */
export function getBlockReason(stepId, value, answers) {
  var m = Object.assign({}, answers, {[stepId]: value});
  // Hard blocks
  if(stepId==='pnrCoverage' && value==='switch' && m.switchability==='low')
    return 'BLOCK: Switch shell requires switchable personnel.';
  if(stepId==='switchability' && value==='low' && m.pnrCoverage==='switch')
    return 'BLOCK: Low switchability cannot support switch shell.';
  if(stepId==='coverageSubtype' && m.pnrCoverage==='hedge' && value==='hard' && m.mobilityBig==='low')
    return 'BLOCK: Hard hedge requires medium or high big mobility.';
  if(stepId==='mobilityBig' && value==='low' && m.pnrCoverage==='hedge' && m.coverageSubtype==='hard')
    return 'BLOCK: Hard hedge requires mobile big.';
  if(stepId==='discipline' && value==='low' && m.pnrCoverage==='blitz')
    return 'BLOCK: Blitz volume requires disciplined execution.';
  return null;
}

export function getWarnReason(stepId, value, answers) {
  var m = Object.assign({}, answers, {[stepId]: value});
  // Warnings (non-blocking)
  if(stepId==='sideRule' && value==='ice' && m.driveDirection==='forceMiddle')
    return 'WARN: ICE forces baseline — conflicts with force-middle drive direction.';
  if(stepId==='pnrCoverage' && value==='drop' && m.priority==='three')
    return 'WARN: Drop concedes midrange pull-up — structural tension with 3-point protection priority.';
  if(stepId==='offBallPosition' && value==='fullDeny' && m.onBall==='contain')
    return 'WARN: Full deny off-ball with contain on-ball creates rotation gaps if beaten.';
  if(stepId==='postDefense' && value==='front' && m.rimProtection==='low')
    return 'WARN: Full front requires lob help — low rim protection makes this risky.';
  if(stepId==='pinDownRule' && value==='topLock' && m.offBallPosition==='fullDeny')
    return 'WARN: Top-lock + full deny is very demanding — ensure sufficient athleticism.';
  if(stepId==='transitionSafety' && value==='tagUpTrans' && m.reboundBalance!=='tagUp')
    return 'WARN: Tag Up transition is linked to Tag Up rebounding.';
  if(stepId==='reboundBalance' && value==='tagUp' && m.transitionSafety!=='tagUpTrans' && m.transitionSafety!=='matchups')
    return 'WARN: Tag Up ORB requires Tag Up or matchup transition to avoid exposure.';
  return null;
}

export function validateAll(answers) {
  var errors = [];
  var warnings = [];
  // Cross-field hard checks
  if(answers.pnrCoverage==='switch' && answers.switchability==='low')
    errors.push('Switch shell with low switchability is not viable.');
  if(answers.pnrCoverage==='blitz' && answers.discipline==='low')
    errors.push('Blitz with low discipline is not viable.');
  if(answers.pnrCoverage==='hedge' && answers.coverageSubtype==='hard' && answers.mobilityBig==='low')
    errors.push('Hard hedge with low big mobility is not viable.');
  if(answers.reboundBalance==='tagUp' && answers.transitionSafety!=='tagUpTrans' && answers.transitionSafety!=='matchups')
    warnings.push('Tag Up ORB without Tag Up transition creates exposure.');
  if(answers.transitionSafety==='tagUpTrans' && answers.reboundBalance!=='tagUp')
    warnings.push('Tag Up transition is most effective paired with Tag Up rebounding.');
  if(answers.sideRule==='ice' && answers.driveDirection==='forceMiddle')
    warnings.push('ICE (baseline force) and force-middle drive direction conflict on side PnR.');
  if(answers.pnrCoverage==='drop' && answers.priority==='three')
    warnings.push('Drop concedes midrange pull-up — structural tension with 3-point protection identity.');
  return {errors:errors, warnings:warnings};
}

/* ═══════════════════════════════════════════════════
   DERIVATION ENGINE
═══════════════════════════════════════════════════ */
export function derive(inp) {
  var t = {};
  var warnings = [];
  var cov = inp.pnrCoverage;
  var pr = inp.priority;
  var dd = inp.driveDirection;
  var ob = inp.onBall;
  var sw = inp.switchability;

  // Help structure
  if(cov==='switch') t.helpStructure='none';
  else if(cov==='drop') t.helpStructure = dd==='noMiddle'?'weak-side':dd==='forceMiddle'?'strong-side':'mixed';
  else if(cov==='blitz') t.helpStructure = pr==='rim'?'weak-side':pr==='three'?'strong-side':'mixed';
  else t.helpStructure='mixed';

  // Help timing
  t.helpTiming = (cov==='drop'||cov==='switch')?'late':'early';

  // Help intensity
  if(cov==='switch') t.helpIntensity='none';
  else if(cov==='blitz') t.helpIntensity='full';
  else if(cov==='drop') t.helpIntensity = pr==='three'?'dig':'stunt';
  else t.helpIntensity='dig';

  // Tag
  if(cov==='switch') t.lowManTag='none';
  else if(cov==='blitz') t.lowManTag='always (early)';
  else if(cov==='hedge') t.lowManTag='always';
  else t.lowManTag='conditional (low man)';

  // Rotation model — now explicit via xoutModel when set
  if(inp.xoutModel) {
    t.rotationModel = ({
      lastNextBeaten:'Last helps · Next reads first pass · Beaten recovers second',
      rotate:'Scripted rotate (1→2→3 toward ball)',
      peel:'Peel / recover first (help and recover)',
      zoneLook:'Zone shrink (Barcelona-style)'
    })[inp.xoutModel] || inp.xoutModel;
  } else if(cov==='switch') t.rotationModel='switch';
  else if(cov==='blitz') t.rotationModel='X-out chain (scripted)';
  else if(cov==='drop') t.rotationModel = pr==='three'?'X-out rotate':'recover';
  else t.rotationModel='recover / rotate by load';

  // Pop / skip
  if(t.rotationModel.indexOf('X-out')>=0||t.rotationModel.indexOf('chain')>=0) {
    t.pop='X-out closeout'; t.skip='X-out chain';
  } else {
    t.pop='direct closeout'; t.skip='recover / peel tags';
  }

  // Penetration
  t.penetration = cov==='blitz'?'help chain':'contain + recover';

  // Mismatch — unified protocol
  var mismatchMap = {
    frontBig:'Front big + big challenges guard on perimeter (both mismatch directions)',
    shrinkHelp:'Shrink help — each player competes with paint support',
    '2v1fast':'2v1 fast on catch — regardless of mismatch type',
    accept1v1:'Accept + compete — no special rotation'
  };
  t.mismatchSummary = inp.mismatchResponse ? (mismatchMap[inp.mismatchResponse] || inp.mismatchResponse) :
    (sw==='high' ? 'Scram / peel (derived from high switchability)' :
    inp.discipline==='high' ? 'Situational scram (derived from high discipline)' : 'Accept + compete (base personnel)');

  // Reswitch/scram protocol
  t.rescramSummary = inp.rescramRule ? ({
    always:'Always rescram — restore matchups at first dead ball or pass',
    mismatchOnly:'Rescram on dangerous mismatches only',
    never:'Never rescram — live with switch result',
    peel:'Peel switch (Beat → Peel → Switch) — auto chain'
  })[inp.rescramRule] : '—';

  // Closeout
  t.closeoutStyle = pr==='three'?'controlled (contest, no foul)':'aggressive (stop drive)';

  // Early offense summary
  t.earlyPnrSummary = inp.earlyPnrCoverage ? ({
    dropUnder:'Drop + under — big drops; guard passes under screen',
    switch:'Auto-switch all drag screens',
    containLoad:'Contain flat + load paint — no hedge',
    stopBallTag:'Stop ball high + tag roller — shell loads from weak side'
  })[inp.earlyPnrCoverage] : '—';

  t.earlyBigRole = inp.earlyPnrBig ? ({
    sprintRim:'Sprint to rim — ignore ball until paint reached',
    sprintTouch:'Sprint to touch level — brief contain then recover',
    callSwitch:'Call switch before screen — guard takes big',
    tagAndLoad:'Tag roller first + load as shell organizes'
  })[inp.earlyPnrBig] : '—';

  t.earlyRescreenRule = inp.earlyRescreenRule ? ({
    immediate:'Base half-court rules apply immediately on any rescreen',
    onceOrg:'Base rules once shell is organized — early rules until then',
    alwaysSwitch:'Always switch all rescreens in early offense'
  })[inp.earlyRescreenRule] : '—';

  // Next coverage summary
  t.nextCoverageSummary = inp.nextCoverage ? ({
    no:'Standard — no Next coverage',
    next:'NEXT: X5 attached to roller always. Nearest guard jumps to ball when X1 trails. X1 peels to next\'s man. Guards rotate among themselves.',
    hot:'HOT (aggressive Next): same chain but rotating defender approaches at speed — surprise element, trap appearance. Harder to read.',
    conditional:'Next or Hot — player decision in real time based on X1 trail distance (Obradoiro system).'
  })[inp.nextCoverage] : '—';

  // Pop answer summary
  t.popAnswerSummary = inp.popAnswer ? ({
    x5ImmediateRecover:'X5 recovers immediately to pop (short path — hedge/show anchor)',
    x5Closeout:'X5 long closeout to pop (standard for drop)',
    stuntNextClose:'X5 stunts at drive + next player closes pop',
    nailCloses:'Nail defender closes to pop; X5 stays in paint',
    switchToX1:'X1 takes pop, X5 stays on ball-handler (guard-on-big at pop)'
  })[inp.popAnswer] : '—';

  // ICE corner X3 summary
  t.iceCornerX3Summary = (inp.sideRule==='ice' && inp.iceCornerX3) ? ({
    stayHome:'Stay home on corner shooter — zero help from X3. X5 closes to pop alone.',
    stuntRecover:'Stunt 0.5s + recover — disrupts rhythm, concedes nothing.',
    closeoutPop:'X3 closes to pop if screener pops toward corner. X5 covers vacated corner (guard on big → scram-ready).',
    switchX3X5:'Switch X3↔X5: X5 takes corner guard (scram if cuts), X3 takes pop big.'
  })[inp.iceCornerX3] : (inp.sideRule==='ice' ? 'N/A (empty corner ICE — X3 stays weak side)' : '—');

  // ICE snake summary
  t.iceSnakeSummary = (inp.sideRule==='ice' && inp.iceSnake) ? ({
    x1Anticipate:'X1 anticipates snake pre-rejection — shades body to block middle before it happens.',
    x5Jumps:'X5 pivots to block middle drive (soft hedge pivot). Leaves roller brief window.',
    nailHelp:'Nail collapses to driving lane. X5 tags roller. Three-man response.',
    accept:'Accept snake — structural concession of ICE. Contain and compete.'
  })[inp.iceSnake] : (inp.sideRule==='ice' ? '—' : '—');

  // Spain PnR summary
  t.spainSummary = inp.spainCoverage ? ({
    switch13:'1-3 switch: back-screener\'s defender takes ball-handler; ball-handler\'s defender takes back-screener',
    bump:'Bump + recover: roller\'s defender disrupts back screen then recovers',
    blitzSpain:'Blitz PnR + deny back-screen catch; X-out chain',
    switchAll:'Switch everything — full 3-man exchange',
    iceSpain:'ICE PnR + low man tags roller; back-screener\'s defender stays on pop'
  })[inp.spainCoverage] : '—';

  // Off-ball derivations
  t.offBallStance = inp.offBallPosition==='gap'?'gap (one step off line)':
    inp.offBallPosition==='semiDeny'?'semi-deny (on line, step toward ball)':'full deny (on line, body to check)';

  t.helpSideAnchor = inp.helpSideDepth==='nail'?'nail (free-throw line center)':
    inp.helpSideDepth==='paint'?'deep paint':'I-line (shallow)';

  // Post derivation
  t.postAnswer = inp.postDefense==='onev1'?'1v1 behind — no dig':
    inp.postDefense==='threeFront'?'3/4 front — deny high side':
    inp.postDefense==='front'?'full front — deny catch (lob help required)':
    'dig on catch from '+({weakWing:'weak-side wing',nail:'nail defender',corner:'weak-side corner',none:'N/A'})[inp.postDigger||'none'];

  // Transition description
  t.transitionDesc = ({
    oneBack:'1 safety to rim; release vs crash scripted.',
    twoBack:'2 safeties: ball first then rim.',
    matchups:'Matchup conversion; no fixed safety.',
    tagUpTrans:'Tag Up: five-man contact tags, matchup transition.'
  })[inp.transitionSafety]||'';

  /* ── Cognitive load — weighted complexity score (v6) ─────────────────────────
     Each choice carries a real training-cost weight, not just "deviation from default".
     Higher = more rules to teach, more communication, more IQ/athleticism required.
     Bands: ≤8 Simple · 9–15 Moderate · 16–24 Demanding · 25+ Elite-only.
     Rationale: switch=0 (no help structure to teach), drop=1 (one rule),
     hedge=3 (recovery + tag + closeout), blitz=5 (X-out chain + 4v3 management).
     Maximum theoretical: ~70 with worst-case picks + 5 KYP rules. */
  var W = {
    pnrCoverage:        {drop:1, switch:0, hedge:3, blitz:5},
    coverageSubtype:    {deep:0, high:0, soft:0, hard:1, flat:0, early:0, standard:0, containTrap:1},
    sideRule:           {ice:2, weak:1, standard:0},
    middleRule:         {weak:1, standard:0, switch:1},
    dhoRule:            {switch:0, contain:1, hedge:2},
    nextCoverage:       {no:0, next:3, hot:4, conditional:5},
    popAnswer:          {x5ImmediateRecover:1, x5Closeout:1, stuntNextClose:2, nailCloses:2, switchToX1:2},
    iceCornerX3:        {stayHome:0, stuntRecover:1, closeoutPop:2, switchX3X5:2},
    iceSnake:           {x1Anticipate:2, x5Jumps:1, nailHelp:2, accept:0},
    earlyPnrCoverage:   {dropUnder:1, switch:1, containLoad:2, stopBallTag:2},
    earlyPnrBig:        {sprintRim:0, sprintTouch:1, callSwitch:1, tagAndLoad:2},
    earlyRescreenRule:  {immediate:0, onceOrg:1, alwaysSwitch:0},
    earlyPostRule:      {loadHelp:1, frontImmed:2, accept1v1:0, doubleOnCatch:2},
    pinDownRule:        {over:1, under:1, topLock:2, switch:0},
    backScreenRule:     {switch:0, chase:1, show:2},
    flareRule:          {over:1, switch:0, under:1},
    stagRule:           {through:2, switch:0, topLock:2},
    dhoOffBall:         {switch:0, contain:1, deny:2},
    spainCoverage:      {switch13:2, bump:2, blitzSpain:4, switchAll:3, iceSpain:3},
    rescramRule:        {always:2, mismatchOnly:1, never:0, peel:1},
    xoutModel:          {lastNextBeaten:3, rotate:2, peel:2, zoneLook:3},
    mismatchResponse:   {frontBig:2, shrinkHelp:1, '2v1fast':2, accept1v1:0},
    postDefense:        {onev1:0, threeFront:2, front:3, dig:2},
    postDigger:         {weakWing:1, nail:1, corner:1, none:0},
    postFront:          {weakBig:1, helpChain:2, na:0},
    offBallPosition:    {gap:0, semiDeny:1, fullDeny:2},
    onePassDeny:        {shooters:1, allWings:2, noDeny:0},
    helpSideDepth:      {nail:1, paint:1, shallow:1},
    pickupPoint:        {half:0, threeq:1, full:2, forty:1},
    transitionSafety:   {oneBack:0, twoBack:1, matchups:2, tagUpTrans:2},
    transitionPriority: {stopBall:0, protectRim:1, wall:1},
    reboundBalance:     {crash:1, balanced:0, safetyFirst:0, tagUp:2}
  };
  var score = 0;
  for(var k in W) {
    var v = inp[k];
    if(v != null && W[k][v] != null) score += W[k][v];
  }
  // KYP rules: +1 each (game-day exception layer = real training overhead)
  if(Array.isArray(inp.kypRules)) score += inp.kypRules.length;

  t.cognitiveLoad = score;
  t.cognitiveRating = score<=8  ? 'Simple ('+score+' pts — low training demand)'
                    : score<=15 ? 'Moderate ('+score+' pts — standard pro training)'
                    : score<=24 ? 'Demanding ('+score+' pts — high communication & IQ load)'
                    :             'Elite ('+score+' pts — requires veteran execution & repetition)';

  // Trade-offs
  var tradeoffs = [];
  if(cov==='drop') tradeoffs.push('DROP: Concedes clean midrange pull-up. Structural tax = pull-up jumper at screen level.');
  if(cov==='switch') tradeoffs.push('SWITCH: Concedes matchup integrity. Structural tax = iso mismatches and post-up exposures.');
  if(cov==='hedge') tradeoffs.push('HEDGE: Lives on recovery speed. Structural tax = pocket drives and roll-back lobs if big late.');
  if(cov==='blitz') tradeoffs.push('BLITZ: Creates 4v3 behind the trap. Structural tax = skip pass, reversal, and long closeouts.');
  if(inp.offBallPosition==='fullDeny') tradeoffs.push('FULL DENY: Back-cuts and lobs are the counter. Requires disciplined lob help coverage.');
  if(inp.postDefense==='front') tradeoffs.push('FULL FRONT: Lob is live. Requires assigned lob help every possession.');
  if(inp.pickupPoint==='full') tradeoffs.push('FULL PRESS: High rotation depth required. Fatigue and foul exposure are real.');
  if(inp.earlyPnrCoverage==='stopBallTag') tradeoffs.push('EARLY STOP+TAG: Guard must stop ball alone while big is trailing. Guard athleticism is critical.');
  if(inp.spainCoverage==='switch13') tradeoffs.push('SPAIN 1-3 SWITCH: Creates cross-mismatches. Must have scram/peel protocol ready for immediate counter.');

  t.tradeoffs = tradeoffs;

  // ── PERSONNEL COMPATIBILITY ANALYSIS ──
  var personnelIssues = [];
  var personnelWarnings = [];

  // PnR anchor vs personnel — hedge gated by subtype (v6 fix: avoid false positives on soft hedge)
  if(cov==='hedge') {
    if(inp.mobilityBig==='low') {
      if(inp.coverageSubtype==='hard') {
        personnelIssues.push({field:'PnR: Hard hedge vs Big mobility LOW',detail:'Hard hedge requires the big to show aggressively and flatten the ball-handler before recovering. Low-mobility big cannot execute this reliably — expect split drives and lob layups on every recovery attempt. Switch subtype to soft hedge or change anchor to drop.'});
      } else {
        personnelWarnings.push({field:'PnR: Soft hedge vs Big mobility LOW',detail:'Soft hedge is workable with low mobility but recovery margin is thin. Limit hedge volume vs strong PnR teams; rely on drop in late-clock situations.'});
      }
    }
    if(inp.mobilityBig==='medium' && inp.coverageSubtype==='hard') {
      personnelWarnings.push({field:'PnR: Hard hedge vs Big mobility MEDIUM',detail:'Hard hedge is risky with medium mobility — the big may not flatten in time. Drill recovery footwork extensively before relying on hard hedge in-game. Soft hedge is the safer default for this personnel.'});
    }
    if(inp.rimProtection==='low') personnelWarnings.push({field:'PnR: Hedge vs Rim protection LOW',detail:'Hedge with low rim protection means if the recovery is late, there is no rim deterrence as backup. Consider drop to compensate.'});
  }
  if(cov==='blitz') {
    if(inp.discipline==='low') personnelIssues.push({field:'PnR: Blitz vs Discipline LOW',detail:'Blitz volume requires all 5 defenders to execute the X-out chain in real time. Low-discipline teams create uncontested layups instead of turnovers. Not viable.'});
    if(inp.switchability==='low') personnelWarnings.push({field:'PnR: Blitz vs Switchability LOW',detail:'Blitz creates mismatches via X-out. With low switchability, the resulting closeouts leave tall order for athleticism-limited defenders.'});
    if(inp.mobilityBig==='low') personnelWarnings.push({field:'PnR: Blitz vs Big mobility LOW',detail:'The blitzing big must sprint back to the paint after the trap. Low mobility = slow recover = open short roll repeatedly.'});
  }
  if(cov==='switch') {
    if(inp.switchability==='low') personnelIssues.push({field:'PnR: Switch vs Switchability LOW',detail:'Switch shell with low switchability is not viable — this is a hard incompatibility. Change shell or improve personnel.'});
    if(inp.switchability==='medium') personnelWarnings.push({field:'PnR: Switch vs Switchability MEDIUM',detail:'Selective switching only. Avoid G-C switches. Map which match-ups are acceptable before game day.'});
    if(inp.rimProtection==='low') personnelWarnings.push({field:'PnR: Switch vs Rim protection LOW',detail:'After switches, mismatches in post will not have rim deterrence as backup. Double protocol becomes critical.'});
  }

  // Early offense vs personnel
  if(inp.earlyPnrCoverage==='stopBallTag' && inp.mobilityBig==='low') {
    personnelWarnings.push({field:'Early PnR: Stop+Tag vs Big mobility LOW',detail:'Stop ball + tag requires the big to sprint and reach the tag position while still trailing. Low-mobility big will arrive late — roller gets the lob before the tag.'});
  }
  if(inp.earlyPnrCoverage==='switch' && inp.switchability==='low') {
    personnelIssues.push({field:'Early PnR: Switch vs Switchability LOW',detail:'Auto-switching drag screens creates systematic mismatches with low-switchability personnel. Contradicts your half-court switch restriction.'});
  }

  // Spain PnR vs personnel
  if(inp.spainCoverage==='switch13' && inp.switchability==='low') {
    personnelIssues.push({field:'Spain PnR: 1-3 switch vs Switchability LOW',detail:'The 1-3 switch creates a guard-on-big or big-on-guard cross-mismatch. With low switchability this is exploitable immediately.'});
  }

  // Mismatch vs personnel — based on general mismatch protocol
  if(inp.mismatchResponse==='frontBig' && inp.switchability==='low') {
    personnelWarnings.push({field:'Mismatch: Front big vs Switchability LOW',detail:'Front big requires the guard to hold post position while the big guards the perimeter. Low switchability means the big cannot guard the guard credibly.'});
  }
  if(inp.mismatchResponse==='frontBig' && inp.rimProtection==='low') {
    personnelWarnings.push({field:'Mismatch: Front big vs Rim protection LOW',detail:'Fronting the post requires lob help from a rim protector. With low rim protection the lob is essentially uncontested.'});
  }

  // Post defense vs personnel
  if(inp.postDefense==='front' && inp.rimProtection==='low') {
    personnelIssues.push({field:'Post: Full front vs Rim protection LOW',detail:'Full front requires reliable lob help. With low rim protection, the lob catch near the rim is essentially a layup. Switch to 3/4 front or dig.'});
  }
  if(inp.postDefense==='dig' && inp.mobilityBig==='low') {
    personnelWarnings.push({field:'Post: Dig vs Big mobility LOW',detail:'Dig requires the weak-side helper to sprint to the block and recover to their man on kick-out. Low-mobility big as helper creates slow rotation.'});
  }

  // Off-ball vs personnel
  if(inp.offBallPosition==='fullDeny' && inp.discipline==='low') {
    personnelWarnings.push({field:'Off-ball: Full deny vs Discipline LOW',detail:'Full denial requires constant communication on back-cuts and skip passes. Low discipline turns this into an adventure — backdoor layups and uncontested skips.'});
  }

  // Transition vs personnel
  if(inp.reboundBalance==='tagUp' && inp.transitionSafety!=='tagUpTrans' && inp.transitionSafety!=='matchups') {
    personnelIssues.push({field:'Transition: Tag Up ORB vs safety assignment',detail:'Tag Up rebounding without Tag Up transition safety creates exposure on the defensive break.'});
  }

  t.personnelIssues = personnelIssues;
  t.personnelWarnings = personnelWarnings;

  return t;
}

export function buildReport(answers) {
  var tac = derive(answers);
  var checks = validateAll(answers);

  // Auto-generate system name from choices
  var autoName = [];
  if(answers.systemName && answers.systemName.trim()) autoName.push(answers.systemName.trim());
  else {
    if(answers.pnrCoverage) autoName.push(answers.pnrCoverage.charAt(0).toUpperCase()+answers.pnrCoverage.slice(1));
    if(answers.priority==='three') autoName.push('3-Prot');
    else if(answers.priority==='disrupt') autoName.push('Press');
  }
  var displayName = autoName.join(' / ')||'Untitled System';

  return { name:displayName, tac:tac, checks:checks, answers:answers };
}

/* ═══════════════════════════════════════════════════
   WIZARD STEPS LOGIC
═══════════════════════════════════════════════════ */
export function stepVisible(step, answers) {
  if(!step.showIf) return true;
  return step.showIf(answers);
}

export function getVisibleSteps(answers) {
  return STEPS_DEF.filter(function(s){ return stepVisible(s, answers||{}); });
}

export function getStepIndex(stepId) {
  return STEPS_DEF.findIndex(function(s){return s.id===stepId;});
}
