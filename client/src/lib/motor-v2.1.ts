/**
 * U Scout Motor v2.1 - TypeScript Engine
 * 
 * Pure logic engine that generates scouting outputs from player inputs.
 * Designed for React integration with i18n support.
 * 
 * v2.1 Changes:
 * - 6 new inputs: transRole, ballHandling, pressureResponse, postEff, postMoves, postEntry
 * - 14 new outputs for transition roles, pressure vulnerability, and post moves
 * - duck_in moved from cutType to postEntry
 * - ClubContext support (league type, gender, level)
 */

// ============================================================================
// TYPES
// ============================================================================

export type Frequency = 'P' | 'S' | 'R' | 'N' | null;
export type Efficiency = 'high' | 'medium' | 'low' | null;
export type Usage = 'primary' | 'secondary' | 'role';
export type SelfCreation = 'high' | 'medium' | 'low';
export type Hand = 'R' | 'L';
export type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C';
export type Direction = 'L' | 'R' | 'B' | null;
export type IsoDecision = 'S' | 'F' | 'P' | null; // Shoot, Finish, Pass
export type PostProfile = 'B2B' | 'FU' | 'M' | null;
export type PostZone = 'low' | 'high' | 'short' | null;
export type SpotZone = 'corner' | 'wing' | 'top' | null;
export type ScreenerAction = 'roll' | 'pop' | 'slip' | null;
export type PopRange = 'three' | 'midrange' | null;
export type DhoRole = 'giver' | 'receiver' | 'both' | null;
export type DhoAction = 'shoot' | 'drive' | 'pass' | null;
export type ContactFinish = 'seeks' | 'neutral' | 'avoids' | null;
export type OffHandFinish = 'strong' | 'capable' | 'weak' | null;
export type TrapResponse = 'escape' | 'pass' | 'struggle' | null;
export type OrebThreat = 'high' | 'medium' | 'low' | null;
export type PnrPriority = 'SF' | 'PF' | null; // Score First, Pass First

/** Handler PnR preferred finish when ball on that side (editor / scout POV) */
export type PnrHandlerSideFinish =
  | 'Drive to Rim'
  | 'Pull-up'
  | 'Floater'
  | 'Mid-range'
  | null;

// v2.1 - New types
export type TransRole = 'rim_run' | 'trail' | 'leak' | 'fill' | null;
export type BallHandling = 'elite' | 'capable' | 'limited' | 'liability' | null;
export type PressureResponse = 'breaks' | 'escapes' | 'struggles' | null;
export type PostMove = 'fade' | 'turnaround' | 'hook' | 'drop_step' | 'up_and_under';
export type PostEntry = 'pass' | 'duck_in' | 'seal' | 'flash' | null;

// v2.1 - CutType WITHOUT duck_in (moved to PostEntry)
export type CutType = 'basket' | 'backdoor' | 'flash' | 'curl' | null;

export type TransRoleEditor = 'rim_runner' | 'trail' | 'runner' | 'pusher' | null;

export type HighPostAction =
  | 'face_up_drive'
  | 'pull_up'
  | 'pass_to_cutter'
  | 'step_back'
  | 'post_up_down';

export interface HighPostZonesMotor {
  leftElbow?: HighPostAction | null;
  rightElbow?: HighPostAction | null;
}

/** Editor graded frequency (primary → never) */
export type EditorGradedFrequency = 'primary' | 'secondary' | 'rare' | 'never';
export type ScreenerActionFrequency = EditorGradedFrequency;

export type EditorOffBallScreenKind =
  | 'slip'
  | 'roll'
  | 'pop_short'
  | 'pop_mid'
  | 'short_roll'
  | 'none';

export type EditorTransitionPrimaryRole =
  | 'rim_runner'
  | 'trail'
  | 'corredora'
  | 'empujadora'
  | 'none';

export type EditorIsoHandFinish = 'drive' | 'pullup' | 'floater' | 'pass';

function editorGradedFreqWeight(f: EditorGradedFrequency): number {
  switch (f) {
    case 'primary':
      return 0.9;
    case 'secondary':
      return 0.7;
    case 'rare':
      return 0.45;
    case 'never':
      return 0.2;
    default:
      return 0.5;
  }
}

/** Off-ball screen receiver — distinct from PnR `screenerAction` */
export type OffBallScreenerAction =
  | 'roll_to_rim'
  | 'pop_3'
  | 'pop_mid'
  | 'short_roll'
  | 'slip'
  | null;

export type OffBallCutAction =
  | 'catch_and_shoot'
  | 'catch_and_drive'
  | 'curl'
  | 'flare'
  | null;

// v2.1 - Club context for league/category awareness (motor v3 league taxonomy)
export interface ClubContext {
  leagueType?:
    | 'nba'
    | 'euroleague_m'
    | 'euroleague_f'
    | 'acb'
    | 'cba'
    | 'wcba'
    | 'ncaa_m'
    | 'ncaa_f'
    | 'cuba_m'
    | 'cuba_f'
    | 'fiba_americas'
    | 'amateur'
    | null;
  gender?: 'M' | 'F' | 'mixed' | null;
  level?: 'elite' | 'competitive' | 'developmental' | null;
  ageCategory?: 'senior' | 'U23' | 'U22' | 'U18' | 'U16' | null;
}

export interface PlayerInputs {
  // Identity
  pos: Position;
  hand: Hand;
  ath: 1 | 2 | 3 | 4 | 5;
  phys: 1 | 2 | 3 | 4 | 5;
  personality?: ('clutch' | 'leader' | 'selfish' | 'freezes')[] | null;
  
  // Play type frequencies
  isoFreq: Frequency;
  pnrFreq: Frequency;
  postFreq: Frequency;
  transFreq: Frequency;
  spotUpFreq: Frequency;
  dhoFreq: Frequency;
  cutFreq: Frequency;
  indirectFreq: Frequency;
  
  // Role
  usage: Usage;
  selfCreation: SelfCreation;
  vision: 1 | 2 | 3 | 4 | 5;
  
  // Finishing
  offHandFinish: OffHandFinish;
  floater: Frequency;
  contactFinish: ContactFinish;
  
  // ISO details
  isoDir: Direction;
  isoDec: IsoDecision;
  isoEff: Efficiency;
  isoStartZone?: 'left_wing' | 'right_wing' | 'top' | 'either' | null;
  
  // Post details
  postProfile: PostProfile;
  postZone: PostZone;
  postShoulder: Direction;
  postEff: Efficiency;                    // v2.1 - NEW
  postMoves: PostMove[] | null;           // v2.1 - NEW
  postEntry: PostEntry;                   // v2.1 - NEW
  highPostZones?: HighPostZonesMotor | null;
  dunkerSpot?: 0 | 1 | 2 | null;

  offBallRole?: 'screener' | 'cutter' | 'both' | 'none' | null;
  motorTransitionPrimary?: EditorTransitionPrimaryRole | null;
  rimRunFrequency?: EditorGradedFrequency | null;
  trailFrequency?: EditorGradedFrequency | null;
  offBallScreenPattern?: EditorOffBallScreenKind | null;
  offBallScreenPatternFreq?: ScreenerActionFrequency | null;
  isoStrongHandFinish?: EditorIsoHandFinish | null;
  isoWeakHandFinish?: EditorIsoHandFinish | null;
  transFinishing?: 'high' | 'medium' | 'low' | 'not_observed' | null;

  // Spot-up details
  spotUpAction: 'shoot' | 'pump' | 'either' | null;
  spotZone: SpotZone;
  deepRange: boolean;
  
  // PnR details
  pnrPri: PnrPriority;
  /** Handler finish efficiency — optional; omit or null when not observed */
  pnrEff?: 'high' | 'medium' | 'low' | null;
  pnrEffLeft?: 'high' | 'medium' | 'low' | null;
  pnrEffRight?: 'high' | 'medium' | 'low' | null;
  pnrFinishLeft: PnrHandlerSideFinish;
  pnrFinishRight: PnrHandlerSideFinish;
  trapResponse: TrapResponse;
  
  // Screener details
  screenerAction: ScreenerAction;
  pnrScreenTiming?: 'holds_long' | 'quick_release' | 'ghost_touch' | 'slip' | null;
  pnrSnake?: boolean | null;  // Handler reverses direction off the screen
  popRange: PopRange;
  /** Off-ball screens (after setting pick) — bridged from PlayerInput.screenerAction */
  offBallScreenerAction?: OffBallScreenerAction;
  offBallCutAction?: OffBallCutAction;
  
  // DHO details
  dhoRole: DhoRole;
  dhoAction: DhoAction;
  
  // Transition details - v2.1 ENHANCED
  transRole: TransRole;                   // v2.1 - NEW
  transRolePrimary?: TransRoleEditor;
  transRoleSecondary?: TransRoleEditor;
  transSubPrimary?: string | null;
  transSubSecondary?: string | null;
  
  // Ball handling & pressure - v2.1 NEW
  ballHandling: BallHandling;             // v2.1 - NEW
  pressureResponse: PressureResponse;     // v2.1 - NEW
  
  // Other
  cutType: CutType;                       // v2.1 - MODIFIED (removed duck_in)
  orebThreat: OrebThreat;
  freeCutsFrequency?: 'Primary' | 'Secondary' | 'Rare' | 'Never' | null;
  freeCutsType?: 'basket' | 'flash' | 'both' | null;
  putbackQuality?: 'primary' | 'capable' | 'palms_only' | 'not_observed' | null;
  /** Team star — extra defensive emphasis when true (optional; bridge may omit). */
  starPlayer?: boolean | null;
}

export interface MotorOutput {
  key: string;
  category: 'deny' | 'force' | 'allow' | 'aware';
  weight: number;
  params?: Record<string, string>;
  source: string;
}

export interface SituationThreatScore {
  situation: string;
  score: number;
  /** Key of the highest-weight deny output in this situation */
  topOutput: string;
}

const THREAT_THRESHOLDS = {
  denyEligible: 0.7,
  awareHigh: 0.4,
  awareLow: 0.2,
  allowCandidate: 0.2,
} as const;

/** Map from output `source` to situation bucket (threat scores use deny outputs only). */
const SOURCE_TO_SITUATION: Record<string, string> = {
  iso: 'iso',
  iso_dir: 'iso',
  iso_dir_confirmed: 'iso',
  iso_strong_hand_finish: 'iso',
  iso_weak_hand_finish: 'iso',
  selfish_low_eff: 'iso',
  selfish: 'iso',
  pnr: 'pnr',
  pnr_finish_asymmetry: 'pnr',
  pnr_shooter_weak_side: 'pnr',
  trap_response: 'pnr',
  escape_pass_first: 'pnr',
  screener_roll: 'screener',
  screener_pop: 'screener',
  screener_pop_no_range: 'screener',
  screener_slip: 'screener',
  screen_timing: 'screener',
  data_inconsistency: 'screener',
  post: 'post',
  post_shoulder: 'post',
  post_entry_duck_in: 'post',
  post_entry_seal: 'post',
  post_rare_efficient: 'post',
  post_move_fade: 'post',
  post_move_turnaround: 'post',
  post_move_hook: 'post',
  post_combo_hook_upunder: 'post',
  no_post: 'post',
  dunker_spot: 'post',
  high_post: 'post',
  duck_in_rim_runner_unified: 'post',
  trans_rim_run: 'transition',
  trans_trail: 'transition',
  trans_leak: 'transition',
  trans_sub: 'transition',
  trans_cut_finishing: 'transition',
  transition: 'transition',
  transition_graded: 'transition',
  corner_spot: 'spot',
  corner_no_range: 'spot',
  no_deep_range: 'spot',
  deep_range: 'spot',
  dho: 'dho',
  cut: 'cut',
  cut_compulsive_unified: 'cut',
  oreb: 'oreb',
  oreb_finisher: 'oreb',
  oreb_distributor: 'oreb',
  oreb_medium: 'oreb',
  oreb_threat: 'oreb',
  off_ball_screen: 'offball',
  off_ball_cut: 'offball',
  off_ball_roll_rim: 'offball',
  off_ball_screen_graded: 'offball',
  off_ball_role: 'offball',
  floater: 'floater',
  pnr_floater_unified: 'pnr',
  contact_avoids: 'misc',
  off_hand: 'misc',
  contact_weak_hand_combined: 'misc',
  self_creation: 'misc',
  vision: 'misc',
  physical: 'misc',
  both_hands: 'misc',
  connector: 'misc',
  weak_iso: 'misc',
  ball_handling_liability: 'misc',
  limited_handling_struggles: 'misc',
  ball_handling_limited: 'misc',
  pressure_struggles: 'misc',
  no_range_no_threat: 'misc',
  gender_f_interior: 'misc',
  oreb_and_transition: 'oreb',
  no_range_spot_active: 'spot',
  interior_low_impact: 'misc',
  selfish_exploitable: 'misc',
};

