import {
  ArrowRightLeft, Repeat2, Shield, Layers, Crosshair, Zap, Route,
  CornerDownRight, RefreshCw, Ban, ArrowRight, CheckCircle2, Target,
  EyeOff, AlertTriangle, DoorOpen, Scissors, FastForward, MoveDown,
  ChevronsUp, ChevronsDown, type LucideIcon,
} from "lucide-react";

export const SITUATION_ICONS: Partial<Record<string, LucideIcon>> = {
  iso_right: ArrowRightLeft, iso_left: ArrowRightLeft, iso_both: Repeat2,
  pnr_ball: Shield, pnr_screener: Shield,
  post_right: Layers, post_left: Layers, post_high: Layers,
  catch_shoot: Crosshair, transition: Zap, off_ball: Route,
  cut: CornerDownRight, oreb: RefreshCw, floater: ChevronsUp, dho: Repeat2,
};

export const DEFENSE_ICONS: Partial<Record<string, LucideIcon>> = {
  deny: Ban, force: ArrowRight, allow: CheckCircle2,
};

export const AWARE_ICONS: Partial<Record<string, LucideIcon>> = {
  trait_backdoor: DoorOpen, trait_crashing: RefreshCw,
  trait_drag_screen: FastForward, trait_slip_threat: Scissors,
  trait_transition: Zap, trait_duck_in: MoveDown,
  trait_perimeter_threat: Crosshair, trait_off_screens: Route,
  trait_screen_action: Target, trait_force_direction: ArrowRight,
  trait_funnel_direction: ChevronsDown, trait_on_the_double: AlertTriangle,
  trait_post_threat: Layers, trait_primary_post_scorer: Layers,
  trait_closeout: EyeOff,
};