export interface InferredField {
  value: unknown;
  confidence: 'high' | 'medium' | 'low';
}

export interface EnrichedInputs extends PlayerInputs {
  _inferred: Record<string, InferredField>;
}

export interface ZoneThreat {
  zone: string;
  threat: number;
  source: string;
}

export interface PlayType {
  name: string;
  frequency: Frequency;
  weight: number;
  details: string | null;
}

export interface Slides {
  identity: {
    bullets: Array<{ key: string; text: string }>;
  };
  whereDangerous: {
    zones: ZoneThreat[];
  };
  howAttacks: {
    playTypes: PlayType[];
  };
  screensActions: {
    actions: Array<{
      type: string;
      action?: string;
      role?: string;
      details?: string | null;
      response?: string;
    }>;
  };
  defensivePlan: {
    deny: FormattedOutput[];
    force: FormattedOutput[];
    allow: FormattedOutput[];
  };
}

export interface FormattedOutput {
  key: string;
  text: string;
  weight?: number;
  source?: string;
}

export interface MotorReport {
  inputs: EnrichedInputs;
  rawOutputs: MotorOutput[];
  categorized: Record<string, MotorOutput[]>;
  selected: Record<string, MotorOutput[]>;
  slides: Slides;
  threatScores?: SituationThreatScore[];
  runnersUp?: MotorOutput[];
}

// ============================================================================
// WEIGHTS CONFIGURATION (externalized for easy tuning)
// ============================================================================

export const WEIGHTS = {
  frequencyToWeight: { P: 1.0, S: 0.7, R: 0.3, N: 0.0 } as Record<string, number>,
  efficiencyMultiplier: { high: 1.2, medium: 1.0, low: 0.8 } as Record<string, number>,
  usageMultiplier: { primary: 1.0, secondary: 0.85, role: 0.6 } as Record<string, number>,
  athMultiplier: { 1: 0.6, 2: 0.75, 3: 0.9, 4: 1.0, 5: 1.1 } as Record<number, number>,
  physMultiplier: { 1: 0.6, 2: 0.75, 3: 0.9, 4: 1.0, 5: 1.1 } as Record<number, number>,
  
  outputWeights: {
    iso: { baseWeight: 0.85 },
    pnr: { baseWeight: 0.9, priorityBonus: { SF: 0.1, PF: 0.05 } },
    post: { baseWeight: 0.85, profileBonus: { B2B: 0.1, FU: 0.05, M: 0 } },
    transition: { baseWeight: 0.8, athBonus: true },
    spotUp: { baseWeight: 0.75, deepRangeBonus: 0.15, zoneBonus: { corner: 0.15, wing: 0.05, top: 0 } },
    dho: { baseWeight: 0.85, roleBonus: { giver: 0.15, receiver: 0.05, both: 0.20 } },
    cut: { baseWeight: 0.6, typeBonus: { basket: 0.1, backdoor: 0.15, flash: 0.05, curl: 0.1 } },
    oreb: { baseWeight: 0.7, threatMultiplier: { high: 1.3, medium: 1.0, low: 0.6 } },
    floater: { baseWeight: 0.7 },
    screener: { rollWeight: 0.8, popWeight: 0.7, slipWeight: 0.65 },
    // v2.1 - New weights
    transRole: { 
      rim_run: 0.9, 
      trail: 0.95, 
      leak: 0.75, 
      fill: 0.5 
    },
    pressure: {
      struggles: 0.9,
      escapes: 0.6,
      breaks: 0.3
    },
    ballHandling: {
      liability: 0.95,
      limited: 0.75,
      capable: 0.4,
      elite: 0.1
    },
    postMoves: {
      fade: 0.85,
      turnaround: 0.8,
      hook: 0.75,
      drop_step: 0.7,
      up_and_under: 0.65
    },
    postEntry: {
      duck_in: 0.85,
      seal: 0.8,
      flash: 0.7,
      pass: 0.5
    }
  },
  
  forceRules: {
    weakHand: { baseWeight: 0.8, offHandWeakBonus: 0.2 },
    perimeter: { noDeepRangeWeight: 0.8 },
    contactFinish: { avoidsWeight: 0.75 },
    earlyShot: { baseWeight: 0.6, selfCreationHighBonus: 0.2 },
    // v2.1 - New force rules
    fullCourt: { baseWeight: 0.85 },
    noBall: { baseWeight: 0.9 }
  },
  
  allowRules: {
    postUp: { neverWeight: 0.8 },
    spotUp: { lowFreqWeight: 0.6, noDeepRangeBonus: 0.3 },
    iso: { lowEffWeight: 0.65 },
    // v2.1 - New allow rules
    ballHandling: { limitedWeight: 0.92 }
  },
  
  maxOutputsPerCategory: { deny: 3, force: 2, allow: 3, aware: 5 },
  slideOutputLimits: { defensivePlan: { deny: 2, force: 1, allow: 1 } }
};

// ============================================================================
// INFERENCE RULES
// ============================================================================

const INFERENCE_RULES = {
  neverInfer: [
    'isoDir', 'isoDec', 'postShoulder', 'postZone', 'spotZone', 'cutType', 
    'dhoAction', 'floater', 'vision',
    // Never infer screener behavior or pressure response — these are scout observations
    'screenerAction', 'pressureResponse', 'ballHandling',
    // v2.1 - Never infer these
    'transRole',
    'transRolePrimary',
    'transRoleSecondary',
    'transSubPrimary',
    'transSubSecondary',
    'postMoves',
    'postEntry',
    'postEff',
    'pnrEff',
    'pnrFinishLeft',
    'pnrFinishRight',
    'highPostZones',
    'offBallScreenerAction',
    'offBallCutAction',
    'dunkerSpot',
    'offBallRole',
    'motorTransitionPrimary',
    'rimRunFrequency',
    'trailFrequency',
    'offBallScreenPattern',
    'offBallScreenPatternFreq',
    'isoStrongHandFinish',
    'isoWeakHandFinish',
  ],
  
  executionOrder: [
    'contactFinish', 'orebThreat', 'postFreq', 'screenerAction', 'selfCreation', 
    'popRange', 'trapResponse', 'offHandFinish',
    // v2.1 - New inference order
    'ballHandling', 'pressureResponse',
    'motorTransitionPrimary',
    'rimRunFrequency',
    'trailFrequency',
    'offBallScreenPatternFreq',
    'isoStrongHandFinish',
    'isoWeakHandFinish',
  ],
  
  inferences: {
    contactFinish: {
      conditions: [
        { when: { phys: 5, postFreq: 'P' }, then: 'seeks', confidence: 'high' as const },
        { when: { phys: 5, postFreq: 'S' }, then: 'seeks', confidence: 'medium' as const },
        { when: { phys: 4, postFreq: 'P' }, then: 'seeks', confidence: 'medium' as const },
        { when: { ath: 5, phys: [1, 2] }, then: 'avoids', confidence: 'medium' as const },
        { when: { deepRange: true, phys: [1, 2] }, then: 'avoids', confidence: 'medium' as const }
      ]
    },
    orebThreat: {
      conditions: [
        { when: { phys: 5, pos: ['PF', 'C'], contactFinish: 'seeks' }, then: 'high', confidence: 'high' as const },
        { when: { phys: 4, pos: ['PF', 'C'] }, then: 'medium', confidence: 'medium' as const },
        { when: { pos: ['PG', 'SG'] }, then: 'low', confidence: 'high' as const }
      ]
    },
    screenerAction: {
      conditions: [
        { when: { phys: 5, spotUpFreq: 'N', deepRange: false }, then: 'roll', confidence: 'high' as const },
        { when: { phys: [4, 5], deepRange: false }, then: 'roll', confidence: 'medium' as const },
        { when: { deepRange: true, spotUpFreq: ['P', 'S'] }, then: 'pop', confidence: 'high' as const },
        { when: { deepRange: true }, then: 'pop', confidence: 'medium' as const },
        { when: { ath: 5, phys: [1, 2, 3] }, then: 'slip', confidence: 'medium' as const }
      ]
    },
    selfCreation: {
      conditions: [
        { when: { usage: 'primary', isoFreq: ['P', 'S'] }, then: 'high', confidence: 'high' as const },
        { when: { usage: 'primary', pnrFreq: 'P' }, then: 'high', confidence: 'high' as const },
        { when: { usage: 'secondary', isoFreq: 'S' }, then: 'medium', confidence: 'medium' as const },
        { when: { usage: 'role' }, then: 'low', confidence: 'high' as const },
        { when: { isoFreq: 'N', pnrFreq: 'N' }, then: 'low', confidence: 'high' as const }
      ]
    },
    popRange: {
      conditions: [
        { when: { deepRange: true, spotUpFreq: ['P', 'S'] }, then: 'three', confidence: 'high' as const },
        { when: { deepRange: true }, then: 'three', confidence: 'medium' as const },
        { when: { deepRange: false }, then: 'midrange', confidence: 'medium' as const }
      ]
    },
    trapResponse: {
      conditions: [
        { when: { vision: 5, pnrFreq: 'P', ath: [4, 5] }, then: 'escape', confidence: 'high' as const },
        { when: { vision: [4, 5], pnrFreq: ['P', 'S'] }, then: 'pass', confidence: 'medium' as const },
        { when: { vision: [1, 2], pnrFreq: ['P', 'S'] }, then: 'struggle', confidence: 'medium' as const }
      ]
    },
    // v2.1 - New inferences
    ballHandling: {
      conditions: [
        { when: { usage: 'primary', pnrFreq: 'P', pos: ['PG'] }, then: 'elite', confidence: 'high' as const },
        { when: { usage: 'primary', isoFreq: 'P' }, then: 'elite', confidence: 'medium' as const },
        { when: { usage: 'secondary', pos: ['SG', 'SF'] }, then: 'capable', confidence: 'medium' as const },
        { when: { usage: 'role', pos: ['PF', 'C'] }, then: 'limited', confidence: 'high' as const },
        { when: { selfCreation: 'low', pos: ['PF', 'C'] }, then: 'limited', confidence: 'high' as const }
      ]
    },
    pressureResponse: {
      conditions: [
        { when: { vision: 5, ballHandling: 'elite' }, then: 'breaks', confidence: 'high' as const },
        { when: { vision: [4, 5], ballHandling: 'capable' }, then: 'escapes', confidence: 'medium' as const },
        { when: { vision: [1, 2], ballHandling: ['limited', 'liability'] }, then: 'struggles', confidence: 'high' as const },
        { when: { ballHandling: 'liability' }, then: 'struggles', confidence: 'high' as const }
      ]
    }
  }
} as const;

// ============================================================================
// OUTPUT CATALOG (i18n keys) - v2.1 EXPANDED
// ============================================================================

export const OUTPUT_CATALOG = {
  deny: {
    iso_space: { key: 'deny_iso_space', i18nKey: 'output.deny.iso_space', template: 'DENY ISO space - force help' },
    pnr_downhill: { key: 'deny_pnr_downhill', i18nKey: 'output.deny.pnr_downhill', template: 'DENY PnR downhill - hedge/trap' },
    pnr_roll: { key: 'deny_pnr_roll', i18nKey: 'output.deny.pnr_roll', template: 'DENY roll - stay attached to screener' },
    pnr_pop: { key: 'deny_pnr_pop', i18nKey: 'output.deny.pnr_pop', template: 'DENY pop - contest the three' },
    pnr_slip: { key: 'deny_pnr_slip', i18nKey: 'output.deny.pnr_slip', template: 'DENY slip - stay alert to early cut' },
    post_entry: { key: 'deny_post_entry', i18nKey: 'output.deny.post_entry', template: 'DENY post entry - front the post' },
    post_shoulder: { key: 'deny_post_shoulder', i18nKey: 'output.deny.post_shoulder', template: 'DENY {shoulder} shoulder - force opposite' },
    trans_run: { key: 'deny_trans_run', i18nKey: 'output.deny.trans_run', template: 'DENY transition - sprint back' },
    spot_deep: { key: 'deny_spot_deep', i18nKey: 'output.deny.spot_deep', template: 'DENY deep threes - extend defense' },
    spot_corner: { key: 'deny_spot_corner', i18nKey: 'output.deny.spot_corner', template: 'DENY corner three - tight closeout' },
    dho: { key: 'deny_dho', i18nKey: 'output.deny.dho', template: 'DENY DHO action - jump the handoff' },
    cut_basket: { key: 'deny_cut_basket', i18nKey: 'output.deny.cut_basket', template: 'DENY basket cut - stay ball side' },
    cut_backdoor: { key: 'deny_cut_backdoor', i18nKey: 'output.deny.cut_backdoor', template: 'DENY backdoor cut - stay ball side' },
    cut_flash: { key: 'deny_cut_flash', i18nKey: 'output.deny.cut_flash', template: 'DENY flash cut - prevent high post entry' },
    cut_curl: { key: 'deny_cut_curl', i18nKey: 'output.deny.cut_curl', template: 'DENY curl - chase over screen' },
    oreb: { key: 'deny_oreb', i18nKey: 'output.deny.oreb', template: 'DENY offensive boards - box out first' },
    floater: { key: 'deny_floater', i18nKey: 'output.deny.floater', template: 'DENY floater zone - contest high' },
    // v2.1 - NEW DENY outputs
    trans_rim: { key: 'deny_trans_rim', i18nKey: 'output.deny.trans_rim', template: 'DENY rim run - sprint back, no basket' },
    trans_trail: { key: 'deny_trans_trail', i18nKey: 'output.deny.trans_trail', template: 'DENY trail three - find shooter early' },
    duck_in: { key: 'deny_duck_in', i18nKey: 'output.deny.duck_in', template: 'DENY duck-in - prevent deep seal' },
    post_seal: { key: 'deny_post_seal', i18nKey: 'output.deny.post_seal', template: 'DENY post seal - fight for position' },
    ball_advance: { key: 'deny_ball_advance', i18nKey: 'output.deny.ball_advance', template: 'DENY ball advance - pressure full court' },
    trans_seal: { key: 'deny_trans_seal', i18nKey: 'output.deny.trans_seal', template: 'DENY transition seal catch — front the roller early' },
    trans_runner_corner: { key: 'deny_trans_runner_corner', i18nKey: 'output.deny.trans_runner_corner', template: 'DENY runner corner three — locate shooter in transition' },
    high_post_catch: { key: 'deny_high_post_catch', i18nKey: 'output.deny.high_post_catch', template: 'DENY high post/elbow catches — crowd the elbow' },
    screen_pop: { key: 'deny_screen_pop', i18nKey: 'output.deny.screen_pop', template: 'DENY off-ball screen pop — contest jumper' },
    screen_slip: { key: 'deny_screen_slip', i18nKey: 'output.deny.screen_slip', template: 'DENY slip off off-ball screen — stay with cutter' },
    off_ball_curl: { key: 'deny_off_ball_curl', i18nKey: 'output.deny.off_ball_curl', template: 'DENY curl off screen — chase or switch tight' },
  },
  force: {
    direction: { key: 'force_direction', i18nKey: 'output.force.direction', template: 'FORCE {direction} - away from comfort' },
    weak_hand: { key: 'force_weak_hand', i18nKey: 'output.force.weak_hand', template: 'FORCE to weak hand ({hand})' },
    perimeter: { key: 'force_perimeter', i18nKey: 'output.force.perimeter', template: 'FORCE to perimeter - no paint touches' },
    contact: { key: 'force_contact', i18nKey: 'output.force.contact', template: 'FORCE into contact - be physical' },
    early: { key: 'force_early', i18nKey: 'output.force.early', template: 'FORCE early shot clock looks' },
    trap: { key: 'force_trap', i18nKey: 'output.force.trap', template: 'FORCE into traps - hedge hard on PnR' },
    // v2.1 - NEW FORCE outputs
    full_court: { key: 'force_full_court', i18nKey: 'output.force.full_court', template: 'FORCE full court pressure - attack the ball' },
    no_ball: { key: 'force_no_ball', i18nKey: 'output.force.no_ball', template: 'FORCE off ball - deny advance' },
    no_push: { key: 'force_no_push', i18nKey: 'output.force.no_push', template: 'FORCE no dribble push — contain the advance' },
    no_space: { key: 'force_no_space', i18nKey: 'output.force.no_space', template: 'FORCE no space — no dar distancia de tiro' },
    paint_deny: { key: 'force_paint_deny', i18nKey: 'output.force.paint_deny', template: 'FORCE out of paint — mantener fuera de la pintura' }
  },
  allow: {
    post: { key: 'allow_post', i18nKey: 'output.allow.post', template: 'Allow post attempts - no threat' },
    spot_three: { key: 'allow_spot_three', i18nKey: 'output.allow.spot_three', template: 'Allow spot-up threes - help off' },
    iso: { key: 'allow_iso', i18nKey: 'output.allow.iso', template: 'Allow isolation - low efficiency' },
    // v2.1 - NEW ALLOW output
    ball_handling: { key: 'allow_ball_handling', i18nKey: 'output.allow.ball_handling', template: 'Allow ball handling - limited threat with ball' },
    distance: { key: 'allow_distance', i18nKey: 'output.allow.distance', template: 'Allow distance — dar espacio, no amenaza de tiro' }
  },
  aware: {
    passer: { key: 'aware_passer', i18nKey: 'output.aware.passer', template: 'Elite passer - don\'t gamble' },
    trap: { key: 'aware_trap', i18nKey: 'output.aware.trap', template: 'Handles traps well - rotate quickly' },
    physical: { key: 'aware_physical', i18nKey: 'output.aware.physical', template: 'Physical finisher - expect contact' },
    deep: { key: 'aware_deep', i18nKey: 'output.aware.deep', template: 'Deep range threat - guard to half court' },
    hands: { key: 'aware_hands', i18nKey: 'output.aware.hands', template: 'Finishes with both hands' },
    oreb: { key: 'aware_oreb', i18nKey: 'output.aware.oreb', template: 'Elite rebounder - box out every shot' },
    connector: { key: 'aware_connector', i18nKey: 'output.aware.connector', template: 'Connector role - reads defense' },
    // v2.1 - NEW AWARE outputs
    trans_leak: { key: 'aware_trans_leak', i18nKey: 'output.aware.trans_leak', template: 'Leaks early in transition - watch for early escape' },
    post_efficient: { key: 'aware_post_efficient', i18nKey: 'output.aware.post_efficient', template: 'Lethal when posting - rarely but deadly' },
    post_fade: { key: 'aware_post_fade', i18nKey: 'output.aware.post_fade', template: 'Dangerous fadeaway - contest without fouling' },
    post_turnaround: { key: 'aware_post_turnaround', i18nKey: 'output.aware.post_turnaround', template: 'Effective turnaround - stay disciplined' },
    post_hook: { key: 'aware_post_hook', i18nKey: 'output.aware.post_hook', template: 'Hook shot threat - contest but expect arc' },
    pressure_vuln: { key: 'aware_pressure_vuln', i18nKey: 'output.aware.pressure_vuln', template: 'Vulnerable under pressure - attack aggressively' },
    pnr_direction: { key: 'aware_pnr_direction', i18nKey: 'output.aware.pnr_direction', template: 'PnR finish differs by ball-hand side — left: {left}; right: {right}' },
    trans_trail_shoot: { key: 'aware_trans_trail_shoot', i18nKey: 'output.aware.trans_trail_shoot', template: 'Trail shooter off drag — find her late' },
    trans_early_drag: { key: 'aware_trans_early_drag', i18nKey: 'output.aware.trans_early_drag', template: 'Early drag in transition — expect quick PnR' },
    screen_short_roll: { key: 'aware_screen_short_roll', i18nKey: 'output.aware.screen_short_roll', template: 'Short roll threat off screens — help early' },
    off_ball_flare: { key: 'aware_off_ball_flare', i18nKey: 'output.aware.off_ball_flare', template: 'Flare shooter off screens — go under or switch' },
    high_post_face_up: { key: 'aware_high_post_face_up', i18nKey: 'output.aware.high_post_face_up', template: 'Face-up drive from elbow — gap stance' },
    high_post_passer: { key: 'aware_high_post_passer', i18nKey: 'output.aware.high_post_passer', template: 'High post passer — deny cutters' },
    high_post_stepback: { key: 'aware_high_post_stepback', i18nKey: 'output.aware.high_post_stepback', template: 'Step-back range from elbow — contest length' },
    high_post_versatile: { key: 'aware_high_post_versatile', i18nKey: 'output.aware.high_post_versatile', template: 'Versatile: low post + high post game — scout both' },
    iso_strong_hand_finish: {
      key: 'aware_iso_strong_hand_finish',
      i18nKey: 'output.aware.iso_strong_hand_finish',
      template: 'With dominant hand: prefers {finish}.',
    },
    iso_weak_hand_finish: {
      key: 'aware_iso_weak_hand_finish',
      i18nKey: 'output.aware.iso_weak_hand_finish',
      template: 'When forced to weak hand: prefers {finish}.',
    },
    trans_rim_run_graded: {
      key: 'aware_trans_rim_run_graded',
      i18nKey: 'output.aware.trans_rim_run_graded',
      template: 'Rim run is {freq} in transition.',
    },
    trans_trail_graded: {
      key: 'aware_trans_trail_graded',
      i18nKey: 'output.aware.trans_trail_graded',
      template: 'Trail is {freq} in transition.',
    },
    off_ball_screen_graded: {
      key: 'aware_off_ball_screen_graded',
      i18nKey: 'output.aware.off_ball_screen_graded',
      template: '{action} after screen is {freq}.',
    },
    off_ball_role: {
      key: 'aware_off_ball_role',
      i18nKey: 'output.aware.off_ball_role',
      template: 'Off-ball role tendency: {role}.',
    },
    screen_hold: { key: 'aware_screen_hold', i18nKey: 'output.aware.screen_hold', template: 'Pantalla aguantada — comunicar antes del bloqueo' },
    selfish_pattern: { key: 'aware_selfish_pattern', i18nKey: 'output.aware.selfish_pattern', template: 'Jugador egoísta — busca su opción siempre, no especular' },
  }
};

// ============================================================================
// MOTOR CLASS
// ============================================================================

export class UScoutMotor {
  private weights = WEIGHTS;
  private inferences = INFERENCE_RULES;
  private outputCatalog = OUTPUT_CATALOG;

  /**
   * Main entry point - generates full report from inputs
   */
  generateReport(inputs: PlayerInputs, clubContext?: ClubContext): MotorReport {
    // Step 1: Apply inferences for missing fields
    const enrichedInputs = this.applyInferences(inputs);

    // Step 2: Calculate raw output weights
    const calculatedOutputs = this.calculateOutputs(enrichedInputs);
    const rawOutputs = this.applyClubContextModifiers(
      calculatedOutputs,
      enrichedInputs,
      clubContext,
    );

    // Step 3: Categorize and rank outputs
    const categorized = this.categorizeOutputs(rawOutputs);

    // Step 4: Select top outputs per category (threat-ranked)
    const threatScores = this.calculateThreatScores(rawOutputs, enrichedInputs);
    const picked = this.selectTopOutputs(categorized, threatScores);

    // Step 5: Generate slides
    const slides = this.generateSlides(enrichedInputs, {
      deny: picked.deny,
      force: picked.force,
      allow: picked.allow,
      aware: picked.aware,
    });

    return {
      inputs: enrichedInputs,
      rawOutputs,
      categorized,
      selected: {
        deny: picked.deny,
        force: picked.force,
        allow: picked.allow,
        aware: picked.aware,
      },
      slides,
      threatScores,
      runnersUp: picked.runnersUp ?? [],
    };
  }

  private applyClubContextModifiers(
    outputs: MotorOutput[],
    inputs: EnrichedInputs,
    ctx?: ClubContext,
  ): MotorOutput[] {
    if (!ctx) return outputs;
    const result = outputs.map((o) => ({ ...o }));

    const league = ctx.leagueType;
    const gender = ctx.gender;

    const isoOut = result.find((o) => o.key === 'deny_iso_space');
    const pnrOut = result.find((o) => o.key === 'deny_pnr_downhill');
    if (isoOut && pnrOut && Math.abs(isoOut.weight - pnrOut.weight) <= 0.05) {
      const nbaStyle = league === 'nba';
      if (nbaStyle) {
        isoOut.weight = Math.min(isoOut.weight + 0.03, 1.0);
      } else {
        pnrOut.weight = Math.min(pnrOut.weight + 0.03, 1.0);
      }
    }

    if (gender === 'F') {
      const rollOut = result.find((o) => o.key === 'deny_pnr_roll');
      if (rollOut) rollOut.weight = Math.min(rollOut.weight * 1.15, 1.0);

      const noSpaceOut = result.find((o) => o.key === 'force_no_space');
      const dirOut = result.find((o) => o.key === 'force_direction');
      if (noSpaceOut && dirOut) {
        noSpaceOut.weight = Math.min(noSpaceOut.weight + 0.08, 1.0);
      }

      const isInterior = inputs.pos === 'PF' || inputs.pos === 'C';
      if (isInterior && !result.some((o) => o.key === 'aware_connector')) {
        result.push({
          key: 'aware_connector',
          category: 'aware',
          weight: 0.65,
          source: 'gender_f_interior',
        });
      }

      const dragIdx = result.findIndex((o) => o.key === 'aware_trans_early_drag');
      if (dragIdx >= 0) result.splice(dragIdx, 1);
    }

    if (league === 'ncaa_m') {
      const postEntry = result.find((o) => o.key === 'deny_post_entry');
      if (postEntry) postEntry.weight = Math.min(postEntry.weight * 1.1, 1.0);
      const contact = result.find((o) => o.key === 'force_contact');
      if (contact) contact.weight = Math.min(contact.weight * 1.1, 1.0);
    }

    if (league === 'wcba') {
      const postEntry = result.find((o) => o.key === 'deny_post_entry');
      if (postEntry) postEntry.weight = Math.min(postEntry.weight * 1.1, 1.0);
      const oreb = result.find((o) => o.key === 'deny_oreb');
      if (oreb) oreb.weight = Math.min(oreb.weight * 1.1, 1.0);
    }

    if (league === 'fiba_americas') {
      const contact = result.find((o) => o.key === 'force_contact');
      if (contact) contact.weight = Math.max(contact.weight - 0.15, 0);
    }

    if (league === 'amateur') {
      result.forEach((o) => {
        o.weight = o.weight * 0.9;
      });
    }

    return result;
  }

  private calculateThreatScores(outputs: MotorOutput[], inputs?: EnrichedInputs): SituationThreatScore[] {
    const situationMap = new Map<string, { maxWeight: number; topOutput: string }>();

    // When player has 2+ primary freq situations, cap secondary situations at 0.72
    const primarySituations = new Set<string>();
    if (inputs) {
      if (inputs.isoFreq   === 'P') primarySituations.add('iso');
      if (inputs.pnrFreq   === 'P') primarySituations.add('pnr');
      if (inputs.postFreq  === 'P') primarySituations.add('post');
      if (inputs.transFreq === 'P') primarySituations.add('transition');
      if (inputs.spotUpFreq === 'P') primarySituations.add('spot');
      if (inputs.dhoFreq   === 'P') primarySituations.add('dho');
      if (inputs.cutFreq   === 'P') primarySituations.add('cut');
    }
    const manyPrimaries = primarySituations.size >= 2;

    for (const output of outputs) {
      if (output.category !== 'deny') continue;
      if (output.weight === 0) continue;

      const situation = SOURCE_TO_SITUATION[output.source] ?? 'misc';
      let effectiveWeight = output.weight;
      if (manyPrimaries && !primarySituations.has(situation) && situation !== 'misc') {
        effectiveWeight = Math.min(effectiveWeight, 0.72);
      }
      const current = situationMap.get(situation);
      if (!current || effectiveWeight > current.maxWeight) {
        situationMap.set(situation, { maxWeight: effectiveWeight, topOutput: output.key });
      }
    }

    return Array.from(situationMap.entries())
      .map(([situation, { maxWeight, topOutput }]) => ({
        situation,
        score: maxWeight,
        topOutput,
      }))
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Apply inference rules to fill in missing inputs
   */
  private applyInferences(inputs: PlayerInputs): EnrichedInputs {
    const enriched = { ...inputs } as EnrichedInputs;
    const inferred: Record<string, InferredField> = {};
    
    for (const field of this.inferences.executionOrder) {
      const currentValue = (enriched as unknown as Record<string, unknown>)[field];
      if (currentValue !== null && currentValue !== undefined) continue;
      if (this.inferences.neverInfer.includes(field as typeof this.inferences.neverInfer[number])) continue;
      
      const rules = this.inferences.inferences[field as keyof typeof this.inferences.inferences];
      if (!rules) continue;
      
      for (const condition of rules.conditions) {
        if (this.matchesCondition(enriched, condition.when)) {
          (enriched as unknown as Record<string, unknown>)[field] = condition.then;
          inferred[field] = {
            value: condition.then,
            confidence: condition.confidence
          };
          break;
        }
      }
    }
    
    enriched._inferred = inferred;
    return enriched;
  }

  /**
   * Check if inputs match a condition
   */
  private matchesCondition(inputs: EnrichedInputs, condition: Record<string, unknown>): boolean {
    for (const [key, expected] of Object.entries(condition)) {
      const actual = (inputs as unknown as Record<string, unknown>)[key];
      if (actual === null || actual === undefined) return false;
      
      if (Array.isArray(expected)) {
        if (!expected.includes(actual)) return false;
      } else if (expected !== actual) {
        return false;
      }
    }
    return true;
  }

  /**
   * Calculate all possible output weights - v2.1 EXPANDED
   */
  private calculateOutputs(inputs: EnrichedInputs): MotorOutput[] {
    const outputs: MotorOutput[] = [];
    const w = this.weights;
    const freqW = w.frequencyToWeight;
    const effM = w.efficiencyMultiplier;
    const usageM = w.usageMultiplier[inputs.usage] || 1.0;
    const personalityMod = inputs.personality?.includes('clutch')
      ? 1.1
      : inputs.personality?.includes('freezes')
        ? 0.85
        : 1.0;
    const starMod = inputs.starPlayer ? 1.05 : 1.0;
    const globalMod = personalityMod * starMod;
    const effectiveUsageM = usageM * globalMod;

    // =========================================================================
    // ISO outputs
    // =========================================================================
    if (inputs.isoFreq && inputs.isoFreq !== 'N') {
      const baseWeight = freqW[inputs.isoFreq] * w.outputWeights.iso.baseWeight;
      let weight = baseWeight * effectiveUsageM;

      if (inputs.isoEff) weight *= effM[inputs.isoEff];

      outputs.push({
        key: 'deny_iso_space',
        category: 'deny',
        weight: Math.min(weight, 1.0),
        source: 'iso'
      });

      if (inputs.isoDir) {
        const handWeakDir = inputs.hand === 'R' ? 'L' : 'R';
        const offHandWeak = inputs.offHandFinish === 'weak';
        const allAgree =
          inputs.isoDir !== 'B' && (inputs.isoDir === handWeakDir || offHandWeak);
        const contradiction =
          inputs.isoDir !== 'B' && inputs.isoDir !== handWeakDir && !offHandWeak;
        if (allAgree) {
          const dirParams: Record<string, string> = {
            direction: inputs.isoDir === handWeakDir ? inputs.isoDir : handWeakDir,
          };
          if (inputs.isoStartZone) dirParams.zone = inputs.isoStartZone;
          outputs.push({
            key: 'force_direction',
            category: 'force',
            weight: Math.min(weight * 0.9 + 0.1, 1.0),
            params: dirParams,
            source: 'iso_dir_confirmed',
          });
        } else if (!contradiction) {
          const weakDir = inputs.isoDir === 'L' ? 'R' : inputs.isoDir === 'R' ? 'L' : null;
          if (weakDir) {
            const dirParams: Record<string, string> = { direction: weakDir };
            if (inputs.isoStartZone) dirParams.zone = inputs.isoStartZone;
            outputs.push({
              key: 'force_direction',
              category: 'force',
              weight: Math.min(weight * 0.9, 1.0),
              params: dirParams,
              source: 'iso_dir',
            });
          }
        }
      }

      if (inputs.isoStrongHandFinish) {
        outputs.push({
          key: 'aware_iso_strong_hand_finish',
          category: 'aware',
          weight: Math.min(freqW[inputs.isoFreq] * 0.65, 1.0),
          source: 'iso_strong_hand_finish',
          params: { finish: inputs.isoStrongHandFinish },
        });
      }
      if (inputs.isoWeakHandFinish) {
        outputs.push({
          key: 'aware_iso_weak_hand_finish',
          category: 'aware',
          weight: Math.min(freqW[inputs.isoFreq] * 0.6, 1.0),
          source: 'iso_weak_hand_finish',
          params: { finish: inputs.isoWeakHandFinish },
        });
      }
    }

    if (inputs.personality?.includes('selfish')) {
      if (inputs.isoEff === 'low' || inputs.isoEff === 'medium') {
        const idxDeny = outputs.findIndex((o) => o.key === 'deny_iso_space');
        if (idxDeny >= 0) outputs[idxDeny].weight = Math.max(outputs[idxDeny].weight - 0.15, 0);
        if (!outputs.some((o) => o.key === 'allow_iso')) {
          outputs.push({ key: 'allow_iso', category: 'allow', weight: 0.85, source: 'selfish_exploitable' });
        }
      }
      outputs.push({
        key: 'aware_selfish_pattern',
        category: 'aware',
        weight: 0.7,
        source: 'selfish',
      });
    }

    // =========================================================================
    // PnR Handler outputs
    // =========================================================================
    if (inputs.pnrFreq && inputs.pnrFreq !== 'N') {
      let weight = freqW[inputs.pnrFreq] * w.outputWeights.pnr.baseWeight * effectiveUsageM;
      
      if (inputs.pnrPri) {
        weight += w.outputWeights.pnr.priorityBonus[inputs.pnrPri] || 0;
      }
      if (inputs.pnrEff) {
        weight *= effM[inputs.pnrEff];
      }
      
      outputs.push({
        key: 'deny_pnr_downhill',
        category: 'deny',
        weight: Math.min(weight, 1.0),
        source: 'pnr'
      });

      if (inputs.pnrFinishLeft && inputs.pnrFinishRight) {
        const leftEff = inputs.pnrEffLeft ?? null;
        const rightEff = inputs.pnrEffRight ?? null;
        const meaningfulDiff =
          inputs.pnrFinishLeft !== inputs.pnrFinishRight ||
          (leftEff && rightEff && leftEff !== rightEff);
        if (meaningfulDiff) {
          outputs.push({
            key: 'aware_pnr_direction',
            category: 'aware',
            weight: 0.72,
            source: 'pnr_finish_asymmetry',
            params: { left: inputs.pnrFinishLeft, right: inputs.pnrFinishRight },
          });
        }
        // force_direction from PnR finish asymmetry:
        // If one side is clearly more dangerous, force toward the weaker side.
        // Danger ranking: Drive to Rim > Pull-up > Floater > Mid-range
        const finishDanger: Record<string, number> = {
          'Drive to Rim': 4, 'Pull-up': 3, 'Floater': 2, 'Mid-range': 1,
        };
        const dangerL = finishDanger[inputs.pnrFinishLeft ?? ''] ?? 0;
        const dangerR = finishDanger[inputs.pnrFinishRight ?? ''] ?? 0;
        const dangerDiff = Math.abs(dangerL - dangerR);
        if (dangerDiff >= 1) {
          // Force toward the less dangerous side
          // hand R: right=strong side (R=right hand dominant), left=L=weak
          // hand L: left=strong, right=weak
          const strongSide = inputs.hand === 'R' ? 'R' : 'L';
          const weakSide = inputs.hand === 'R' ? 'L' : 'R';
          const strongDanger = strongSide === 'R' ? dangerR : dangerL;
          const weakDanger = weakSide === 'R' ? dangerR : dangerL;
          // Only emit if strong side is indeed more dangerous (confirms scouted asymmetry)
          if (strongDanger > weakDanger) {
            const forceDir = weakSide; // Force toward the weaker finishing side
            outputs.push({
              key: 'force_direction',
              category: 'force',
              weight: Math.min(weight * 0.88, 0.92),
              params: { direction: forceDir },
              source: 'pnr_finish_asymmetry',
            });
          }
        }
      }

      // force_no_mid: when PnR handler prefers mid-range finishes on both sides
      // AND is a shooter (deepRange + spotUpFreq), the tactical instruction is:
      // deny the mid-range catch — force penetration to weak side instead.
      // This captures: shooter who uses PnR to create mid-range pull-ups (not rim attacks).
      const finishDangerCheck: Record<string, number> = {
        'Drive to Rim': 4, 'Pull-up': 3, 'Floater': 2, 'Mid-range': 1,
      };
      const leftDanger = finishDangerCheck[inputs.pnrFinishLeft ?? ''] ?? 0;
      const rightDanger = finishDangerCheck[inputs.pnrFinishRight ?? ''] ?? 0;
      const bothMidOrLower = leftDanger > 0 && rightDanger > 0 &&
        leftDanger <= 3 && rightDanger <= 3 && Math.abs(leftDanger - rightDanger) <= 1;
      const isShooter = inputs.deepRange && inputs.spotUpFreq != null && inputs.spotUpFreq !== 'N';
      if (bothMidOrLower && isShooter) {
        // Force toward weak hand — for R-handed players, force left
        const weakSide = inputs.hand === 'R' ? 'L' : 'R';
        outputs.push({
          key: 'force_direction',
          category: 'force',
          weight: Math.min(weight * 1.05, 1.10),  // must beat force_trap in 1-on-1 context
          params: { direction: weakSide, context: 'no_mid_range' },
          source: 'pnr_shooter_weak_side',
        });
      }

      // pnrSnake: if the handler reverses direction off the screen (snake dribble),
      // the side-based force_direction is less reliable — they can escape to either side.
      if (inputs.pnrSnake) {
        const dirIdx = outputs.findIndex(o => o.key === 'force_direction' &&
          (o.source === 'pnr_finish_asymmetry' || o.source === 'pnr_shooter_weak_side'));
        if (dirIdx >= 0) {
          // Reduce weight — snake partially neutralizes directional forcing
          outputs[dirIdx].weight = Math.max(outputs[dirIdx].weight * 0.70, 0.5);
          outputs[dirIdx].params = { ...(outputs[dirIdx].params ?? {}), note: 'snake_reduces_certainty' };
        }
        outputs.push({
          key: 'aware_screen_hold',  // closest existing aware for screen complexity
          category: 'aware',
          weight: 0.68,
          source: 'screen_timing',
          params: { note: 'snake_dribble_possible' },
        });
      }

      if (inputs.trapResponse === 'struggle') {
        // force_trap is a team action — in 1-on-1 context, reduce weight if player is
        // primarily a shooter (the defender's job is individual positioning, not trap coordination)
        const shooterContext = inputs.deepRange && inputs.spotUpFreq != null && inputs.spotUpFreq !== 'N';
        // For shooters: reduce trap weight — 1-on-1 directional instruction is more relevant than team trap
        // For non-shooters (drivers like Giannis): keep full weight, trap is the right call
        const trapWeight = shooterContext ? Math.min(weight * 0.60, 0.72) : weight * 0.85;
        outputs.push({
          key: 'force_trap',
          category: 'force',
          weight: trapWeight,
          source: 'trap_response',
        });
      } else if (inputs.trapResponse === 'escape' && inputs.pnrPri === 'PF') {
        const passerIdx = outputs.findIndex((o) => o.key === 'aware_passer');
        if (passerIdx >= 0) {
          outputs[passerIdx].weight = Math.min(outputs[passerIdx].weight + 0.15, 1.0);
        } else {
          outputs.push({
            key: 'aware_passer',
            category: 'aware',
            weight: 0.9,
            source: 'escape_pass_first',
          });
        }
      }
    }
    
    // =========================================================================
    // Screener outputs
    // =========================================================================
    if (inputs.screenerAction) {
      const action = inputs.screenerAction;
      if (action === 'roll') {
        outputs.push({
          key: 'deny_pnr_roll',
          category: 'deny',
          weight: w.outputWeights.screener.rollWeight * w.physMultiplier[inputs.phys],
          source: 'screener_roll'
        });
      } else if (action === 'pop') {
        let popWeight = w.outputWeights.screener.popWeight;
        if (inputs.deepRange) {
          popWeight += 0.2;
          outputs.push({
            key: 'deny_pnr_pop',
            category: 'deny',
            weight: Math.min(popWeight, 1.0),
            source: 'screener_pop',
          });
        } else {
          outputs.push({
            key: 'deny_pnr_pop',
            category: 'deny',
            weight: 0.45,
            source: 'screener_pop_no_range',
          });
          outputs.push({
            key: 'aware_screen_short_roll',
            category: 'aware',
            weight: 0.55,
            source: 'screener_pop_no_range',
          });
        }
      } else if (action === 'slip') {
        const slipWeight =
          inputs.pnrScreenTiming === 'ghost_touch' ? 0.9 : w.outputWeights.screener.slipWeight;
        outputs.push({
          key: 'deny_pnr_slip',
          category: 'deny',
          weight: slipWeight,
          source: 'screener_slip',
        });
      }
    }

    if (inputs.screenerAction === 'roll' && inputs.pnrScreenTiming === 'slip') {
      outputs.push({
        key: 'aware_passer',
        category: 'aware',
        weight: 0,
        source: 'data_inconsistency',
        params: { note: 'screener_action_timing_mismatch' },
      });
    }

    if (inputs.pnrScreenTiming === 'holds_long') {
      outputs.push({
        key: 'aware_screen_hold',
        category: 'aware',
        weight: 0.65,
        source: 'screen_timing',
      });
    }

    // =========================================================================
    // Post outputs - v2.1 ENHANCED with postEff and postMoves
    // =========================================================================
    if (inputs.postFreq && inputs.postFreq !== 'N') {
      let weight = freqW[inputs.postFreq] * w.outputWeights.post.baseWeight * effectiveUsageM;
      
      if (inputs.postProfile) {
        weight += w.outputWeights.post.profileBonus[inputs.postProfile] || 0;
      }
      
      // v2.1: Adjust weight based on efficiency
      // High efficiency on rare frequency = still important to be aware
      const effMultiplier = inputs.postEff ? effM[inputs.postEff] : 1.0;
      
      // Only deny entry if both frequency AND efficiency warrant it
      // Low freq + high eff = aware, not deny
      if (inputs.postFreq === 'P' || inputs.postFreq === 'S' || 
          (inputs.postFreq === 'R' && inputs.postEff !== 'high')) {
        outputs.push({
          key: 'deny_post_entry',
          category: 'deny',
          weight: Math.min(weight * w.physMultiplier[inputs.phys] * effMultiplier, 1.0),
          source: 'post'
        });
      }
      
      if (inputs.postShoulder) {
        outputs.push({
          key: 'deny_post_shoulder',
          category: 'deny',
          weight: weight * 0.8,
          params: { shoulder: inputs.postShoulder },
          source: 'post_shoulder'
        });
      }
      
      // v2.1: Post entry type outputs
      if (inputs.postEntry === 'duck_in') {
        outputs.push({
          key: 'deny_duck_in',
          category: 'deny',
          weight: w.outputWeights.postEntry.duck_in * w.physMultiplier[inputs.phys],
          source: 'post_entry_duck_in'
        });
      } else if (inputs.postEntry === 'seal') {
        outputs.push({
          key: 'deny_post_seal',
          category: 'deny',
          weight: w.outputWeights.postEntry.seal * w.physMultiplier[inputs.phys],
          source: 'post_entry_seal'
        });
      }
      
      // v2.1: Aware of high efficiency on low frequency
      if (inputs.postFreq === 'R' && inputs.postEff === 'high') {
        outputs.push({
          key: 'aware_post_efficient',
          category: 'aware',
          weight: 0.85,
          source: 'post_rare_efficient'
        });
      }
      
      // v2.1: Post move awareness
      if (inputs.postMoves && inputs.postMoves.length > 0) {
        for (const move of inputs.postMoves) {
          const moveWeight = w.outputWeights.postMoves[move] || 0.6;
          if (move === 'fade') {
            outputs.push({
              key: 'aware_post_fade',
              category: 'aware',
              weight: moveWeight,
              source: 'post_move_fade',
              params: inputs.postShoulder ? { shoulder: inputs.postShoulder } : undefined,
            });
          } else if (move === 'turnaround') {
            outputs.push({
              key: 'aware_post_turnaround',
              category: 'aware',
              weight: moveWeight,
              source: 'post_move_turnaround'
            });
          } else if (move === 'hook') {
            outputs.push({
              key: 'aware_post_hook',
              category: 'aware',
              weight: moveWeight,
              source: 'post_move_hook'
            });
          }
        }
        if (inputs.postMoves?.includes('hook') && inputs.postMoves?.includes('up_and_under')) {
          const hookIdx = outputs.findIndex(
            (o) => o.key === 'aware_post_hook' && o.source === 'post_move_hook',
          );
          if (hookIdx >= 0) {
            outputs[hookIdx].weight = 0.85;
            outputs[hookIdx].params = { combo: 'hook_up_under' };
            outputs[hookIdx].source = 'post_combo_hook_upunder';
          }
        }
      }
    } else if (!inputs.postFreq || inputs.postFreq === 'N') {
      // allow_post only when the player has some interior presence but doesn't post up —
      // skip entirely for guards with no interior game (it's obvious noise)
      const hasInteriorPresence = inputs.pos === 'PF' || inputs.pos === 'C' ||
        inputs.phys >= 4 || inputs.orebThreat === 'high' || inputs.orebThreat === 'medium';
      if (hasInteriorPresence && inputs.usage !== 'primary') {
        outputs.push({
          key: 'allow_post',
          category: 'allow',
          weight: w.allowRules.postUp.neverWeight,
          source: 'no_post'
        });
      }
    }

    // Dunker spot (half-court positioning) — additive with post entry / rare-efficient aware
    if (inputs.dunkerSpot === 2) {
      if (!outputs.some((o) => o.key === 'deny_duck_in')) {
        outputs.push({
          key: 'deny_duck_in',
          category: 'deny',
          weight: 0.85,
          source: 'dunker_spot',
        });
      }
    } else if (inputs.dunkerSpot === 1) {
      if (!outputs.some((o) => o.key === 'aware_post_efficient')) {
        outputs.push({
          key: 'aware_post_efficient',
          category: 'aware',
          weight: 0.55,
          source: 'dunker_spot',
        });
      }
    }

    // =========================================================================
    // High post / elbow zones
    // =========================================================================
    const hz = inputs.highPostZones;
    if (hz) {
      const vals = [hz.leftElbow, hz.rightElbow].filter(
        (v): v is HighPostAction => v != null && v !== undefined,
      );
      if (vals.length > 0) {
        let catchW = 0.8;
        if (inputs.postProfile === 'FU' || inputs.postProfile === 'M') catchW += 0.1;
        const isElbowISO = inputs.postProfile === 'FU' && inputs.isoFreq === 'S';
        outputs.push({
          key: 'deny_high_post_catch',
          category: 'deny',
          weight: Math.min(catchW, 1.0),
          source: 'high_post',
          params: isElbowISO ? { stance: 'gap' } : undefined,
        });
        if (inputs.postProfile === 'B2B' && vals.length > 0) {
          const postEntryIdx = outputs.findIndex((o) => o.key === 'deny_post_entry');
          if (postEntryIdx >= 0) {
            outputs[postEntryIdx].weight = Math.min(outputs[postEntryIdx].weight + 0.1, 1.0);
            outputs[postEntryIdx].params = {
              ...(outputs[postEntryIdx].params ?? {}),
              note: 'two_initiation_zones',
            };
          }
        }
        if (vals.some((z) => z === 'face_up_drive')) {
          outputs.push({
            key: 'aware_high_post_face_up',
            category: 'aware',
            weight: 0.75,
            source: 'high_post',
          });
        }
        if (vals.some((z) => z === 'pass_to_cutter')) {
          outputs.push({
            key: 'aware_high_post_passer',
            category: 'aware',
            weight: 0.7,
            source: 'high_post',
          });
        }
        if (vals.some((z) => z === 'step_back')) {
          outputs.push({
            key: 'aware_high_post_stepback',
            category: 'aware',
            weight: 0.65,
            source: 'high_post',
          });
        }
        if (inputs.postProfile === 'B2B') {
          outputs.push({
            key: 'aware_high_post_versatile',
            category: 'aware',
            weight: 0.6,
            source: 'high_post',
          });
        }
      }
    }
    
    // =========================================================================
    // Transition outputs - v2.1 ENHANCED with transRole
    // =========================================================================
    if (inputs.transFreq && inputs.transFreq !== 'N') {
      let weight = freqW[inputs.transFreq] * w.outputWeights.transition.baseWeight;
      if (w.outputWeights.transition.athBonus) {
        weight *= w.athMultiplier[inputs.ath];
      }
      
      // v2.1: Role-specific transition outputs
      if (inputs.transRole) {
        const roleWeight = w.outputWeights.transRole[inputs.transRole];
        
        if (inputs.transRole === 'rim_run') {
          // rim_run is a role-defined situation — don't penalize with usageM
          outputs.push({
            key: 'deny_trans_rim',
            category: 'deny',
            weight: Math.min(weight * roleWeight, 1.0),
            source: 'trans_rim_run'
          });
        } else if (inputs.transRole === 'trail') {
          // Trail shooter - deny the trailing three
          if (inputs.deepRange) {
            // trail is a role-defined situation — don't penalize with usageM
            outputs.push({
              key: 'deny_trans_trail',
              category: 'deny',
              weight: Math.min(weight * roleWeight + 0.15, 1.0),
              source: 'trans_trail'
            });
          }
        } else if (inputs.transRole === 'leak') {
          outputs.push({
            key: 'aware_trans_leak',
            category: 'aware',
            weight: roleWeight,
            source: 'trans_leak'
          });
        }
        // 'fill' = low priority, no specific output
      } else {
        // Generic transition deny if no role specified
        outputs.push({
          key: 'deny_trans_run',
          category: 'deny',
          weight: Math.min(weight * effectiveUsageM, 1.0),
          source: 'transition'
        });
      }

      const applyTransSub = (sub: string | null | undefined, mult: number) => {
        if (!sub) return;
        if (sub === 'seal_catch') {
          outputs.push({
            key: 'deny_trans_seal',
            category: 'deny',
            weight: Math.min(0.85 * mult, 1.0),
            source: 'trans_sub',
          });
        } else if (sub === 'shoot_off_trail') {
          outputs.push({
            key: 'aware_trans_trail_shoot',
            category: 'aware',
            weight: Math.min(0.7 * mult, 1.0),
            source: 'trans_sub',
          });
        } else if (sub === 'early_drag') {
          outputs.push({
            key: 'aware_trans_early_drag',
            category: 'aware',
            weight: Math.min(0.75 * mult, 1.0),
            source: 'trans_sub',
          });
        } else if (sub === 'corner_3') {
          outputs.push({
            key: 'deny_trans_runner_corner',
            category: 'deny',
            weight: Math.min(0.8 * mult, 1.0),
            source: 'trans_sub',
          });
        } else if (sub === 'dribble_push') {
          const pushWeight = inputs.ballHandling === 'elite' ? 0.82 : 0.68;
          outputs.push({
            key: 'force_no_push',
            category: 'force',
            weight: Math.min(pushWeight * mult, 1.0),
            source: 'trans_sub',
          });
        } else if (sub === 'cut_to_rim' || sub === 'cut') {
          if (inputs.transFinishing === 'high') {
            outputs.push({
              key: 'deny_trans_rim',
              category: 'deny',
              weight: Math.min(0.85 * mult, 1.0),
              source: 'trans_cut_finishing',
              params: { finishing: 'contact_expected' },
            });
          }
        }
      };
      applyTransSub(inputs.transSubPrimary, 1);
      applyTransSub(inputs.transSubSecondary, 0.65);

      if (inputs.motorTransitionPrimary === 'rim_runner' && inputs.rimRunFrequency) {
        outputs.push({
          key: 'aware_trans_rim_run_graded',
          category: 'aware',
          weight: editorGradedFreqWeight(inputs.rimRunFrequency),
          source: 'transition_graded',
          params: { freq: inputs.rimRunFrequency },
        });
      }
      if (inputs.motorTransitionPrimary === 'trail' && inputs.trailFrequency) {
        outputs.push({
          key: 'aware_trans_trail_graded',
          category: 'aware',
          weight: editorGradedFreqWeight(inputs.trailFrequency),
          source: 'transition_graded',
          params: { freq: inputs.trailFrequency },
        });
      }

      if (inputs.transFinishing === 'not_observed') {
        outputs
          .filter((o) => {
            const s = o.source ?? '';
            return (
              s.startsWith('trans') ||
              s === 'transition' ||
              s === 'off_ball_roll_rim' ||
              s === 'duck_in_rim_runner_unified'
            );
          })
          .forEach((o) => {
            o.weight = o.weight * 0.85;
            o.params = { ...(o.params ?? {}), confidence: 'medium' };
          });
      }
    }

    if (inputs.postEntry === 'duck_in' && inputs.transRolePrimary === 'rim_runner') {
      const duckIdx = outputs.findIndex((o) => o.key === 'deny_duck_in');
      const rimIdx = outputs.findIndex((o) => o.key === 'deny_trans_rim');
      for (const idx of [duckIdx, rimIdx].filter((i) => i >= 0).sort((a, b) => b - a)) {
        outputs.splice(idx, 1);
      }
      outputs.push({
        key: 'deny_trans_rim',
        category: 'deny',
        weight: 0.9,
        // Source maps to 'transition' so threat score is calculated correctly
        source: 'trans_rim_run',
        params: { context: 'both_halfcourt_and_transition' },
      });
    }

    // =========================================================================
    // v2.1: Ball handling & pressure outputs
    // =========================================================================
    if (inputs.pressureResponse === 'struggles') {
      if (inputs.ballHandling !== 'elite') {
        // Athletic players who struggle with pressure are harder to trap — reduce weight
        // Low athleticism + struggles = very easy to pressure full court
        const athPenalty = inputs.ath >= 4 ? 0.15 : inputs.ath <= 2 ? 0 : 0.08;
        outputs.push({
          key: 'force_full_court',
          category: 'force',
          weight: Math.max(w.forceRules.fullCourt.baseWeight - athPenalty, 0.5),
          source: 'pressure_struggles',
        });
      }

      // Distinguish: trap context (trapResponse=struggle) vs individual pressure (pressureResponse=struggles)
      const trapCtx = inputs.trapResponse === 'struggle';
      const pressCtx = inputs.pressureResponse === 'struggles';
      outputs.push({
        key: 'aware_pressure_vuln',
        category: 'aware',
        weight: 0.8,
        source: 'pressure_struggles',
        params: {
          context: trapCtx && !pressCtx ? 'trap_only' : pressCtx && !trapCtx ? 'individual' : 'both',
        },
      });
    }
    
    if (inputs.ballHandling === 'liability') {
      outputs.push({
        key: 'force_no_ball',
        category: 'force',
        weight: w.forceRules.noBall.baseWeight,
        source: 'ball_handling_liability'
      });
    } else if (inputs.ballHandling === 'limited') {
      // Combined with pressure struggles = deny ball advance
      if (inputs.pressureResponse === 'struggles') {
        outputs.push({
          key: 'deny_ball_advance',
          category: 'deny',
          weight: 0.85,
          source: 'limited_handling_struggles'
        });
      }
      
      outputs.push({
        key: 'allow_ball_handling',
        category: 'allow',
        weight: w.allowRules.ballHandling.limitedWeight,
        source: 'ball_handling_limited'
      });
    }
    
    // =========================================================================
    // Spot-up outputs
    // =========================================================================
    if (inputs.spotUpFreq && inputs.spotUpFreq !== 'N') {
      const weight =
        freqW[inputs.spotUpFreq] * w.outputWeights.spotUp.baseWeight * effectiveUsageM;

      if (inputs.spotZone === 'corner') {
        if (inputs.deepRange) {
          outputs.push({
            key: 'deny_spot_corner',
            category: 'deny',
            weight: weight + w.outputWeights.spotUp.zoneBonus.corner,
            source: 'corner_spot',
          });
        } else {
          outputs.push({
            key: 'force_no_space',
            category: 'force',
            weight: 0.7,
            source: 'corner_no_range',
            params: { zone: 'corner' },
          });
        }
      }
    }
    
    // Deep range threat — only if player actually uses spot-up (not just has range)
    if (inputs.deepRange && inputs.spotUpFreq && inputs.spotUpFreq !== 'N') {
      const spotWeight = inputs.spotUpFreq === 'P' ? 0.95 : inputs.spotUpFreq === 'S' ? 0.80 : 0.60;
      outputs.push({
        key: 'deny_spot_deep',
        category: 'deny',
        weight: spotWeight,
        source: 'deep_range'
      });
    }
    
    // aware_instant_shot: shooter who fires immediately on closeout — no hesitation, no drive
    // This is the most actionable closeout instruction: arrive high and fast at the catch.
    if (
      inputs.deepRange &&
      inputs.spotUpFreq === 'P' &&
      inputs.spotUpAction === 'shoot'
    ) {
      outputs.push({
        key: 'aware_instant_shot',
        category: 'aware',
        weight: 0.75,
        source: 'deep_range',
      });
    }

    // ALLOW spot-up threes when poor shooter
    if (
      !inputs.deepRange &&
      (inputs.spotUpFreq === 'N' || inputs.spotUpFreq === 'R') &&
      inputs.isoFreq !== 'P'
    ) {
      outputs.push({
        key: 'allow_spot_three',
        category: 'allow',
        weight: w.allowRules.spotUp.lowFreqWeight + w.allowRules.spotUp.noDeepRangeBonus,
        source: 'no_deep_range'
      });
    }
    
    // ALLOW isolation only when it's a relevant threat to dismiss
    // Skip if: orebThreat=high, or the player is primarily a PnR handler/post scorer
    // (allow_iso is noise for players who never ISO by design)
    const isPnrOrPostPrimary =
      (inputs.pnrFreq === 'P' || inputs.pnrFreq === 'S') ||
      (inputs.postFreq === 'P' || inputs.postFreq === 'S');
    if (
      (inputs.isoFreq === 'R' || inputs.isoFreq === 'N' || inputs.isoEff === 'low') &&
      inputs.orebThreat !== 'high' &&
      !isPnrOrPostPrimary
    ) {
      outputs.push({
        key: 'allow_iso',
        category: 'allow',
        weight: w.allowRules.iso.lowEffWeight + (inputs.isoFreq === 'N' ? 0.2 : 0),
        source: 'weak_iso'
      });
    }
    
    // =========================================================================
    // DHO outputs
    // =========================================================================
    if (inputs.dhoFreq && inputs.dhoFreq !== 'N') {
      let weight =
        freqW[inputs.dhoFreq] * w.outputWeights.dho.baseWeight * effectiveUsageM;
      
      if (inputs.dhoRole) {
        weight += w.outputWeights.dho.roleBonus[inputs.dhoRole] || 0;
      }
      
      if (inputs.dhoFreq === 'P') {
        weight += 0.15;
      }
      
      outputs.push({
        key: 'deny_dho',
        category: 'deny',
        weight: Math.min(weight, 1.0),
        source: 'dho'
      });
    }
    
    // =========================================================================
    // Cut outputs - v2.1 (duck_in removed from cutType)
    // =========================================================================
    if (inputs.cutFreq && inputs.cutFreq !== 'N' && inputs.cutType) {
      let weight =
        freqW[inputs.cutFreq] * w.outputWeights.cut.baseWeight * effectiveUsageM;
      const bonus = w.outputWeights.cut.typeBonus[inputs.cutType] || 0;
      weight += bonus;
      
      if (inputs.selfCreation === 'low') {
        weight += 0.15;
      }
      
      outputs.push({
        key: `deny_cut_${inputs.cutType}`,
        category: 'deny',
        weight: Math.min(weight, 1.0),
        source: 'cut'
      });
    }

    if (
      inputs.offBallRole === 'cutter' &&
      inputs.cutFreq === 'P' &&
      inputs.freeCutsFrequency === 'Primary'
    ) {
      const cutDenyIdx = outputs.findIndex((o) => o.key?.startsWith('deny_cut'));
      if (cutDenyIdx >= 0) {
        outputs[cutDenyIdx].weight = Math.min(outputs[cutDenyIdx].weight + 0.1, 0.8);
        outputs[cutDenyIdx].source = 'cut_compulsive_unified';
      }
    }

    // =========================================================================
    // Off-ball screens (indirects) — screener / cut actions
    // =========================================================================
    if (inputs.indirectFreq && inputs.indirectFreq !== 'N') {
      const freqI = freqW[inputs.indirectFreq];
      const ob = inputs.offBallScreenerAction;
      const obl = inputs.offBallCutAction;
      if (ob === 'pop_3') {
        const popW = inputs.deepRange ? 0.85 : 0.4;
        outputs.push({
          key: 'deny_screen_pop',
          category: 'deny',
          weight: popW,
          source: 'off_ball_screen',
        });
      }
      if (ob === 'pop_mid') {
        outputs.push({
          key: 'deny_screen_pop',
          category: 'deny',
          weight: 0.7,
          source: 'off_ball_screen',
        });
      }
      if (ob === 'short_roll') {
        outputs.push({
          key: 'aware_screen_short_roll',
          category: 'aware',
          weight: 0.75,
          source: 'off_ball_screen',
        });
      }
      if (ob === 'slip') {
        outputs.push({
          key: 'deny_screen_slip',
          category: 'deny',
          weight: 0.8,
          source: 'off_ball_screen',
        });
      }
      if (ob === 'roll_to_rim') {
        let rw = freqI * w.outputWeights.transition.baseWeight * w.athMultiplier[inputs.ath];
        rw *= w.outputWeights.transRole.rim_run * 0.9;
        outputs.push({
          key: 'deny_trans_rim',
          category: 'deny',
          weight: Math.min(rw, 1.0),
          source: 'off_ball_roll_rim',
        });
      }
      if (obl === 'curl') {
        outputs.push({
          key: 'deny_off_ball_curl',
          category: 'deny',
          weight: 0.75,
          source: 'off_ball_cut',
        });
      }
      if (obl === 'catch_and_shoot' && inputs.deepRange) {
        outputs.push({
          key: 'deny_screen_pop',
          category: 'deny',
          weight: 0.65,
          source: 'off_ball_cut',
        });
      }
      if (obl === 'flare') {
        outputs.push({
          key: 'aware_off_ball_flare',
          category: 'aware',
          weight: 0.65,
          source: 'off_ball_cut',
        });
      }
    }

    if (
      inputs.offBallScreenPattern &&
      inputs.offBallScreenPattern !== 'none' &&
      inputs.offBallScreenPatternFreq
    ) {
      outputs.push({
        key: 'aware_off_ball_screen_graded',
        category: 'aware',
        weight: editorGradedFreqWeight(inputs.offBallScreenPatternFreq),
        source: 'off_ball_screen_graded',
        params: {
          action: inputs.offBallScreenPattern,
          freq: inputs.offBallScreenPatternFreq,
        },
      });
    }

    if (inputs.offBallRole && inputs.offBallRole !== 'none') {
      outputs.push({
        key: 'aware_off_ball_role',
        category: 'aware',
        weight: 0.55,
        source: 'off_ball_role',
        params: { role: inputs.offBallRole },
      });
    }
    
    // =========================================================================
    // Offensive rebounding
    // =========================================================================
    if (inputs.orebThreat === 'high') {
      const pq = inputs.putbackQuality;
      if (pq === 'primary') {
        outputs.push({
          key: 'deny_oreb',
          category: 'deny',
          weight: 0.9,
          source: 'oreb_finisher',
          params: { instruction: 'box_out_before_shot' },
        });
      } else if (pq === 'capable' || !pq) {
        outputs.push({
          key: 'deny_oreb',
          category: 'deny',
          weight: w.outputWeights.oreb.baseWeight * w.outputWeights.oreb.threatMultiplier.high,
          source: 'oreb',
        });
        outputs.push({
          key: 'aware_oreb',
          category: 'aware',
          weight: 0.8,
          source: 'oreb_threat',
        });
      } else if (pq === 'palms_only') {
        outputs.push({
          key: 'deny_oreb',
          category: 'deny',
          weight: 0.55,
          source: 'oreb_distributor',
          params: { instruction: 'no_second_chance_passes' },
        });
      }
    } else if (inputs.orebThreat === 'medium') {
      outputs.push({
        key: 'aware_oreb',
        category: 'aware',
        weight: 0.55,
        source: 'oreb_medium',
      });
    }

    if (inputs.orebThreat === 'high' && inputs.transRolePrimary === 'rim_runner') {
      const orebIdx = outputs.findIndex((o) => o.key === 'deny_oreb');
      const rimIdx = outputs.findIndex((o) => o.key === 'deny_trans_rim');
      if (orebIdx >= 0 && rimIdx >= 0) {
        // Keep deny_trans_rim (transition instruction), remove deny_oreb duplicate
        // The unified instruction covers both: sprint back + box out
        const maxWeight = Math.max(outputs[orebIdx].weight, outputs[rimIdx].weight);
        outputs[rimIdx].weight = Math.min(maxWeight + 0.05, 1.0);
        outputs[rimIdx].params = { ...(outputs[rimIdx].params ?? {}), context: 'oreb_and_transition' };
        outputs.splice(orebIdx, 1);
      }
    }

    // =========================================================================
    // Floater
    // =========================================================================
    if (inputs.floater && inputs.floater !== 'N') {
      const floaterWeight = freqW[inputs.floater] * w.outputWeights.floater.baseWeight;
      const isPnrFloater =
        inputs.pnrFreq &&
        inputs.pnrFreq !== 'N' &&
        (inputs.pnrFinishLeft === 'Floater' || inputs.pnrFinishRight === 'Floater');
      if (isPnrFloater) {
        const pnrIdx = outputs.findIndex((o) => o.key === 'deny_pnr_downhill');
        if (pnrIdx >= 0) {
          outputs[pnrIdx].weight = Math.min(outputs[pnrIdx].weight + 0.05, 1.0);
          outputs[pnrIdx].params = { ...(outputs[pnrIdx].params ?? {}), finish: 'floater' };
          outputs[pnrIdx].source = 'pnr_floater_unified';
        }
      } else {
        outputs.push({
          key: 'deny_floater',
          category: 'deny',
          weight: Math.min(floaterWeight * 1.3, 1.0),
          source: 'floater',
        });
      }
    }

    // =========================================================================
    // Force weak hand
    // =========================================================================
    if (inputs.offHandFinish === 'weak') {
      const weakHand = inputs.hand === 'R' ? 'L' : 'R';
      // Suppress force_weak_hand if scout observed the player drives with weak hand too —
      // isoWeakHandFinish=drive means they CAN finish on the off-hand despite low efficiency.
      // In that case, generate aware_hands instead (ambidextrous finisher, just less efficient).
      const canFinishWeakHand = inputs.isoWeakHandFinish === 'drive';
      if (canFinishWeakHand) {
        // Ambidextrous but less efficient on weak side — warn but don't force
        if (!outputs.some(o => o.key === 'aware_hands')) {
          outputs.push({
            key: 'aware_hands',
            category: 'aware',
            weight: 0.65,
            source: 'both_hands',
          });
        }
      } else if (inputs.contactFinish === 'avoids') {
        outputs.push({
          key: 'force_contact',
          category: 'force',
          weight: 0.85,
          params: { hand: weakHand, instruction: 'physical_to_weak_hand' },
          source: 'contact_weak_hand_combined',
        });
      } else {
        outputs.push({
          key: 'force_weak_hand',
          category: 'force',
          weight: w.forceRules.weakHand.baseWeight + w.forceRules.weakHand.offHandWeakBonus,
          params: { hand: weakHand },
          source: 'off_hand',
        });
      }
    }

    // force_perimeter ELIMINADO en v3 — reemplazado por force_no_space y force_paint_deny
    // force_no_space: perimetral sin rango pero con amenaza de drive (spotUp activo + no deepRange)
    if (
      !inputs.deepRange &&
      inputs.spotUpFreq &&
      inputs.spotUpFreq !== 'N' &&
      inputs.isoFreq !== 'P'
    ) {
      outputs.push({
        key: 'force_no_space',
        category: 'force',
        weight: 0.78,
        source: 'no_range_spot_active',
      });
    }
    // force_paint_deny: interior de bajo impacto o pasador (no anotador de poste)
    if (
      (inputs.pos === 'PF' || inputs.pos === 'C') &&
      (inputs.postFreq === 'N' || inputs.postFreq === 'R') &&
      inputs.usage === 'role'
    ) {
      outputs.push({
        key: 'force_paint_deny',
        category: 'force',
        weight: 0.65,
        source: 'interior_low_impact',
      });
    }
    // allow_distance para no-tiradores sin deepRange
    if (
      !inputs.deepRange &&
      (inputs.spotUpFreq === 'N' || inputs.spotUpFreq === 'R') &&
      inputs.isoFreq !== 'P'
    ) {
      outputs.push({
        key: 'allow_distance',
        category: 'allow',
        weight: 0.65,
        source: 'no_range_no_threat',
      });
    }

    // =========================================================================
    // Force contact
    // =========================================================================
    // Don't force contact against primary spot-up shooters:
    // contesting a closeout physically risks easy fouls, and the threat is exterior.
    const isSpotUpPrimary =
      inputs.spotUpFreq === 'P' ||
      (inputs.spotUpFreq === 'S' && inputs.deepRange);
    if (inputs.contactFinish === 'avoids' && inputs.offHandFinish !== 'weak' && !isSpotUpPrimary) {
      outputs.push({
        key: 'force_contact',
        category: 'force',
        weight: w.forceRules.contactFinish.avoidsWeight,
        source: 'contact_avoids',
      });
    }

    // =========================================================================
    // Force early shot clock
    // =========================================================================
    // force_early only for ball handlers — not for PnR screeners
    // A player with pnrFreq=P who has screenerAction defined is a screener, not a handler
    const isPnrHandler = inputs.pnrFreq === 'P' && !inputs.screenerAction;
    const hasExteriorThreat =
      inputs.deepRange === true &&
      inputs.spotUpFreq != null &&
      inputs.spotUpFreq !== 'N';
    const isTransitionThreat =
      inputs.transFreq != null &&
      inputs.transFreq !== 'N' &&
      inputs.transRole != null;
    // force_early: only valid for ISO-primary handlers, not PnR-primary handlers.
    // For PnR handlers, the key defense instruction is on the screen action (deny_pnr_downhill),
    // not on shot clock pressure — pressing early on a PnR handler with exterior threat
    // creates open catch-and-shoot opportunities for their shooters.
    // Additionally suppress if player has exterior/transition threat regardless of play type.
    const shouldSuppressEarly = isPnrHandler || hasExteriorThreat || isTransitionThreat;
    if (
      inputs.selfCreation === 'high' &&
      inputs.usage === 'primary' &&
      inputs.isoFreq === 'P' &&
      !shouldSuppressEarly
    ) {
      outputs.push({
        key: 'force_early',
        category: 'force',
        weight: w.forceRules.earlyShot.baseWeight + w.forceRules.earlyShot.selfCreationHighBonus,
        source: 'self_creation',
      });
    } else if (
      inputs.selfCreation === 'high' &&
      inputs.usage === 'primary' &&
      inputs.isoFreq === 'P' &&
      !isPnrHandler &&
      (hasExteriorThreat || isTransitionThreat)
    ) {
      // ISO primary but with exterior threat: emit at reduced weight as runner-up option
      outputs.push({
        key: 'force_early',
        category: 'force',
        weight: 0.2,
        source: 'self_creation',
      });
    }
    
    // =========================================================================
    // Aware outputs
    // =========================================================================
    // aware_passer only when vision is high AND player doesn't struggle under trap pressure.
    // A player with vision=4 but trapResponse=struggle reads collective situations well in open court,
    // but is NOT an elite passer under defensive pressure — don't warn the defender to rotate.
    if (inputs.vision >= 4 && inputs.trapResponse !== 'struggle') {
      outputs.push({
        key: 'aware_passer',
        category: 'aware',
        weight: 0.8 + (inputs.vision === 5 ? 0.15 : 0),
        source: 'vision'
      });
    }
    
    if (inputs.trapResponse === 'escape' || inputs.trapResponse === 'pass') {
      outputs.push({
        key: 'aware_trap',
        category: 'aware',
        weight: 0.7,
        source: 'trap_response'
      });
    }
    
    if (inputs.contactFinish === 'seeks' && inputs.phys >= 4) {
      outputs.push({
        key: 'aware_physical',
        category: 'aware',
        weight: 0.75,
        source: 'physical'
      });
    }
    
    if (inputs.deepRange) {
      outputs.push({
        key: 'aware_deep',
        category: 'aware',
        weight: 0.8,
        source: 'deep_range'
      });
    }
    
    if (inputs.offHandFinish === 'strong') {
      outputs.push({
        key: 'aware_hands',
        category: 'aware',
        weight: 0.65,
        source: 'both_hands'
      });
    }
    
    if (inputs.usage === 'role' && inputs.vision >= 4 && inputs.selfCreation === 'low') {
      outputs.push({
        key: 'aware_connector',
        category: 'aware',
        weight: 0.7,
        source: 'connector'
      });
    }
    
    return outputs;
  }

  /**
   * Group outputs by category
   */
  private categorizeOutputs(rawOutputs: MotorOutput[]): Record<string, MotorOutput[]> {
    // Deduplicate by key — keep highest weight for same key
    const deduped = new Map<string, MotorOutput>();
    for (const o of rawOutputs) {
      const existing = deduped.get(o.key);
      if (!existing || o.weight > existing.weight) {
        deduped.set(o.key, o);
      }
    }

    const categorized: Record<string, MotorOutput[]> = {
      deny: [],
      force: [],
      allow: [],
      aware: []
    };
    
    for (const output of Array.from(deduped.values())) {
      if (categorized[output.category]) {
        categorized[output.category].push(output);
      }
    }
    
    // Sort each category by weight descending
    for (const cat of Object.keys(categorized)) {
      categorized[cat].sort((a, b) => b.weight - a.weight);
    }
    
    return categorized;
  }

  /**
   * Threat-ranked selection: top situations drive DENY; ALLOW gated by situation threat.
   */
  private selectTopOutputs(
    categorized: Record<string, MotorOutput[]>,
    threatScores: SituationThreatScore[],
  ): {
    deny: MotorOutput[];
    force: MotorOutput[];
    allow: MotorOutput[];
    aware: MotorOutput[];
    runnersUp: MotorOutput[];
  } {
    const allOutputs = Object.values(categorized).flat();

    // Raise threshold for 3rd deny slot when top 2 are already dominant (>=0.90)
    const top2scores = threatScores.slice(0, 2).map(t => t.score);
    const top2Dominant = top2scores.length >= 2 && top2scores[1] >= 0.90;
    const denyThreshold = top2Dominant
      ? THREAT_THRESHOLDS.denyEligible + 0.10  // 0.80 when top 2 dominate
      : THREAT_THRESHOLDS.denyEligible;         // 0.70 otherwise
    const eligible = threatScores.filter((t) => t.score >= denyThreshold);
    // Use top 3 slots when 5+ situations compete; otherwise top 2
    const topN = threatScores.length >= 5 ? 3 : 2;
    const topTwo: SituationThreatScore[] = [];
    for (const t of eligible) {
      if (topTwo.length >= topN) break;
      topTwo.push(t);
    }
    // Fallback: fill remaining slots only if not in dominant-top2 mode
    if (!top2Dominant) {
      for (const t of threatScores) {
        if (topTwo.length >= topN) break;
        if (!topTwo.some((x) => x.situation === t.situation)) topTwo.push(t);
      }
    }
    const top2Situations = new Set(topTwo.map((t) => t.situation));

    const hasAllowIso = (categorized.allow ?? []).some(o => o.key === 'allow_iso' && o.weight > 0.70);
    const denyOutputs = (categorized.deny ?? [])
      .filter((o) => {
        if (o.weight === 0) return false;
        if (o.weight < 0.35) return false;
        // Suppress deny_iso_space if allow_iso is dominant (selfish/low-eff profile)
        if (o.key === 'deny_iso_space' && hasAllowIso) return false;
        const sit = SOURCE_TO_SITUATION[o.source] ?? 'misc';
        return top2Situations.has(sit) || sit === 'misc';
      })
      .slice(0, this.weights.maxOutputsPerCategory.deny);

    const forceOutputs = (categorized.force ?? [])
      .filter((o) => o.weight > 0)
      .slice(0, this.weights.maxOutputsPerCategory.force);

    const allowOutputs = (categorized.allow ?? [])
      .filter((o) => {
        if (o.weight === 0) return false;
        const sit = SOURCE_TO_SITUATION[o.source] ?? 'misc';
        const threat = threatScores.find((t) => t.situation === sit);
        return (
          !threat ||
          threat.score < THREAT_THRESHOLDS.allowCandidate ||
          sit === 'misc'
        );
      })
      .slice(0, this.weights.maxOutputsPerCategory.allow);

    const awareOutputs = (categorized.aware ?? [])
      .filter((o) => o.weight > 0)
      .sort((a, b) => {
        const sitA = SOURCE_TO_SITUATION[a.source] ?? 'misc';
        const sitB = SOURCE_TO_SITUATION[b.source] ?? 'misc';
        const thrA = threatScores.find((t) => t.situation === sitA)?.score ?? 0;
        const thrB = threatScores.find((t) => t.situation === sitB)?.score ?? 0;
        const priA = thrA < THREAT_THRESHOLDS.awareHigh ? 0 : 1;
        const priB = thrB < THREAT_THRESHOLDS.awareHigh ? 0 : 1;
        if (priA !== priB) return priA - priB;
        const lowA = thrA < THREAT_THRESHOLDS.awareLow ? 1 : 0;
        const lowB = thrB < THREAT_THRESHOLDS.awareLow ? 1 : 0;
        if (lowA !== lowB) return lowB - lowA;
        return b.weight - a.weight;
      })
      .map((o) => {
        const sit = SOURCE_TO_SITUATION[o.source] ?? 'misc';
        const thr = threatScores.find((t) => t.situation === sit)?.score ?? 0;
        if (thr > 0 && thr < THREAT_THRESHOLDS.awareLow && sit !== 'misc') {
          return { ...o, weight: Math.min(o.weight * 0.85, 1.0) };
        }
        return o;
      })
      .slice(0, this.weights.maxOutputsPerCategory.aware);

    const selectedKeys = new Set([
      ...denyOutputs.map((o) => o.key),
      ...forceOutputs.map((o) => o.key),
      ...allowOutputs.map((o) => o.key),
      ...awareOutputs.map((o) => o.key),
    ]);

    const runnersUp = allOutputs
      .filter((o) => !selectedKeys.has(o.key) && o.weight > 0)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 10);

    return {
      deny: denyOutputs,
      force: forceOutputs,
      allow: allowOutputs,
      aware: awareOutputs,
      runnersUp,
    };
  }

  /**
   * Generate slide content
   */
  private generateSlides(inputs: EnrichedInputs, selected: Record<string, MotorOutput[]>): Slides {
    return {
      identity: this.generateIdentitySlide(inputs),
      whereDangerous: this.generateWhereDangerousSlide(inputs),
      howAttacks: this.generateHowAttacksSlide(inputs),
      screensActions: this.generateScreensActionsSlide(inputs),
      defensivePlan: this.generateDefensivePlanSlide(selected)
    };
  }

  private generateIdentitySlide(inputs: EnrichedInputs): Slides['identity'] {
    const bullets: Array<{ key: string; text: string }> = [];
    
    bullets.push({
      key: 'id_physical',
      text: `${inputs.pos} | ATH ${inputs.ath}/5 | PHYS ${inputs.phys}/5 | ${inputs.hand}-handed`
    });
    
    const usageText: Record<string, string> = {
      primary: 'Primary offensive option',
      secondary: 'Secondary offensive option',
      role: 'Role player'
    };
    bullets.push({ key: 'id_usage', text: usageText[inputs.usage] });
    
    if (inputs.selfCreation) {
      const creationText: Record<string, string> = {
        high: 'High self-creation threat',
        medium: 'Moderate self-creation',
        low: 'Limited self-creation'
      };
      bullets.push({ key: 'id_creation', text: creationText[inputs.selfCreation] });
    }
    
    // v2.1: Add ball handling info if notable
    if (inputs.ballHandling === 'liability' || inputs.ballHandling === 'limited') {
      bullets.push({ 
        key: 'id_ball_handling', 
        text: inputs.ballHandling === 'liability' 
          ? 'Ball handling liability - pressure opportunity' 
          : 'Limited ball handling'
      });
    }
    
    return { bullets };
  }

  private generateWhereDangerousSlide(inputs: EnrichedInputs): Slides['whereDangerous'] {
    const zones: ZoneThreat[] = [];
    const freqW = this.weights.frequencyToWeight;
    
    if (inputs.postFreq && freqW[inputs.postFreq] > 0.5) {
      zones.push({ zone: 'paint', threat: freqW[inputs.postFreq], source: 'post' });
    }
    if (inputs.cutFreq && freqW[inputs.cutFreq] > 0.5) {
      zones.push({ zone: 'paint', threat: freqW[inputs.cutFreq] * 0.9, source: 'cuts' });
    }
    if (inputs.spotUpFreq && freqW[inputs.spotUpFreq] > 0.3) {
      const zone = inputs.spotZone || 'perimeter';
      zones.push({ zone, threat: freqW[inputs.spotUpFreq], source: 'spot_up' });
    }
    if (inputs.deepRange) {
      zones.push({ zone: 'deep', threat: 0.9, source: 'deep_range' });
    }
    if (inputs.floater && freqW[inputs.floater] > 0.5) {
      zones.push({ zone: 'floater_zone', threat: freqW[inputs.floater], source: 'floater' });
    }
    
    // v2.1: Transition threat based on role
    if (inputs.transFreq && freqW[inputs.transFreq] > 0.5 && inputs.transRole === 'rim_run') {
      zones.push({ zone: 'rim_trans', threat: freqW[inputs.transFreq] * 1.1, source: 'trans_rim_run' });
    }
    
    zones.sort((a, b) => b.threat - a.threat);
    
    return { zones: zones.slice(0, 4) };
  }

  private generateHowAttacksSlide(inputs: EnrichedInputs): Slides['howAttacks'] {
    const playTypes: PlayType[] = [];
    const freqW = this.weights.frequencyToWeight;
    
    const playTypeMapping: Record<string, { name: string; details: string | null }> = {
      isoFreq: { name: 'ISO', details: inputs.isoDir ? `Prefers ${inputs.isoDir === 'L' ? 'left' : 'right'}` : null },
      pnrFreq: { name: 'PnR Handler', details: inputs.pnrPri ? `Looks for ${inputs.pnrPri === 'SF' ? 'scoring' : 'passing'} first` : null },
      postFreq: { name: 'Post-up', details: inputs.postProfile ? this.getPostProfileText(inputs.postProfile) : null },
      transFreq: { name: 'Transition', details: inputs.transRole ? this.getTransRoleText(inputs.transRole) : null },
      spotUpFreq: { name: 'Spot-up', details: inputs.spotZone ? `Prefers ${inputs.spotZone}` : null },
      dhoFreq: { name: 'DHO', details: inputs.dhoRole ? `${inputs.dhoRole === 'giver' ? 'Initiates' : 'Receives'}` : null },
      cutFreq: { name: 'Cuts', details: inputs.cutType || null },
      indirectFreq: { name: 'Off-screen', details: null }
    };
    
    for (const [key, config] of Object.entries(playTypeMapping)) {
      const freq = (inputs as unknown as Record<string, unknown>)[key] as Frequency;
      if (freq && freq !== 'N') {
        playTypes.push({
          name: config.name,
          frequency: freq,
          weight: freqW[freq],
          details: config.details
        });
      }
    }
    
    playTypes.sort((a, b) => b.weight - a.weight);
    
    return { playTypes };
  }

  private getPostProfileText(profile: PostProfile): string {
    const texts: Record<string, string> = { B2B: 'Back-to-basket', FU: 'Face-up', M: 'Mixed' };
    return texts[profile ?? ''] || profile || '';
  }

  // v2.1: New helper for transition role text
  private getTransRoleText(role: TransRole): string {
    const texts: Record<string, string> = { 
      rim_run: 'Rim runner', 
      trail: 'Trailer (3PT)', 
      leak: 'Early leak',
      fill: 'Space filler'
    };
    return texts[role ?? ''] || role || '';
  }

  private generateScreensActionsSlide(inputs: EnrichedInputs): Slides['screensActions'] {
    const actions: Slides['screensActions']['actions'] = [];
    
    if (inputs.screenerAction) {
      actions.push({
        type: 'screener',
        action: inputs.screenerAction,
        details: inputs.popRange ? `Range: ${inputs.popRange}` : null
      });
    }
    
    if (inputs.dhoFreq && inputs.dhoFreq !== 'N') {
      actions.push({
        type: 'dho',
        role: inputs.dhoRole ?? undefined,
        action: inputs.dhoAction ?? undefined
      });
    }
    
    if (inputs.trapResponse) {
      actions.push({
        type: 'trap_handling',
        response: inputs.trapResponse
      });
    }
    
    // v2.1: Add post entry style if relevant
    if (inputs.postEntry && inputs.postFreq && inputs.postFreq !== 'N') {
      actions.push({
        type: 'post_entry',
        action: inputs.postEntry,
        details: inputs.postMoves ? `Moves: ${inputs.postMoves.join(', ')}` : null
      });
    }
    
    return { actions };
  }

  private generateDefensivePlanSlide(selected: Record<string, MotorOutput[]>): Slides['defensivePlan'] {
    const limits = this.weights.slideOutputLimits.defensivePlan;
    
    return {
      deny: selected.deny.slice(0, limits.deny).map(o => this.formatOutput(o)),
      force: selected.force.slice(0, limits.force).map(o => this.formatOutput(o)),
      allow: selected.allow.slice(0, limits.allow).map(o => this.formatOutput(o))
    };
  }

  private formatOutput(output: MotorOutput): FormattedOutput {
    const category = this.outputCatalog[output.category as keyof typeof this.outputCatalog];
    if (!category) return { key: output.key, text: output.key };
    
    // Find the output definition by key
    let outputDef: { key: string; i18nKey: string; template: string } | null = null;
    for (const def of Object.values(category)) {
      if (def.key === output.key) {
        outputDef = def;
        break;
      }
    }
    
    if (!outputDef) return { key: output.key, text: output.key };
    
    // Apply params to template
    let text = outputDef.template;
    if (output.params) {
      for (const [key, value] of Object.entries(output.params)) {
        text = text.replace(`{${key}}`, value);
      }
    }
    
    return {
      key: outputDef.i18nKey,
      text,
      weight: output.weight,
      source: output.source
    };
  }
}

/** Resolve stable i18n key for a weighted motor output (for UI / persisted plans). */
export function motorOutputToI18nKey(output: MotorOutput): string {
  const cat = OUTPUT_CATALOG[output.category as keyof typeof OUTPUT_CATALOG];
  for (const def of Object.values(cat)) {
    if (def.key === output.key) return def.i18nKey;
  }
  return output.key;
}

/**
 * Serialized plan line: `output.deny.post_shoulder|shoulder=L` so clients can substitute `{shoulder}` via i18n.
 */
export function motorOutputToPlanString(output: MotorOutput): string {
  const i18nKey = motorOutputToI18nKey(output);
  if (!output.params) return i18nKey;
  const entries = Object.entries(output.params);
  if (entries.length === 0) return i18nKey;
  return [i18nKey, ...entries.map(([k, v]) => `${k}=${v}`)].join('|');
}

// Export singleton instance
export const motor = new UScoutMotor();
