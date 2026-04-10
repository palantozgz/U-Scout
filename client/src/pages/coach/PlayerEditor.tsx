import { motion, AnimatePresence } from "framer-motion";
import { useLocale, t } from "@/lib/i18n";
import { useState, useEffect, useRef, type ChangeEvent } from "react";
import { useRoute, useLocation, useSearch } from "wouter";
import {
  usePlayer, useTeams, useCreatePlayer, useUpdatePlayer, useDeletePlayer,
  generateProfile, createDefaultPlayer,
  TRANS_ROLE_SUB_OPTIONS,
  type PlayerInput, type IntensityLevel, type DirectionTendency,
  type CloseoutReaction, type PlayerProfile, type PhysicalLevel,
  type PostQuadrants, type ScreenerAction, type PnrFinish,
  type HighPostAction, type HighPostZonesMotor,
  type TransRoleEditor,
} from "@/lib/mock-data";
import { ArrowLeft, Save, Info, Flame, Zap, Target, Trash2, HelpCircle, X, Check, Plus, ChevronDown, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { BasketballPlaceholderAvatar } from "@/components/BasketballPlaceholderAvatar";
import { isRealPhoto } from "@/lib/utils";

type GradedTransitionFreq = NonNullable<PlayerInput["rimRunFrequency"]>;

function gradedToIntensity(
  g:
    | PlayerInput["rimRunFrequency"]
    | PlayerInput["offBallScreenPatternFreq"]
    | PlayerInput["cutterFrequency"]
    | null
    | undefined,
): IntensityLevel {
  if (g === "primary") return "Primary";
  if (g === "secondary") return "Secondary";
  if (g === "rare") return "Rare";
  return "Never";
}

function intensityToGraded(v: IntensityLevel): GradedTransitionFreq {
  if (v === "Primary") return "primary";
  if (v === "Secondary") return "secondary";
  if (v === "Rare") return "rare";
  return "never";
}

const TRANS_EDITOR_ROLES = ["rim_runner", "trail", "runner", "pusher"] as const satisfies readonly TransRoleEditor[];

const OFF_BALL_SCREEN_OPTS = [
  "slip",
  "roll",
  "pop_short",
  "pop_mid",
  "short_roll",
  "none",
] as const satisfies readonly NonNullable<PlayerInput["offBallScreenPattern"]>[];

const OFF_BALL_SCREEN_LABEL: Record<(typeof OFF_BALL_SCREEN_OPTS)[number], string> = {
  slip: "editor.screen_pattern.slip",
  roll: "editor.screen_pattern.roll_to_rim",
  pop_short: "editor.screen_pattern.pop_short",
  pop_mid: "editor.screen_pattern.pop_mid",
  short_roll: "editor.screen_pattern.short_roll",
  none: "editor.screen_pattern.none",
};

const ISO_HAND_FINISH_OPTS = ["drive", "pullup", "floater", "pass"] as const;
const ISO_HAND_FINISH_I18N: Record<(typeof ISO_HAND_FINISH_OPTS)[number], string> = {
  drive: "editor.iso_hand_finish.drive",
  pullup: "editor.iso_hand_finish.pullup",
  floater: "editor.iso_hand_finish.floater",
  pass: "editor.iso_hand_finish.pass",
};

const ISO_START_ZONE_OPTS = ["left_wing", "right_wing", "top", "either"] as const satisfies readonly NonNullable<
  PlayerInput["isoStartZone"]
>[];
const ISO_START_ZONE_I18N: Record<(typeof ISO_START_ZONE_OPTS)[number], string> = {
  left_wing: "editor.iso_zone_left_wing",
  right_wing: "editor.iso_zone_right_wing",
  top: "editor.iso_zone_top",
  either: "editor.iso_zone_either",
};

const PNR_SIDE_EFF_OPTS = ["high", "medium", "low"] as const satisfies readonly NonNullable<
  PlayerInput["pnrEffLeft"]
>[];

const PNR_SCREEN_TIMING_OPTS = ["holds_long", "quick_release", "ghost_touch", "slip"] as const satisfies readonly NonNullable<
  PlayerInput["pnrScreenTiming"]
>[];
const PNR_SCREEN_TIMING_I18N: Record<(typeof PNR_SCREEN_TIMING_OPTS)[number], string> = {
  holds_long: "editor.pnr_timing_holds_long",
  quick_release: "editor.pnr_timing_quick",
  ghost_touch: "editor.pnr_timing_ghost",
  slip: "editor.pnr_timing_slip",
};

const PUTBACK_QUALITY_OPTS = ["primary", "capable", "palms_only", "not_observed"] as const satisfies readonly NonNullable<
  PlayerInput["putbackQuality"]
>[];
const PUTBACK_QUALITY_I18N: Record<(typeof PUTBACK_QUALITY_OPTS)[number], string> = {
  primary: "editor.putback_converts",
  capable: "editor.putback_capable",
  palms_only: "editor.putback_palms",
  not_observed: "editor.putback_not_observed",
};

const FREE_CUTS_TYPE_OPTS = ["basket", "flash", "both"] as const satisfies readonly NonNullable<
  PlayerInput["freeCutsType"]
>[];
const FREE_CUTS_TYPE_I18N: Record<(typeof FREE_CUTS_TYPE_OPTS)[number], string> = {
  basket: "editor.free_cuts_basket",
  flash: "editor.free_cuts_flash",
  both: "editor.free_cuts_both",
};

const PERSONALITY_TRAITS: {
  id: NonNullable<PlayerInput["personality"]>[number];
  i18nKey: string;
  tone: "positive" | "negative";
}[] = [
  { id: "clutch", i18nKey: "editor.personality_clutch", tone: "positive" },
  { id: "leader", i18nKey: "editor.personality_leader", tone: "positive" },
  { id: "selfish", i18nKey: "editor.personality_selfish", tone: "negative" },
  { id: "freezes", i18nKey: "editor.personality_freezes", tone: "negative" },
];

function screenPatternToLegacyScreener(
  p: PlayerInput["offBallScreenPattern"],
): PlayerInput["screenerAction"] {
  if (!p || p === "none") return null;
  switch (p) {
    case "slip":
      return "slip";
    case "roll":
      return "roll_to_rim";
    case "pop_short":
      return "pop_mid";
    case "pop_mid":
      return "pop_mid";
    case "short_roll":
      return "short_roll";
    default:
      return null;
  }
}

/** Weak-hand pills ↔ legacy `isoOppositeFinish` (traits / defensive plan in mock-data). */
function isoWeakFinishToLegacyOpposite(
  f: PlayerInput["isoWeakHandFinish"],
): PlayerInput["isoOppositeFinish"] | undefined {
  if (!f) return undefined;
  if (f === "drive") return "Drive";
  if (f === "pullup") return "Pull-up";
  if (f === "floater") return "Floater";
  return "Pass";
}

function legacyOppositeToIsoWeakFinish(
  f: PlayerInput["isoOppositeFinish"],
): PlayerInput["isoWeakHandFinish"] | null {
  if (!f) return null;
  if (f === "Drive") return "drive";
  if (f === "Pull-up") return "pullup";
  if (f === "Floater") return "floater";
  if (f === "Pass") return "pass";
  return null;
}

function legacyScreenerToScreenPattern(
  a: PlayerInput["screenerAction"],
): PlayerInput["offBallScreenPattern"] | null {
  if (!a) return null;
  switch (a) {
    case "roll_to_rim":
      return "roll";
    case "slip":
      return "slip";
    case "pop_mid":
      return "pop_mid";
    case "pop_3":
      return "pop_short";
    case "short_roll":
      return "short_roll";
    default:
      return null;
  }
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────
function Tooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open]);
  return (
    <>
      <button ref={btnRef} type="button" onClick={() => setOpen(v => !v)}
        className="ml-1.5 text-slate-400 hover:text-primary transition-colors flex-shrink-0">
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4"
          onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm bg-slate-900 text-slate-100 text-sm rounded-2xl p-5 shadow-2xl border border-slate-700 leading-relaxed"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <p>{text}</p>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-white shrink-0 mt-0.5">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function FieldLabel({ label, tooltip }: { label: string; tooltip?: string }) {
  return (
    <div className="flex items-center gap-0.5">
      <Label className="font-semibold text-slate-700 dark:text-slate-300 text-sm">{label}</Label>
      {tooltip && <Tooltip text={tooltip} />}
    </div>
  );
}

function PlayerAvatarUpload({ imageUrl, onUpload }: { imageUrl: string; onUpload: (url: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const real = isRealPhoto(imageUrl);

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 200;
        const scale = Math.min(MAX / img.width, MAX / img.height, 1);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        onUpload(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex justify-center mb-2">
      <div className="relative cursor-pointer" onClick={() => inputRef.current?.click()}>
        <div className="w-24 h-24 rounded-full overflow-hidden">
          {real
            ? <img src={imageUrl} className="w-full h-full object-cover" />
            : <BasketballPlaceholderAvatar size={96} />}
        </div>
        <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
          <Plus className="w-8 h-8 text-white" />
        </div>
        <input ref={inputRef} type="file" accept="image/*" capture className="hidden" onChange={handleFile} />
      </div>
    </div>
  );
}

// ─── Power Bar ────────────────────────────────────────────────────────────────
function PowerBar({ label, value, onChange, tooltip, color = "primary" }: {
  label: string; value: PhysicalLevel;
  onChange: (v: PhysicalLevel) => void; tooltip?: string;
  color?: "primary" | "amber" | "red" | "green";
}) {
  const colorMap = {
    primary: "bg-primary border-primary",
    amber: "bg-amber-500 border-amber-500",
    red: "bg-red-500 border-red-500",
    green: "bg-emerald-500 border-emerald-500",
  };
  return (
    <div className="space-y-2">
      <FieldLabel label={label} tooltip={tooltip} />
      <div className="flex gap-1.5 items-end h-9">
        {([1, 2, 3, 4, 5] as const).map(level => {
          const filled = value >= level;
          const w = 20 + level * 8;
          const h = 12 + level * 4;
          return (
            <button key={level} type="button"
              onClick={() => onChange(value === level ? 0 : level)}
              style={{ width: w, height: h }}
              className={`rounded-sm transition-all duration-150 border-2 ${filled ? colorMap[color] + " shadow-sm" : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-primary/50"}`}
            />
          );
        })}
        <span className="ml-2 text-xs font-bold text-slate-500 dark:text-slate-400 self-center">
          {value === 0 ? "—" : `${value}/5`}
        </span>
      </div>
    </div>
  );
}

// ─── Intensity selector ───────────────────────────────────────────────────────
function IntensitySelector({ label, value, onChange, tooltip }: {
  label: string; value: IntensityLevel; onChange: (v: IntensityLevel) => void; tooltip?: string;
}) {
  return (
    <div className="space-y-2">
      {label && <FieldLabel label={label} tooltip={tooltip} />}
      <div className="flex flex-wrap" style={{ flexWrap: "wrap", gap: 12 }}>
        {(["Primary", "Secondary", "Rare", "Never"] as IntensityLevel[]).map(level => (
          <Button key={level} type="button" variant={value === level ? "default" : "outline"}
            style={{ minHeight: 44 }}
            className={`h-auto min-h-11 min-w-11 flex-1 px-4 rounded-xl text-sm ${value === level ? "bg-primary border-primary text-white" : "bg-transparent border-slate-200 dark:border-slate-700 dark:text-slate-300"}`}
            onClick={() => onChange(level)}>{level === "Primary" ? t("freq_primary") : level === "Secondary" ? t("freq_secondary") : level === "Rare" ? t("freq_rare") : t("freq_never")}</Button>
        ))}
      </div>
    </div>
  );
}

// ─── Closeout select ──────────────────────────────────────────────────────────
function CloseoutSelect({ label, value, onChange, fallback, tooltip }: {
  label: string; value?: CloseoutReaction; onChange: (v: CloseoutReaction) => void; fallback: CloseoutReaction;
  tooltip?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-0.5">
        <Label className="font-semibold text-slate-700 dark:text-slate-300 text-xs">{label}</Label>
        {tooltip && <Tooltip text={tooltip} />}
      </div>
      <Select value={value ?? fallback} onValueChange={v => onChange(v as CloseoutReaction)}>
        <SelectTrigger className="h-10 rounded-xl bg-slate-50 dark:bg-slate-950/50 dark:border-slate-800 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="Catch & Shoot">{t("opt_closeout_catch_shoot")}</SelectItem>
          <SelectItem value="Attack Baseline">{t("opt_closeout_attack_baseline")}</SelectItem>
          <SelectItem value="Attack Middle">{t("opt_closeout_attack_middle")}</SelectItem>
          <SelectItem value="Attacks Strong Hand">{t("opt_closeout_strong_hand")}</SelectItem>
          <SelectItem value="Attacks Weak Hand">{t("opt_closeout_weak_hand")}</SelectItem>
          <SelectItem value="Extra Pass">{t("opt_closeout_extra_pass")}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

// ─── Half-court diagram with colored blocks ───────────────────────────────────
// Attacker POV: right block = player's right when facing the basket
// Right block = RED, Left block = BLUE
function HalfCourtDiagram({ dominant }: { dominant?: "Right" | "Left" }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3 space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 text-center">
        Top view — player's back to the baseline
      </p>
      <svg viewBox="0 0 240 175" className="w-full max-w-xs mx-auto block" xmlns="http://www.w3.org/2000/svg">
        {/* Half court outline — shifted down to give room for labels */}
        <rect x="10" y="18" width="220" height="140" fill="none" stroke="#94a3b8" strokeWidth="1.5" rx="3"/>
        {/* Paint / key */}
        <rect x="70" y="60" width="100" height="88" fill="none" stroke="#94a3b8" strokeWidth="1.2"/>
        {/* Free throw line */}
        <line x1="70" y1="98" x2="170" y2="98" stroke="#94a3b8" strokeWidth="0.8" strokeDasharray="3,2"/>
        {/* Free throw circle */}
        <ellipse cx="120" cy="98" rx="26" ry="11" fill="none" stroke="#94a3b8" strokeWidth="0.8" strokeDasharray="3,2"/>
        {/* Restricted area arc */}
        <path d="M 102 148 A 18 18 0 0 1 138 148" fill="none" stroke="#94a3b8" strokeWidth="0.8"/>
        {/* Basket */}
        <circle cx="120" cy="140" r="5" fill="none" stroke="#94a3b8" strokeWidth="1.5"/>
        <line x1="120" y1="145" x2="120" y2="153" stroke="#94a3b8" strokeWidth="1.5"/>
        {/* Backboard */}
        <line x1="103" y1="153" x2="137" y2="153" stroke="#94a3b8" strokeWidth="2"/>
        {/* Three-point arc */}
        <path d="M 32 148 A 88 88 0 0 1 208 148" fill="none" stroke="#94a3b8" strokeWidth="0.8" strokeDasharray="2,2"/>
        <line x1="32" y1="103" x2="32" y2="148" stroke="#94a3b8" strokeWidth="0.8" strokeDasharray="2,2"/>
        <line x1="208" y1="103" x2="208" y2="148" stroke="#94a3b8" strokeWidth="0.8" strokeDasharray="2,2"/>

        {/* CENTER COURT direction label */}
        <text x="120" y="13" textAnchor="middle" fontSize="6" fill="#94a3b8">↑ {t("center_court")}</text>

        {/* L block — LEFT side of diagram = player's left when back to baseline */}
        <rect x="52" y="120" width="24" height="18"
          fill={dominant === "Left" ? "#93c5fd" : "#dbeafe"}
          stroke={dominant === "Left" ? "#3b82f6" : "#93c5fd"}
          strokeWidth={dominant === "Left" ? "2.5" : "1.5"}
          rx="3"/>
        <text x="64" y="132" textAnchor="middle" fontSize="8" fontWeight="bold"
          fill={dominant === "Left" ? "#1d4ed8" : "#64748b"}>L</text>
        {dominant === "Left" && <text x="64" y="118" textAnchor="middle" fontSize="8" fill="#1d4ed8">★</text>}

        {/* R block — RIGHT side of diagram = player's right when back to baseline */}
        <rect x="164" y="120" width="24" height="18"
          fill={dominant === "Right" ? "#fca5a5" : "#fee2e2"}
          stroke={dominant === "Right" ? "#ef4444" : "#fca5a5"}
          strokeWidth={dominant === "Right" ? "2.5" : "1.5"}
          rx="3"/>
        <text x="176" y="132" textAnchor="middle" fontSize="8" fontWeight="bold"
          fill={dominant === "Right" ? "#dc2626" : "#64748b"}>R</text>
        {dominant === "Right" && <text x="176" y="118" textAnchor="middle" fontSize="8" fill="#dc2626">★</text>}

        {/* Attack arrows */}
        <path d="M 64 138 L 64 150" stroke="#3b82f6" strokeWidth="1" markerEnd="url(#arrowBlue)" opacity="0.5"/>
        <path d="M 76 129 L 95 129" stroke="#3b82f6" strokeWidth="1" markerEnd="url(#arrowBlue)" opacity="0.5"/>
        <path d="M 176 138 L 176 150" stroke="#ef4444" strokeWidth="1" markerEnd="url(#arrowRed)" opacity="0.5"/>
        <path d="M 164 129 L 145 129" stroke="#ef4444" strokeWidth="1" markerEnd="url(#arrowRed)" opacity="0.5"/>

        {/* Block labels — below court, clear of lines */}
        <text x="64" y="168" textAnchor="middle" fontSize="7" fontWeight="700" fill="#2563eb">{t("left_block")}</text>
        <text x="176" y="168" textAnchor="middle" fontSize="7" fontWeight="700" fill="#dc2626">{t("right_block_label")}</text>

        <defs>
          <marker id="arrowRed" markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto">
            <path d="M0,0 L4,2 L0,4 Z" fill="#ef4444"/>
          </marker>
          <marker id="arrowBlue" markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto">
            <path d="M0,0 L4,2 L0,4 Z" fill="#3b82f6"/>
          </marker>
        </defs>
      </svg>

      {dominant && (
        <p className="text-[11px] text-center font-semibold mt-1">
          <span className={dominant === "Right" ? "text-red-500" : "text-blue-500"}>
            ★ {dominant} {t("hand_dominant")} — {t("prefers")} {dominant === "Right" ? t("right_block") : t("left_block")} ({t("attacks_middle")})
          </span>
        </p>
      )}
    </div>
  );
}

// ─── Quadrant move options (score + pass) ─────────────────────────────────────
const QUADRANT_MOVES = {
  rightBaseline: [
    "Drop Step (Baseline)", "Jump Hook", "Spin Move (Baseline)", "Fadeaway",
    "Baby Hook", "Back Down",
    "— Pass options —", "Pass to cutter", "Kick out to perimeter", "High-low pass",
  ],
  rightMiddle: [
    "Drop Step (Middle)", "Cross Hook", "Up & Under", "Turnaround Jumper",
    "Face-up Drive", "Baby Hook", "Dream Shake",
    "— Pass options —", "Pass to cutter", "Kick out to perimeter", "High-low pass",
  ],
  leftBaseline: [
    "Drop Step (Baseline)", "Jump Hook", "Spin Move (Baseline)", "Fadeaway",
    "Baby Hook", "Back Down",
    "— Pass options —", "Pass to cutter", "Kick out to perimeter", "High-low pass",
  ],
  leftMiddle: [
    "Drop Step (Middle)", "Cross Hook", "Up & Under", "Turnaround Jumper",
    "Face-up Drive", "Baby Hook", "Dream Shake",
    "— Pass options —", "Pass to cutter", "Kick out to perimeter", "High-low pass",
  ],
} as const;

const MOVE_DESC: Record<string, string> = {
  "Drop Step (Baseline)": t("move_desc_drop_step"),
  "Drop Step (Middle)": t("move_desc_drop_step"),
  "Jump Hook": t("move_desc_jump_hook"),
  "Cross Hook": t("move_desc_cross_hook"),
  "Up & Under": t("move_desc_up_under"),
  "Spin Move (Baseline)": "Explosive spin toward the baseline.",
  "Fadeaway": t("move_desc_fadeaway"),
  "Turnaround Jumper": t("move_desc_turnaround"),
  "Face-up Drive": t("move_desc_face_up_drive"),
  "Back Down": t("move_desc_back_down"),
  "Baby Hook": t("move_desc_baby_hook"),
  "Dream Shake": t("move_desc_dream_shake"),
  "Pass to cutter": t("move_desc_pass_cutter"),
  "Kick out to perimeter": t("move_desc_kick_out"),
  "High-low pass": t("move_desc_high_low"),
};

function PostQuadrantSelector({ value, onChange, dominantHand }: {
  value: PostQuadrants; onChange: (v: PostQuadrants) => void; dominantHand?: "Right" | "Left";
}) {
  const quadrants: {
    key: keyof PostQuadrants; label: string; side: "right" | "left"; dir: "baseline" | "middle";
  }[] = [
    { key: "rightBaseline", label: t("block_right_baseline"), side: "right", dir: "baseline" },
    { key: "rightMiddle",   label: t("block_right_middle"),   side: "right", dir: "middle"   },
    { key: "leftBaseline",  label: t("block_left_baseline"),  side: "left",  dir: "baseline" },
    { key: "leftMiddle",    label: t("block_left_middle"),    side: "left",  dir: "middle"   },
  ];

  const updateQ = (key: keyof PostQuadrants, moveName: string | null) =>
    onChange({ ...value, [key]: moveName ? { moveName } : undefined });

  return (
    <div className="space-y-3">
      <FieldLabel
        label={t("post_moves_quadrant")}
        tooltip={`${t("hint_post_quadrant")} ${t("hint_motor_post_moves_quadrant")}`}
      />
      <HalfCourtDiagram dominant={dominantHand} />
      <div className="grid grid-cols-2 gap-2">
        {quadrants.map(q => {
          const current = value[q.key];
          const moves = QUADRANT_MOVES[q.key];
          const isRight = q.side === "right";
          const isStrongSide = dominantHand === "Right" ? isRight : !isRight;
          const borderColor = isRight
            ? current ? "border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/20"
                      : "border-red-100 dark:border-red-900/30 bg-white dark:bg-slate-900"
            : current ? "border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20"
                      : "border-blue-100 dark:border-blue-900/30 bg-white dark:bg-slate-900";
          const labelColor = isRight ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400";

          return (
            <div key={q.key} className={`rounded-xl border p-2.5 space-y-2 transition-all ${borderColor}`}>
              <div className="flex items-center justify-between gap-1">
                <p className={`text-[11px] font-bold leading-tight ${labelColor}`}>
                  {q.label}
                  {isStrongSide && dominantHand && <span className="ml-1">★</span>}
                </p>
                {current && (
                  <button type="button" onClick={() => updateQ(q.key, null)} className="text-slate-400 hover:text-red-400 shrink-0">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <Select
                value={current?.moveName ?? "none"}
                onValueChange={v => updateQ(q.key, v === "none" || v.startsWith("—") ? null : v)}
              >
                <SelectTrigger className={`h-8 rounded-lg text-xs border ${isRight ? "border-red-200 dark:border-red-900 text-red-700 dark:text-red-300" : "border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300"} bg-white dark:bg-slate-800`}>
                  <SelectValue placeholder="Not observed" />
                </SelectTrigger>
                <SelectContent className="z-[100] max-h-64">
                  <SelectItem value="none"><span className="text-slate-400 text-xs">{t("not_observed")}</span></SelectItem>
                  {moves.map(move => {
                    if (move.startsWith("—")) {
                      return (
                        <div key={move} className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 border-t border-slate-100 dark:border-slate-800 mt-1 pt-2">
                          Pass options
                        </div>
                      );
                    }
                    return (
                      <SelectItem key={move} value={move}>
                        <div className="flex flex-col py-0.5">
                          <span className="font-semibold text-xs">{move}</span>
                          {MOVE_DESC[move] && (
                            <span className="text-[10px] text-slate-400 leading-tight">{MOVE_DESC[move]}</span>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Screener action selector ─────────────────────────────────────────────────
// SCREENER_OPTIONS uses static t() (no hook) — safe outside component
// To translate desc strings, add hint_screen_* keys to i18n.ts
const getScreenerOptions = () => [
  { value: "Roll" as ScreenerAction,              label: t("opt_screen_roll"),       desc: t("screen_desc_roll") },
  { value: "Pop" as ScreenerAction,               label: t("opt_screen_pop"),        desc: t("screen_desc_pop") },
  { value: "Pop (Elbow / Mid)" as ScreenerAction, label: t("opt_screen_pop_elbow"),  desc: t("screen_desc_pop_elbow") },
  { value: "Short Roll" as ScreenerAction,        label: t("opt_screen_short_roll"), desc: t("screen_desc_short_roll") },
  { value: "Slip" as ScreenerAction,              label: t("opt_screen_slip"),       desc: t("screen_desc_slip") },
  { value: "Lob Only" as ScreenerAction,          label: t("opt_screen_lob"),        desc: t("screen_desc_lob") },
];

function ScreenerActionSelector({ primaryValue, secondaryValue, onPrimaryChange, onSecondaryChange }: {
  primaryValue: ScreenerAction; secondaryValue?: ScreenerAction;
  onPrimaryChange: (v: ScreenerAction) => void;
  onSecondaryChange: (v: ScreenerAction | undefined) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <FieldLabel label={t("pnr_screener_action")} tooltip={t("hint_screener_primary")} />
        <div className="space-y-1.5">
          {getScreenerOptions().map(opt => (
            <button key={opt.value} type="button"
              className={`w-full text-left p-2.5 rounded-xl border transition-all ${primaryValue === opt.value ? "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/20" : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900"}`}
              onClick={() => onPrimaryChange(opt.value)}>
              <div className="flex items-start gap-2.5">
                <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${primaryValue === opt.value ? "bg-blue-500 border-blue-500" : "border-slate-300 dark:border-slate-600"}`}>
                  {primaryValue === opt.value && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <div>
                  <p className={`font-bold text-xs ${primaryValue === opt.value ? "text-blue-700 dark:text-blue-300" : "text-slate-800 dark:text-slate-200"}`}>{opt.label}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
        <FieldLabel label={t("pnr_screener_action_secondary")} tooltip={t("hint_screener_secondary")} />
        <Select value={secondaryValue ?? "none"} onValueChange={v => onSecondaryChange(v === "none" ? undefined : v as ScreenerAction)}>
          <SelectTrigger className="h-10 rounded-xl bg-slate-50 dark:bg-slate-950/50 dark:border-slate-800 text-sm"><SelectValue placeholder="None" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("opt_screen_none")}</SelectItem>
            {getScreenerOptions().filter(o => o.value !== primaryValue).map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function PlayerEditor() {
  const { t } = useLocale();  const [, params] = useRoute("/coach/player/:id");
  const [, setLocation] = useLocation();
  const search = useSearch();
  const isNew = params?.id === "new";
  const urlPlayerId = params?.id || "";
  const searchTeamId = new URLSearchParams(search).get("team") || "";

  // After first create, store the real ID here — all subsequent saves use update
  const createdIdRef = useRef<string | null>(null);
  const getPlayerId = () => createdIdRef.current || urlPlayerId;
  const isSaving = useRef(false); // Guard against concurrent saves

  const { data: teams = [], isLoading: teamsLoading } = useTeams();
  const { data: existingPlayer, isLoading: playerLoading } = usePlayer(isNew ? "" : urlPlayerId);
  const createPlayerMutation = useCreatePlayer();
  const updatePlayerMutation = useUpdatePlayer();
  const deletePlayerMutation = useDeletePlayer();

  const [player, setPlayer] = useState<Omit<PlayerProfile, "id"> & { id?: string } | null>(null);
  const [inputs, setInputs] = useState<PlayerInput | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [showSaveFlash, setShowSaveFlash] = useState(false);
  const [screenerAccordionOpen, setScreenerAccordionOpen] = useState(true);
  const [cutterAccordionOpen, setCutterAccordionOpen] = useState(true);
  const [personalityAccordionOpen, setPersonalityAccordionOpen] = useState(false);
  const isDirty = useRef(false);

  useEffect(() => {
    if (!isNew || teamsLoading || teams.length === 0) return;
    const tid = searchTeamId || teams[0].id;
    const defaultP = createDefaultPlayer(tid);
    setPlayer(defaultP);
    setInputs(defaultP.inputs);
  }, [isNew, teamsLoading, teams.length]);

  useEffect(() => {
    if (!isNew && existingPlayer) {
      let ins = existingPlayer.inputs;
      if (ins.isoWeakHandFinish == null && ins.isoOppositeFinish) {
        const h = legacyOppositeToIsoWeakFinish(ins.isoOppositeFinish);
        if (h) ins = { ...ins, isoWeakHandFinish: h };
      }
      if (ins.offBallScreenPattern == null && ins.screenerAction) {
        const p = legacyScreenerToScreenPattern(ins.screenerAction);
        if (p) ins = { ...ins, offBallScreenPattern: p };
      }
      setPlayer(existingPlayer);
      setInputs(ins);
    } else if (!isNew && !playerLoading && !existingPlayer) setLocation("/coach");
  }, [isNew, existingPlayer, playerLoading]);

  // Auto-save on change after 1.5s debounce
  // KEY FIX: after first create, switch to update mode using createdIdRef
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerAutoSave = (currentPlayer: typeof player, currentInputs: PlayerInput) => {
    if (!currentPlayer || !currentInputs) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      if (isSaving.current) return; // prevent concurrent saves
      isSaving.current = true;
      const finalName = currentPlayer.name.trim() || "Unnamed Player";
      const generated = generateProfile(currentInputs, currentPlayer?.name);
      const updated = { ...currentPlayer, name: finalName, inputs: currentInputs, internalModel: generated.internalModel, archetype: generated.archetype, subArchetype: generated.subArchetype, keyTraits: generated.keyTraits, defensivePlan: generated.defensivePlan };
      const currentId = getPlayerId();
      if (!currentId || currentId === "new") {
        // First save — create new player
        createPlayerMutation.mutate(updated as Omit<PlayerProfile, "id">, {
          onSuccess: (created: PlayerProfile) => {
            createdIdRef.current = created.id; // flip to update mode
            isSaving.current = false;
          },
          onError: () => { isSaving.current = false; },
        });
      } else {
        // Subsequent saves — always update
        updatePlayerMutation.mutate({ id: currentId, updates: updated }, {
          onSuccess: () => { isSaving.current = false; },
          onError: () => { isSaving.current = false; },
        });
      }
      setDraftSaved(true);
      setTimeout(() => setDraftSaved(false), 2000);
      isDirty.current = false;
    }, 1500);
  };

  const isDataLoading = isNew ? teamsLoading : playerLoading;
  if (isDataLoading || !player || !inputs) {
    return (
      <div className="flex flex-col min-h-[100dvh] bg-slate-50 dark:bg-slate-950 items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const handleSave = async () => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    const finalName = player.name.trim() || "Unnamed Player";
    const generated = generateProfile(inputs, finalName);
    const updated = {
      ...player, name: finalName, inputs,
      internalModel: generated.internalModel,
      archetype: generated.archetype,
      subArchetype: generated.subArchetype,
      keyTraits: generated.keyTraits,
      defensivePlan: generated.defensivePlan,
    };
    setShowSaveFlash(true);
    try {
      const currentId = getPlayerId();
      if (!currentId || currentId === "new") {
        const created = await createPlayerMutation.mutateAsync(
          updated as Omit<PlayerProfile, "id">
        );
        createdIdRef.current = created.id;
      } else {
        await updatePlayerMutation.mutateAsync({ id: currentId, updates: updated });
      }
    } catch {
      // save failed — flash will still dismiss
    }
    setTimeout(() => { setShowSaveFlash(false); setLocation("/coach"); }, 600);
  };

  const ui = (key: keyof PlayerInput, value: any) => {
    setInputs(prev => {
      if (!prev) return prev;
      const next = { ...prev, [key]: value };
      isDirty.current = true;
      triggerAutoSave(player, next);
      return next;
    });
  };
  const um = (key: keyof PlayerProfile, value: string) => {
    setPlayer(prev => {
      if (!prev) return prev;
      const next = { ...prev, [key]: value };
      isDirty.current = true;
      triggerAutoSave(next, inputs);
      return next;
    });
  };

  const postActive = inputs.postFrequency === "Primary" || inputs.postFrequency === "Secondary";
  const isActiveFreq = (f: string) => f === "Primary" || f === "Secondary";
  const isInterior = ["C", "PF"].includes(inputs.position);
  const isHybridBig = isInterior && (inputs.isoFrequency === "Primary" || inputs.isoFrequency === "Secondary");
  const pnrBoth = (inputs.pnrRole as any) === "Both";
  const showHandlerSection = inputs.pnrRole === "Handler" || pnrBoth;
  const showScreenerSection = inputs.pnrRole === "Screener" || pnrBoth;
  const showOffBallScreenerAccordion = inputs.offBallRole === "screener" || inputs.offBallRole === "both";
  const showOffBallCutterAccordion = inputs.offBallRole === "cutter" || inputs.offBallRole === "both";

  const qualifiesTransFinishing = (
    role: PlayerInput["transRolePrimary"] | PlayerInput["transRoleSecondary"],
    sub: PlayerInput["transSubPrimary"] | PlayerInput["transSubSecondary"],
  ) => {
    if (role === "rim_runner") return true;
    if (role === "runner" && (sub === "cut_to_rim" || sub === "both")) return true;
    if (role === "pusher" && sub === "dribble_push") return true;
    if (role === "trail" && sub === "cut") return true;
    return false;
  };
  const showTransFinishing =
    qualifiesTransFinishing(inputs.transRolePrimary ?? null, inputs.transSubPrimary ?? null) ||
    qualifiesTransFinishing(inputs.transRoleSecondary ?? null, inputs.transSubSecondary ?? null);

  return (
    <div className="flex flex-col min-h-[100dvh] bg-slate-50 dark:bg-slate-950">
      {/* Save flash — small elegant "U saving" badge */}
      {showSaveFlash && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] pointer-events-none">
          <div className="flex flex-col items-center gap-1 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-900/90 dark:bg-white/90 backdrop-blur-md rounded-2xl px-6 py-4 shadow-2xl border border-white/10 flex flex-col items-center gap-2">
              <span className="text-4xl font-black italic text-white dark:text-slate-900 leading-none tracking-tighter">U</span>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60 dark:text-slate-900/60">{t("saving")}</span>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (isNew) {
                setLocation("/coach/editor");
              } else {
                setLocation(`/coach/player/${getPlayerId()}/profile?mode=review`);
              }
            }}
            className="-ml-2"
            data-testid="player-editor-back"
          >
            <ArrowLeft className="w-5 h-5 text-slate-700 dark:text-slate-300" />
          </Button>
          <div className="flex items-center gap-2">
            {isRealPhoto(player.imageUrl) ? (
              <img src={player.imageUrl} alt="" className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700" />
            ) : (
              <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0 flex items-center justify-center bg-slate-100 dark:bg-slate-800">
                <BasketballPlaceholderAvatar size={32} />
              </div>
            )}
            <div>
              <h1 className="font-bold text-sm leading-tight text-slate-900 dark:text-white line-clamp-1 max-w-[120px]">{player.name || "New Player"}</h1>
              <div className="flex items-center gap-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{isNew ? t("create") : t("edit")}</p>
                {draftSaved && (
                  <span className="flex items-center gap-0.5 text-[10px] text-emerald-500 font-bold animate-in fade-in">
                    <Check className="w-2.5 h-2.5" /> Saved
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isNew && (confirmDelete ? (
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)} className="text-xs h-8 px-2 text-slate-500">{t("cancel")}</Button>
              <Button size="sm" onClick={() => {
              const id = getPlayerId();
              setLocation("/coach");
              if (id && id !== "new") {
                setTimeout(() => deletePlayerMutation.mutate(id), 150);
              }
            }} className="rounded-full h-8 px-3 font-bold bg-red-500 hover:bg-red-600 text-white text-xs">{t("delete")}</Button>
            </div>
          ) : (
            <Button size="icon" variant="ghost" onClick={() => setConfirmDelete(true)} className="text-slate-400 hover:text-red-500">
              <Trash2 className="w-4 h-4" />
            </Button>
          ))}
          <Button size="sm" onClick={handleSave} className="rounded-full px-5 font-bold bg-primary hover:bg-primary/90 text-white shadow-md">
            <Save className="w-4 h-4 mr-1.5" /> {t("save")}
          </Button>
        </div>
      </header>

      <main className="flex-1 p-4 pb-24">
        <Tabs defaultValue="context" className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-6 p-1 bg-slate-200/60 dark:bg-slate-800/60 rounded-xl shadow-inner">
            <TabsTrigger value="context" className="rounded-lg text-[10px] sm:text-xs font-bold py-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm text-slate-600 dark:text-slate-400 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white">
              <Info className="w-3 h-3 sm:w-4 sm:h-4 md:mr-1" /><span className="hidden md:inline">{t("tab_context")}</span>
            </TabsTrigger>
            <TabsTrigger value="post" className="rounded-lg text-[10px] sm:text-xs font-bold py-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm text-slate-600 dark:text-slate-400 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400">
              <svg className="w-3 h-3 sm:w-4 sm:h-4 md:mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 22h14"/><path d="M5 2h14"/><path d="M12 2v20"/><path d="M9 10h6"/><path d="M9 14h6"/></svg>
              <span className="hidden md:inline">{t("tab_post")}</span>
            </TabsTrigger>
            <TabsTrigger value="iso" className="rounded-lg text-[10px] sm:text-xs font-bold py-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm text-slate-600 dark:text-slate-400 data-[state=active]:text-orange-600 dark:data-[state=active]:text-orange-400">
              <Flame className="w-3 h-3 sm:w-4 sm:h-4 md:mr-1" /><span className="hidden md:inline">{t("tab_iso")}</span>
            </TabsTrigger>
            <TabsTrigger value="pnr" className="rounded-lg text-[10px] sm:text-xs font-bold py-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm text-slate-600 dark:text-slate-400 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400">
              <Zap className="w-3 h-3 sm:w-4 sm:h-4 md:mr-1" /><span className="hidden md:inline">{t("tab_pnr")}</span>
            </TabsTrigger>
            <TabsTrigger value="offball" className="rounded-lg text-[10px] sm:text-xs font-bold py-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm text-slate-600 dark:text-slate-400 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400">
              <Target className="w-3 h-3 sm:w-4 sm:h-4 md:mr-1" /><span className="hidden md:inline">{t("tab_offball")}</span>
            </TabsTrigger>
          </TabsList>

          {/* ── CONTEXT ── */}
          <TabsContent value="context" className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 space-y-4 border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="font-bold text-lg flex items-center gap-2 text-slate-900 dark:text-white"><Info className="w-5 h-5 text-primary" /> {t("identity")}</h3>
              <PlayerAvatarUpload imageUrl={player.imageUrl} onUpload={url => um("imageUrl", url)} />
              <div className="space-y-1.5">
                <FieldLabel label={t("player_name")} />
                <div className="flex gap-2 items-stretch">
                  <Input
                    value={player.name}
                    onChange={e => um("name", e.target.value)}
                    placeholder="e.g. Jane Doe"
                    className="flex-1 min-w-0 bg-slate-50 dark:bg-slate-950/50 h-12 rounded-xl dark:border-slate-800"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-12 w-12 shrink-0 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                    title={t("editor.star_player")}
                    aria-label={t("editor.star_player")}
                    aria-pressed={inputs.starPlayer === true}
                    onClick={() => ui("starPlayer", inputs.starPlayer !== true)}
                  >
                    <Star
                      className={`w-6 h-6 ${inputs.starPlayer === true ? "fill-amber-400 text-amber-400" : "text-slate-400 fill-none"}`}
                      strokeWidth={inputs.starPlayer === true ? 0 : 1.5}
                    />
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <FieldLabel label={t("team")} />
                <Select value={player.teamId} onValueChange={v => setPlayer(prev => prev ? { ...prev, teamId: v } : prev)} disabled={teams.length < 2}>
                  <SelectTrigger className="h-12 rounded-xl bg-slate-50 dark:bg-slate-950/50 dark:border-slate-800"><SelectValue /></SelectTrigger>
                  <SelectContent>{teams.map(t => <SelectItem key={t.id} value={t.id}>{t.logo} {t.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <FieldLabel label={t("number")} />
                  <Input value={player.number} onChange={e => um("number", e.target.value)} placeholder="e.g. 23" className="bg-slate-50 dark:bg-slate-950/50 h-12 rounded-xl dark:border-slate-800" />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel label={t("position")} tooltip={t("hint_position")} />
                  <div className="flex flex-wrap" style={{ flexWrap: "wrap", gap: 12 }}>
                    {(["PG","SG","SF","PF","C"] as const).map(pos => {
                      const current = inputs.position ?? "";
                      const parts = current.split("/").filter(Boolean);
                      const selected = parts.includes(pos);
                      return (
                        <button key={pos} type="button"
                          style={{ minHeight: 44 }}
                          onClick={() => {
                            if (selected) {
                              const next = parts.filter(p => p !== pos).join("/");
                              ui("position", next || pos);
                            } else {
                              const next = parts.length === 0 ? pos : parts.length === 1 ? `${parts[0]}/${pos}` : `${parts[0]}/${pos}`;
                              ui("position", next);
                            }
                          }}
                          className={`inline-flex min-h-11 min-w-11 items-center justify-center px-4 py-2 rounded-xl text-sm font-bold border transition-all ${selected ? "bg-primary border-primary text-white" : "bg-transparent border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-primary/50"}`}>
                          {pos}
                        </button>
                      );
                    })}
                  </div>
                  {inputs.position && inputs.position.includes("/") && (
                    <p className="text-xs text-primary font-semibold">{t("hybrid_detection_active").replace("{position}", inputs.position)}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <FieldLabel label={t("height")} />
                  <Input
                    value={inputs.height}
                    onChange={e => ui("height", e.target.value)}
                    onFocus={e => { if (!e.target.value || e.target.value === "183 cm") { ui("height", ""); } }}
                    placeholder="e.g. 195 cm"
                    className="bg-slate-50 dark:bg-slate-950/50 h-12 rounded-xl dark:border-slate-800" />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel label={t("weight")} />
                  <Input
                    value={inputs.weight}
                    onChange={e => ui("weight", e.target.value)}
                    onFocus={e => { if (!e.target.value || e.target.value === "82 kg") { ui("weight", ""); } }}
                    placeholder="e.g. 95 kg"
                    className="bg-slate-50 dark:bg-slate-950/50 h-12 rounded-xl dark:border-slate-800" />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 space-y-5 border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="font-bold text-lg flex items-center gap-2 text-slate-900 dark:text-white">💪 {t("physical_profile")}</h3>
              <PowerBar label={t("athleticism")} value={inputs.athleticism} onChange={v => ui("athleticism", v)}
                tooltip={t("hint_athleticism")} />
              <PowerBar label={t("physical_strength")} value={inputs.physicalStrength} onChange={v => ui("physicalStrength", v)}
                tooltip={t("hint_physical_strength")} />
              <PowerBar label={t("court_vision")} value={inputs.courtVision ?? 3} onChange={v => ui("courtVision", v)} color="green"
                tooltip={t("hint_court_vision")} />
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 space-y-5 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-0.5">
                <h3 className="font-bold text-lg flex items-center gap-2 text-slate-900 dark:text-white">🏀 {t("editor.ball_handling")}</h3>
                <Tooltip text={t("editor.ball_handling_hint")} />
              </div>
              <div className="space-y-2">
                <FieldLabel label={t("editor.ball_handling")} tooltip={t("editor.ball_handling_hint")} />
                <Select
                  value={inputs.motorBallHandling ?? "__none__"}
                  onValueChange={(v) => ui("motorBallHandling", v === "__none__" ? null : (v as NonNullable<PlayerInput["motorBallHandling"]>))}
                >
                  <SelectTrigger className="h-12 rounded-xl bg-slate-50 dark:bg-slate-950/50 dark:border-slate-800">
                    <SelectValue placeholder={t("editor.ball_handling")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t("not_observed")}</SelectItem>
                    <SelectItem value="elite">{t("editor.ball_handling.elite")}</SelectItem>
                    <SelectItem value="capable">{t("editor.ball_handling.capable")}</SelectItem>
                    <SelectItem value="limited">{t("editor.ball_handling.limited")}</SelectItem>
                    <SelectItem value="liability">{t("editor.ball_handling.liability")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <FieldLabel label={t("editor.pressure_response")} tooltip={t("hint_motor_pressure")} />
                <Select
                  value={inputs.motorPressureResponse ?? "__none__"}
                  onValueChange={(v) => ui("motorPressureResponse", v === "__none__" ? null : (v as NonNullable<PlayerInput["motorPressureResponse"]>))}
                >
                  <SelectTrigger className="h-12 rounded-xl bg-slate-50 dark:bg-slate-950/50 dark:border-slate-800">
                    <SelectValue placeholder={t("editor.pressure_response")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t("not_observed")}</SelectItem>
                    <SelectItem value="breaks">{t("editor.pressure.breaks")}</SelectItem>
                    <SelectItem value="escapes">{t("editor.pressure.escapes")}</SelectItem>
                    <SelectItem value="struggles">{t("editor.pressure.struggles")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 space-y-5 border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="font-bold text-lg flex items-center gap-2 text-slate-900 dark:text-white">🎯 {t("free_throws_fouling")}</h3>
              <PowerBar
                label={t("ft_shooting")}
                value={(inputs as any).ftShooting ?? 3}
                onChange={v => ui("ftShooting" as any, v)}
                color="green"
                tooltip={t("hint_ft_shooting")}
              />
              <PowerBar
                label={t("foul_drawing")}
                value={(inputs as any).foulDrawing ?? 2}
                onChange={v => ui("foulDrawing" as any, v)}
                color="amber"
                tooltip={t("hint_foul_drawing")}
              />
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div
                className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setPersonalityAccordionOpen((o) => !o)}
                  className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                >
                  <span className="font-medium text-sm text-slate-900 dark:text-white">{t("editor.personality")}</span>
                  <ChevronDown
                    className={`w-4 h-4 shrink-0 text-slate-500 transition-transform duration-200 ${personalityAccordionOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {personalityAccordionOpen && (
                  <div className="px-4 pb-4 pt-0 flex flex-col gap-3">
                    <div className="flex flex-wrap" style={{ flexWrap: "wrap", gap: 12 }}>
                      {PERSONALITY_TRAITS.filter((pt) => pt.tone === "positive").map((pt) => {
                        const active = (inputs.personality ?? []).includes(pt.id);
                        return (
                          <Button
                            key={pt.id}
                            type="button"
                            variant={active ? "default" : "outline"}
                            style={{ minHeight: 44 }}
                            className={`h-auto min-h-11 px-4 py-2 rounded-lg text-sm font-semibold ${
                              active
                                ? "bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-600 hover:text-white"
                                : "border-slate-200 dark:border-slate-700"
                            }`}
                            onClick={() => {
                              const list = inputs.personality ?? [];
                              const next = list.includes(pt.id)
                                ? list.filter((x) => x !== pt.id)
                                : [...list, pt.id];
                              ui("personality", next.length === 0 ? null : next);
                            }}
                          >
                            {t(pt.i18nKey as never)}
                          </Button>
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap" style={{ flexWrap: "wrap", gap: 12 }}>
                      {PERSONALITY_TRAITS.filter((pt) => pt.tone === "negative").map((pt) => {
                        const active = (inputs.personality ?? []).includes(pt.id);
                        return (
                          <Button
                            key={pt.id}
                            type="button"
                            variant={active ? "default" : "outline"}
                            style={{ minHeight: 44 }}
                            className={`h-auto min-h-11 px-4 py-2 rounded-lg text-sm font-semibold ${
                              active
                                ? "bg-amber-500 border-amber-500 text-white hover:bg-amber-500 hover:text-white dark:bg-amber-600 dark:border-amber-600 dark:hover:bg-amber-600"
                                : "border-slate-200 dark:border-slate-700"
                            }`}
                            onClick={() => {
                              const list = inputs.personality ?? [];
                              const next = list.includes(pt.id)
                                ? list.filter((x) => x !== pt.id)
                                : [...list, pt.id];
                              ui("personality", next.length === 0 ? null : next);
                            }}
                          >
                            {t(pt.i18nKey as never)}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ── POST ── */}
          <TabsContent value="post" className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 space-y-5 border border-slate-200 dark:border-slate-800 shadow-sm border-l-4 border-l-purple-500">
              <h3 className="font-bold text-lg flex items-center gap-2 text-slate-900 dark:text-white">
                <svg className="w-5 h-5 text-purple-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 22h14"/><path d="M5 2h14"/><path d="M12 2v20"/><path d="M9 10h6"/><path d="M9 14h6"/></svg>
                {t("section_post")}
              </h3>

              <IntensitySelector label={t("post_frequency")} value={inputs.postFrequency} onChange={v => ui("postFrequency", v)}
                tooltip={t("hint_post_frequency")} />

              {postActive && (<>
                <div className="space-y-2">
                  <FieldLabel label={t("post_dominant_hand")} tooltip={t("hint_post_dominant_hand")} />
                  <div className="flex flex-wrap" style={{ flexWrap: "wrap", gap: 12 }}>
                    {(["Right", "Left"] as const).map(h => (
                      <Button key={h} type="button" variant={inputs.postDominantHand === h ? "default" : "outline"}
                        style={{ minHeight: 44 }}
                        className={`h-auto min-h-11 min-w-11 flex-1 px-4 rounded-xl text-sm font-bold ${inputs.postDominantHand === h ? "bg-purple-500 border-purple-500 text-white" : "bg-transparent border-slate-200 dark:border-slate-700 dark:text-slate-300"}`}
                        onClick={() => ui("postDominantHand", h)}>
                        {h === "Right" ? `🤜 ${t("right_hand")}` : `🤛 ${t("left_hand")}`}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <FieldLabel label={t("post_profile")} tooltip={t("hint_post_profile")} />
                  <Select value={inputs.postProfile ?? "Back to Basket"} onValueChange={v => ui("postProfile", v)}>
                    <SelectTrigger className="h-12 rounded-xl bg-slate-50 dark:bg-slate-950/50 dark:border-slate-800"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Back to Basket">{t("opt_post_back_to_basket")}</SelectItem>
                      <SelectItem value="Face-Up">{t("opt_post_face_up")}</SelectItem>
                      <SelectItem value="Mixed">{t("opt_post_mixed")}</SelectItem>
                      <SelectItem value="High Post">{t("opt_post_high_post")}</SelectItem>
                      <SelectItem value="Stretch Big">{t("opt_post_stretch")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <FieldLabel label={t("post_profile_secondary")} tooltip={t("hint_post_profile_secondary")} />
                  <Select
                    value={inputs.postProfileSecondary ?? "__none__"}
                    onValueChange={(v) => ui("postProfileSecondary", v === "__none__" ? null : (v as PlayerInput["postProfile"]))}
                  >
                    <SelectTrigger className="h-12 rounded-xl bg-slate-50 dark:bg-slate-950/50 dark:border-slate-800">
                      <SelectValue placeholder={t("not_observed")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{t("not_observed")}</SelectItem>
                      <SelectItem value="Back to Basket">{t("opt_post_back_to_basket")}</SelectItem>
                      <SelectItem value="Face-Up">{t("opt_post_face_up")}</SelectItem>
                      <SelectItem value="Mixed">{t("opt_post_mixed")}</SelectItem>
                      <SelectItem value="High Post">{t("opt_post_high_post")}</SelectItem>
                      <SelectItem value="Stretch Big">{t("opt_post_stretch")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <PostQuadrantSelector
                  value={inputs.postQuadrants ?? {}}
                  onChange={v => ui("postQuadrants", v)}
                  dominantHand={inputs.postDominantHand}
                />

                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{t("editor.high_post_zones")}</p>
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      { zone: "leftElbow" as const, labelKey: "editor.high_post_zone.leftElbow" },
                      { zone: "rightElbow" as const, labelKey: "editor.high_post_zone.rightElbow" },
                    ] as const).map(({ zone, labelKey }) => {
                      const hz = (inputs.highPostZones ?? {}) as HighPostZonesMotor;
                      const v = hz[zone] ?? null;
                      return (
                        <div key={zone} className="rounded-xl border border-purple-200/60 dark:border-purple-900/50 bg-purple-50/40 dark:bg-purple-950/20 p-2.5 space-y-2">
                          <Label className="text-[11px] font-bold uppercase tracking-wide text-purple-700 dark:text-purple-300">{t(labelKey as never)}</Label>
                          <Select
                            value={v ?? "__none__"}
                            onValueChange={(val) => {
                              const next: HighPostZonesMotor = { ...(inputs.highPostZones ?? {}) };
                              if (val === "__none__") delete next[zone];
                              else next[zone] = val as HighPostAction;
                              ui("highPostZones", Object.keys(next).length ? next : {});
                            }}
                          >
                            <SelectTrigger className="h-10 rounded-xl bg-white dark:bg-slate-900 dark:border-slate-800 text-xs">
                              <SelectValue placeholder={t("not_observed")} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">{t("not_observed")}</SelectItem>
                              <SelectItem value="face_up_drive">{t("editor.high_post_action.face_up_drive")}</SelectItem>
                              <SelectItem value="pull_up">{t("editor.high_post_action.pull_up")}</SelectItem>
                              <SelectItem value="pass_to_cutter">{t("editor.high_post_action.pass_to_cutter")}</SelectItem>
                              <SelectItem value="step_back">{t("editor.high_post_action.step_back")}</SelectItem>
                              <SelectItem value="post_up_down">{t("editor.high_post_action.post_up_down")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <FieldLabel label={t("editor.dunker_spot")} tooltip={t("editor.dunker_spot_hint")} />
                  <div className="flex flex-wrap" style={{ flexWrap: "wrap", gap: 12 }}>
                    {(
                      [
                        { v: 0 as const, labelKey: "editor.dunker_spot_0" },
                        { v: 1 as const, labelKey: "editor.dunker_spot_1" },
                        { v: 2 as const, labelKey: "editor.dunker_spot_2" },
                      ] as const
                    ).map(({ v, labelKey }) => (
                      <Button
                        key={v}
                        type="button"
                        variant={inputs.dunkerSpot === v ? "default" : "outline"}
                        style={{ minHeight: 44 }}
                        className={`h-auto min-h-11 min-w-11 flex-1 px-4 rounded-xl text-sm font-bold ${
                          inputs.dunkerSpot === v
                            ? "bg-purple-500 border-purple-500 text-white"
                            : "bg-transparent border-slate-200 dark:border-slate-700 dark:text-slate-300"
                        }`}
                        onClick={() =>
                          ui("dunkerSpot", inputs.dunkerSpot === v ? null : v)
                        }
                      >
                        {t(labelKey as never)}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <FieldLabel label={t("editor.post_eff")} tooltip={t("hint_motor_post_eff")} />
                  <Select
                    value={inputs.motorPostEff ?? "__none__"}
                    onValueChange={(v) => ui("motorPostEff", v === "__none__" ? null : v as PlayerInput["motorPostEff"])}
                  >
                    <SelectTrigger className="h-12 rounded-xl bg-slate-50 dark:bg-slate-950/50 dark:border-slate-800">
                      <SelectValue placeholder={t("editor.post_eff")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{t("not_observed")}</SelectItem>
                      <SelectItem value="high">{t("editor.eff.high")}</SelectItem>
                      <SelectItem value="medium">{t("editor.eff.medium")}</SelectItem>
                      <SelectItem value="low">{t("editor.eff.low")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <FieldLabel label={t("editor.post_entry")} tooltip={t("hint_motor_post_entry")} />
                  <Select
                    value={inputs.motorPostEntry ?? "__none__"}
                    onValueChange={(v) => ui("motorPostEntry", v === "__none__" ? null : v as PlayerInput["motorPostEntry"])}
                  >
                    <SelectTrigger className="h-12 rounded-xl bg-slate-50 dark:bg-slate-950/50 dark:border-slate-800">
                      <SelectValue placeholder={t("editor.post_entry")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{t("not_observed")}</SelectItem>
                      <SelectItem value="pass">{t("editor.post_entry.pass")}</SelectItem>
                      <SelectItem value="duck_in">{t("editor.post_entry.duck_in")}</SelectItem>
                      <SelectItem value="seal">{t("editor.post_entry.seal")}</SelectItem>
                      <SelectItem value="flash">{t("editor.post_entry.flash")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <FieldLabel label={t("editor.post_entry_secondary")} tooltip={t("hint_motor_post_entry_secondary")} />
                  <Select
                    value={inputs.motorPostEntrySecondary ?? "__none__"}
                    onValueChange={(v) => ui("motorPostEntrySecondary", v === "__none__" ? null : v as PlayerInput["motorPostEntrySecondary"])}
                  >
                    <SelectTrigger className="h-12 rounded-xl bg-slate-50 dark:bg-slate-950/50 dark:border-slate-800">
                      <SelectValue placeholder={t("not_observed")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{t("not_observed")}</SelectItem>
                      <SelectItem value="pass">{t("editor.post_entry.pass")}</SelectItem>
                      <SelectItem value="duck_in">{t("editor.post_entry.duck_in")}</SelectItem>
                      <SelectItem value="seal">{t("editor.post_entry.seal")}</SelectItem>
                      <SelectItem value="flash">{t("editor.post_entry.flash")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <FieldLabel label={t("post_double_team")} tooltip={t("hint_post_double_team")} />
                  <Select value={inputs.postDoubleTeamReaction ?? "Kicks Out"} onValueChange={v => ui("postDoubleTeamReaction", v)}>
                    <SelectTrigger className="h-12 rounded-xl bg-slate-50 dark:bg-slate-950/50 dark:border-slate-800"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Forces Through">{t("opt_dt_forces_through")}</SelectItem>
                      <SelectItem value="Kicks Out">{t("opt_dt_kicks_out")}</SelectItem>
                      <SelectItem value="Resets">{t("opt_dt_resets")}</SelectItem>
                      <SelectItem value="Mixed">{t("opt_dt_variable")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>)}
            </div>
          </TabsContent>

          {/* ── ISO ── */}
          <TabsContent value="iso" className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 space-y-5 border border-slate-200 dark:border-slate-800 shadow-sm border-l-4 border-l-orange-500">
              <h3 className="font-bold text-lg flex items-center gap-2 text-slate-900 dark:text-white"><Flame className="w-5 h-5 text-orange-500" /> {t("section_iso")}</h3>

              <IntensitySelector label={t("iso_frequency")} value={inputs.isoFrequency} onChange={v => ui("isoFrequency", v)}
                tooltip={t("hint_iso_frequency")} />

              {inputs.isoFrequency !== "Never" && (
                <>
                  {isInterior && (
                    <div className="flex gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-800">
                      <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                        {t("iso_perimeter_note")}
                      </p>
                    </div>
                  )}

                  {/* Interior ISO style — only for pure interior (not hybrid) */}
                  {isInterior && !isHybridBig && (
                    <div className="p-3 bg-purple-50 dark:bg-purple-950/20 rounded-xl border border-purple-200 dark:border-purple-800 space-y-2">
                      <FieldLabel label="Interior ISO style" tooltip={t("hint_iso_interior_style")} />
                      <Select value={inputs.postIsoAction ?? "Mixed"} onValueChange={v => ui("postIsoAction", v)}>
                        <SelectTrigger className="h-12 rounded-xl bg-white dark:bg-slate-900 dark:border-slate-800"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Back Down">{t("opt_iso_interior_back_down")}</SelectItem>
                          <SelectItem value="Face-Up Drive">{t("opt_iso_interior_face_up_drive")}</SelectItem>
                          <SelectItem value="Post Jumper">{t("opt_iso_interior_post_jumper")}</SelectItem>
                          <SelectItem value="Turnaround">{t("opt_iso_interior_turnaround")}</SelectItem>
                          <SelectItem value="Spin">{t("opt_iso_interior_spin")}</SelectItem>
                          <SelectItem value="Mixed">{t("opt_post_mixed")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Hybrid: show interior + perimeter ISO options */}
                  {isHybridBig && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800 space-y-2">
                      <p className="text-xs font-bold text-amber-700 dark:text-amber-400">⚡ {t("hybrid_big_detected")}</p>
                      <FieldLabel label={t("iso_primary_style")} tooltip={t("hint_iso_primary_style")} />
                      <Select value={inputs.postIsoAction ?? "Mixed"} onValueChange={v => ui("postIsoAction", v)}>
                        <SelectTrigger className="h-12 rounded-xl bg-white dark:bg-slate-900 dark:border-slate-800"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Back Down">{t("opt_iso_interior_back_down")}</SelectItem>
                          <SelectItem value="Face-Up Drive">{t("opt_iso_interior_face_up_drive")}</SelectItem>
                          <SelectItem value="Post Jumper">{t("opt_iso_interior_post_jumper")}</SelectItem>
                          <SelectItem value="Turnaround">{t("opt_iso_interior_turnaround")}</SelectItem>
                          <SelectItem value="Spin">{t("opt_iso_interior_spin")}</SelectItem>
                          <SelectItem value="Mixed">{t("opt_post_mixed")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{t("editor.iso_section.creation")}</p>
                    <div className="space-y-2">
                      <FieldLabel label={t("editor.iso_start_zone")} />
                      <div className="flex flex-wrap" style={{ flexWrap: "wrap", gap: 12 }}>
                        {ISO_START_ZONE_OPTS.map((z) => (
                          <Button
                            key={z}
                            type="button"
                            variant={inputs.isoStartZone === z ? "default" : "outline"}
                            style={{ minHeight: 44 }}
                            className={`h-auto min-h-11 flex-1 min-w-[7rem] px-4 rounded-xl text-sm ${
                              inputs.isoStartZone === z
                                ? "bg-slate-800 text-white border-slate-800 dark:bg-white dark:text-slate-900"
                                : "bg-transparent border-slate-200 dark:border-slate-700 dark:text-slate-300"
                            }`}
                            onClick={() =>
                              ui("isoStartZone", inputs.isoStartZone === z ? null : z)
                            }
                          >
                            {t(ISO_START_ZONE_I18N[z] as never)}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <FieldLabel label={t("iso_dominant_direction")} tooltip={t("hint_iso_dominant_direction")} />
                      <div className="flex flex-wrap" style={{ flexWrap: "wrap", gap: 12 }}>
                        {(["Left", "Right", "Balanced"] as const).map(dir => (
                          <Button key={dir} type="button" variant={inputs.isoDominantDirection === dir ? "default" : "outline"}
                            style={{ minHeight: 44 }}
                            className={`h-auto min-h-11 min-w-11 flex-1 px-4 rounded-xl text-sm ${inputs.isoDominantDirection === dir ? "bg-slate-800 text-white border-slate-800 dark:bg-white dark:text-slate-900" : "bg-transparent border-slate-200 dark:border-slate-700 dark:text-slate-300"}`}
                            onClick={() => ui("isoDominantDirection", dir)}>{dir === "Left" ? t("dir_left") : dir === "Right" ? t("dir_right") : t("dir_balanced")}</Button>
                        ))}
                      </div>
                    </div>

                    {/* Perimeter ISO options — show for guards/wings AND hybrid bigs */}
                    {(!isInterior || isHybridBig) && (<>
                      <div className="space-y-2">
                        <FieldLabel label={t("iso_initiation")} tooltip={t("hint_iso_initiation")} />
                        <Select value={inputs.isoInitiation ?? "Controlled"} onValueChange={v => ui("isoInitiation", v)}>
                          <SelectTrigger className="h-12 rounded-xl bg-slate-50 dark:bg-slate-950/50 dark:border-slate-800"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Controlled">{t("opt_iso_init_controlled")}</SelectItem>
                            <SelectItem value="Quick Attack">{t("opt_iso_init_quick")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <FieldLabel label={t("iso_decision")} tooltip={t("hint_iso_decision")} />
                        <Select value={inputs.isoDecision ?? "Finish"} onValueChange={v => ui("isoDecision", v)}>
                          <SelectTrigger className="h-12 rounded-xl bg-slate-50 dark:bg-slate-950/50 dark:border-slate-800"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Finish">{t("opt_iso_decision_finish")}</SelectItem>
                            <SelectItem value="Shoot">{t("opt_iso_decision_shoot")}</SelectItem>
                            <SelectItem value="Pass">{t("opt_iso_decision_pass")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                    </>)}

                    {(inputs.isoFrequency === "Primary" || inputs.isoFrequency === "Secondary" || inputs.isoFrequency === "Rare") && (
                      <div className="space-y-2">
                        <FieldLabel label={t("editor_iso_finish_eff")} tooltip={t("hint_iso_finish_eff")} />
                        <Select
                          value={inputs.motorIsoEff ?? "__none__"}
                          onValueChange={(v) => ui("motorIsoEff", v === "__none__" ? null : v as NonNullable<PlayerInput["motorIsoEff"]>)}
                        >
                          <SelectTrigger className="h-12 rounded-xl bg-slate-50 dark:bg-slate-950/50 dark:border-slate-800">
                            <SelectValue placeholder={t("not_observed")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">{t("not_observed")}</SelectItem>
                            <SelectItem value="high">{t("editor.eff.high")}</SelectItem>
                            <SelectItem value="medium">{t("editor.eff.medium")}</SelectItem>
                            <SelectItem value="low">{t("editor.eff.low")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{t("editor.iso_closeout_reaction")}</p>
                    <FieldLabel label={t("closeout_general")} tooltip={t("hint_closeout_general")} />
                    <Select value={inputs.closeoutReaction} onValueChange={v => ui("closeoutReaction", v)}>
                      <SelectTrigger className="h-12 rounded-xl bg-slate-50 dark:bg-slate-950/50 dark:border-slate-800"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Catch & Shoot">{t("opt_closeout_catch_shoot")}</SelectItem>
                        <SelectItem value="Attack Baseline">{t("opt_closeout_attack_baseline")}</SelectItem>
                        <SelectItem value="Attack Middle">{t("opt_closeout_attack_middle")}</SelectItem>
                        <SelectItem value="Attacks Strong Hand">{t("opt_closeout_strong_hand")}</SelectItem>
                        <SelectItem value="Attacks Weak Hand">{t("opt_closeout_weak_hand")}</SelectItem>
                        <SelectItem value="Extra Pass">{t("opt_closeout_extra_pass")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{t("per_wing_override")}</p>
                    <div className="grid grid-cols-2 gap-3">
                      <CloseoutSelect label={`⬅️ ${t("left_wing")}`} value={inputs.closeoutLeft} onChange={v => ui("closeoutLeft", v)} fallback={inputs.closeoutReaction} tooltip={t("hint_closeout_directional")} />
                      <CloseoutSelect label={`➡️ ${t("right_wing")}`} value={inputs.closeoutRight} onChange={v => ui("closeoutRight", v)} fallback={inputs.closeoutReaction} tooltip={t("hint_closeout_directional")} />
                    </div>
                  </div>

                  <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800 animate-in fade-in">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{t("editor.iso_finishing")}</p>
                    <div className="space-y-2">
                      <FieldLabel
                        label={t("editor.iso_strong_hand_finish")}
                        tooltip={t("editor.iso_strong_hand_finish_hint")}
                      />
                      <div className="flex flex-wrap" style={{ flexWrap: "wrap", gap: 12 }}>
                        {ISO_HAND_FINISH_OPTS.map((fin) => (
                          <Button
                            key={fin}
                            type="button"
                            variant={inputs.isoStrongHandFinish === fin ? "default" : "outline"}
                            style={{ minHeight: 44 }}
                            className={`h-auto min-h-11 px-4 py-2 rounded-lg text-sm font-semibold ${
                              inputs.isoStrongHandFinish === fin
                                ? "bg-orange-500 border-orange-500 text-white hover:bg-orange-500 hover:text-white"
                                : "bg-transparent border-slate-200 dark:border-slate-700"
                            }`}
                            onClick={() =>
                              ui("isoStrongHandFinish", inputs.isoStrongHandFinish === fin ? null : fin)
                            }
                          >
                            {t(ISO_HAND_FINISH_I18N[fin] as never)}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <FieldLabel
                        label={t("editor.iso_weak_hand_finish")}
                        tooltip={t("editor.iso_weak_hand_finish_hint")}
                      />
                      <div className="flex flex-wrap" style={{ flexWrap: "wrap", gap: 12 }}>
                        {ISO_HAND_FINISH_OPTS.map((fin) => {
                          const effectiveWeak =
                            inputs.isoWeakHandFinish ??
                            legacyOppositeToIsoWeakFinish(inputs.isoOppositeFinish);
                          return (
                            <Button
                              key={fin}
                              type="button"
                              variant={effectiveWeak === fin ? "default" : "outline"}
                              style={{ minHeight: 44 }}
                              className={`h-auto min-h-11 px-4 py-2 rounded-lg text-sm font-semibold ${
                                effectiveWeak === fin
                                  ? "bg-orange-500 border-orange-500 text-white hover:bg-orange-500 hover:text-white"
                                  : "bg-transparent border-slate-200 dark:border-slate-700"
                              }`}
                              onClick={() => {
                                const next = effectiveWeak === fin ? null : fin;
                                ui("isoWeakHandFinish", next);
                                ui("isoOppositeFinish", isoWeakFinishToLegacyOpposite(next));
                              }}
                            >
                              {t(ISO_HAND_FINISH_I18N[fin] as never)}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          {/* ── PNR ── */}
          <TabsContent value="pnr" className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 space-y-5 border border-slate-200 dark:border-slate-800 shadow-sm border-l-4 border-l-blue-500">
              <h3 className="font-bold text-lg flex items-center gap-2 text-slate-900 dark:text-white"><Zap className="w-5 h-5 text-blue-500" /> {t("section_pnr")}</h3>

              <IntensitySelector label={t("pnr_frequency")} value={inputs.pnrFrequency} onChange={v => ui("pnrFrequency", v)}
                tooltip={t("hint_pnr_frequency")} />

              {inputs.pnrFrequency !== "Never" && (
                <>
              <div className="space-y-2">
                <FieldLabel label={t("pnr_role")} tooltip={t("hint_pnr_role")} />
                <div className="flex flex-wrap" style={{ flexWrap: "wrap", gap: 12 }}>
                  {["Handler", "Screener", "Both"].map(v => (
                    <Button key={v} type="button" variant={(inputs.pnrRole as any) === v ? "default" : "outline"}
                      style={{ minHeight: 44 }}
                      className={`h-auto min-h-11 min-w-11 flex-1 px-4 rounded-xl text-sm font-bold ${(inputs.pnrRole as any) === v ? "bg-slate-800 text-white dark:bg-white dark:text-slate-900" : "bg-transparent border-slate-200 dark:border-slate-700 dark:text-slate-300"}`}
                      onClick={() => ui("pnrRole", v as any)}>{v === "Handler" ? t("handler") : v === "Screener" ? t("screener") : t("both")}</Button>
                  ))}
                </div>
              </div>

              {pnrBoth && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-800 space-y-2">
                  <FieldLabel label={t("pnr_primary_role")} tooltip={t("hint_pnr_primary_role")} />
                  <div className="flex flex-wrap" style={{ flexWrap: "wrap", gap: 12 }}>
                    {["Handler", "Screener", "Balanced"].map(v => (
                      <Button key={v} type="button" variant={inputs.pnrRoleSecondary === v ? "default" : "outline"}
                        style={{ minHeight: 44 }}
                        className={`h-auto min-h-11 min-w-11 flex-1 px-4 rounded-xl text-sm font-bold ${inputs.pnrRoleSecondary === v ? "bg-blue-500 border-blue-500 text-white" : "bg-transparent border-slate-200 dark:border-slate-700 dark:text-slate-300"}`}
                        onClick={() => ui("pnrRoleSecondary", v as any)}>
                        {v === "Handler" ? t("handler") : v === "Screener" ? t("screener") : t("balanced")}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {showHandlerSection && (
                <div className={`space-y-4 ${pnrBoth ? "border border-slate-200 dark:border-slate-700 rounded-xl p-3" : ""} animate-in fade-in`}>
                  {pnrBoth && <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{t("as_handler")}</p>}
                  <div className="space-y-2">
                    <FieldLabel label={t("pnr_scoring_priority")} tooltip={t("hint_pnr_scoring")} />
                    <Select value={inputs.pnrScoringPriority} onValueChange={v => ui("pnrScoringPriority", v)}>
                      <SelectTrigger className="h-12 rounded-xl bg-slate-50 dark:bg-slate-950/50 dark:border-slate-800"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Score First">{t("opt_pnr_score_first")}</SelectItem>
                        <SelectItem value="Pass First">{t("opt_pnr_pass_first")}</SelectItem>
                        <SelectItem value="Balanced">{t("opt_pnr_balanced")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {showHandlerSection && (
                    <div className="space-y-2">
                      <FieldLabel label={t("editor.pnr_eff_by_side")} />
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                            {t("editor.pnr_eff_left")}
                          </Label>
                          <div className="flex flex-wrap" style={{ flexWrap: "wrap", gap: 8 }}>
                            {PNR_SIDE_EFF_OPTS.map((lvl) => (
                              <Button
                                key={lvl}
                                type="button"
                                variant={inputs.pnrEffLeft === lvl ? "default" : "outline"}
                                style={{ minHeight: 40 }}
                                className={`h-auto min-h-10 flex-1 min-w-[4.5rem] px-2 rounded-lg text-xs font-semibold ${
                                  inputs.pnrEffLeft === lvl
                                    ? "bg-blue-600 border-blue-600 text-white hover:bg-blue-600 hover:text-white"
                                    : "border-slate-200 dark:border-slate-700"
                                }`}
                                onClick={() =>
                                  ui("pnrEffLeft", inputs.pnrEffLeft === lvl ? null : lvl)
                                }
                              >
                                {t(`editor.eff.${lvl}` as never)}
                              </Button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                            {t("editor.pnr_eff_right")}
                          </Label>
                          <div className="flex flex-wrap" style={{ flexWrap: "wrap", gap: 8 }}>
                            {PNR_SIDE_EFF_OPTS.map((lvl) => (
                              <Button
                                key={lvl}
                                type="button"
                                variant={inputs.pnrEffRight === lvl ? "default" : "outline"}
                                style={{ minHeight: 40 }}
                                className={`h-auto min-h-10 flex-1 min-w-[4.5rem] px-2 rounded-lg text-xs font-semibold ${
                                  inputs.pnrEffRight === lvl
                                    ? "bg-blue-600 border-blue-600 text-white hover:bg-blue-600 hover:text-white"
                                    : "border-slate-200 dark:border-slate-700"
                                }`}
                                onClick={() =>
                                  ui("pnrEffRight", inputs.pnrEffRight === lvl ? null : lvl)
                                }
                              >
                                {t(`editor.eff.${lvl}` as never)}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <FieldLabel label={t("editor_pnr_finish_eff")} tooltip={t("hint_pnr_finish_eff")} />
                    <Select
                      value={inputs.motorPnrEff ?? "__none__"}
                      onValueChange={(v) => ui("motorPnrEff", v === "__none__" ? null : v as NonNullable<PlayerInput["motorPnrEff"]>)}
                    >
                      <SelectTrigger className="h-12 rounded-xl bg-slate-50 dark:bg-slate-950/50 dark:border-slate-800">
                        <SelectValue placeholder={t("not_observed")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">{t("not_observed")}</SelectItem>
                        <SelectItem value="high">{t("editor.eff.high")}</SelectItem>
                        <SelectItem value="medium">{t("editor.eff.medium")}</SelectItem>
                        <SelectItem value="low">{t("editor.eff.low")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <FieldLabel label={t("pnr_reaction_under")} tooltip={t("hint_pnr_under")} />
                    <Select value={inputs.pnrReactionVsUnder} onValueChange={v => ui("pnrReactionVsUnder", v)}>
                      <SelectTrigger className="h-12 rounded-xl bg-slate-50 dark:bg-slate-950/50 dark:border-slate-800"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Pull-up 3">{t("opt_finish_pullup3")}</SelectItem>
                        <SelectItem value="Re-screen">{t("opt_pnr_under_rescreen")}</SelectItem>
                        <SelectItem value="Reject / Attack">{t("opt_pnr_under_reject")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <FieldLabel label={t("pnr_timing")} tooltip={t("hint_pnr_timing")} />
                    <Select value={inputs.pnrTiming} onValueChange={v => ui("pnrTiming", v)}>
                      <SelectTrigger className="h-12 rounded-xl bg-slate-50 dark:bg-slate-950/50 dark:border-slate-800"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Early (Drag)">{t("opt_pnr_timing_drag")}</SelectItem>
                        <SelectItem value="Deep (Half-court)">{t("opt_pnr_timing_halfcourt")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {(inputs.pnrFrequency === "Primary" || inputs.pnrFrequency === "Secondary") && (
                    <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{t("editor.pnr_section.finish_tendencies")}</p>
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{t("finish_by_direction")}</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">{t("pnr_primary_option")}</Label>
                          <Select value={inputs.pnrDominantFinish ?? "Drive to Rim"} onValueChange={v => ui("pnrDominantFinish", v)}>
                            <SelectTrigger className="h-10 rounded-xl bg-slate-50 dark:bg-slate-950/50 dark:border-slate-800 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Drive to Rim">{t("opt_finish_drive")}</SelectItem>
                              <SelectItem value="Pull-up">{t("opt_finish_pullup")}</SelectItem>
                              <SelectItem value="Floater">{t("opt_finish_floater")}</SelectItem>
                              <SelectItem value="Mid-range">{t("opt_finish_midrange")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">{t("pnr_weaker_option")}</Label>
                          <Select value={inputs.pnrOppositeFinish ?? "Pull-up"} onValueChange={v => ui("pnrOppositeFinish", v)}>
                            <SelectTrigger className="h-10 rounded-xl bg-slate-50 dark:bg-slate-950/50 dark:border-slate-800 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Drive to Rim">{t("opt_finish_drive")}</SelectItem>
                              <SelectItem value="Pull-up">{t("opt_finish_pullup")}</SelectItem>
                              <SelectItem value="Floater">{t("opt_finish_floater")}</SelectItem>
                              <SelectItem value="Mid-range">{t("opt_finish_midrange")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 pt-1">{t("pnr_finish_by_side_heading")}</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">{t("pnr_finish_ball_left")}</Label>
                          <Select
                            value={inputs.pnrFinishBallLeft ?? "__none__"}
                            onValueChange={(v) => ui("pnrFinishBallLeft", v === "__none__" ? null : (v as PnrFinish))}
                          >
                            <SelectTrigger className="h-10 rounded-xl bg-slate-50 dark:bg-slate-950/50 dark:border-slate-800 text-xs"><SelectValue placeholder={t("not_observed")} /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">{t("not_observed")}</SelectItem>
                              <SelectItem value="Drive to Rim">{t("opt_finish_drive")}</SelectItem>
                              <SelectItem value="Pull-up">{t("opt_finish_pullup")}</SelectItem>
                              <SelectItem value="Floater">{t("opt_finish_floater")}</SelectItem>
                              <SelectItem value="Mid-range">{t("opt_finish_midrange")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">{t("pnr_finish_ball_right")}</Label>
                          <Select
                            value={inputs.pnrFinishBallRight ?? "__none__"}
                            onValueChange={(v) => ui("pnrFinishBallRight", v === "__none__" ? null : (v as PnrFinish))}
                          >
                            <SelectTrigger className="h-10 rounded-xl bg-slate-50 dark:bg-slate-950/50 dark:border-slate-800 text-xs"><SelectValue placeholder={t("not_observed")} /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">{t("not_observed")}</SelectItem>
                              <SelectItem value="Drive to Rim">{t("opt_finish_drive")}</SelectItem>
                              <SelectItem value="Pull-up">{t("opt_finish_pullup")}</SelectItem>
                              <SelectItem value="Floater">{t("opt_finish_floater")}</SelectItem>
                              <SelectItem value="Mid-range">{t("opt_finish_midrange")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {showScreenerSection && (
                <div className={`space-y-4 ${pnrBoth ? "border border-slate-200 dark:border-slate-700 rounded-xl p-3" : ""} animate-in fade-in`}>
                  {pnrBoth && <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{t("as_screener")}</p>}
                  <div className="space-y-2">
                    <FieldLabel
                      label={t("editor.pnr_screen_timing")}
                      tooltip={t("hint_pnr_screen_timing")}
                    />
                    <div className="flex flex-wrap" style={{ flexWrap: "wrap", gap: 12 }}>
                      {PNR_SCREEN_TIMING_OPTS.map((opt) => (
                        <Button
                          key={opt}
                          type="button"
                          variant={inputs.pnrScreenTiming === opt ? "default" : "outline"}
                          style={{ minHeight: 44 }}
                          className={`h-auto min-h-11 flex-1 min-w-[8rem] px-4 py-2 rounded-xl text-sm font-semibold ${
                            inputs.pnrScreenTiming === opt
                              ? "bg-blue-600 border-blue-600 text-white hover:bg-blue-600 hover:text-white"
                              : "border-slate-200 dark:border-slate-700"
                          }`}
                          onClick={() =>
                            ui("pnrScreenTiming", inputs.pnrScreenTiming === opt ? null : opt)
                          }
                        >
                          {t(PNR_SCREEN_TIMING_I18N[opt] as never)}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {inputs.pnrScreenTiming === "slip" ? (
                    <p className="text-xs text-slate-400">{t("editor.pnr_slip_note")}</p>
                  ) : (
                    <ScreenerActionSelector
                      primaryValue={inputs.pnrScreenerAction}
                      secondaryValue={(inputs as any).pnrScreenerActionSecondary}
                      onPrimaryChange={v => ui("pnrScreenerAction", v)}
                      onSecondaryChange={v => ui("pnrScreenerActionSecondary" as any, v)}
                    />
                  )}
                </div>
              )}
                </>
              )}
            </div>
          </TabsContent>

          {/* ── OFF-BALL ── */}
          <TabsContent value="offball" className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 space-y-5 border border-slate-200 dark:border-slate-800 shadow-sm border-l-4 border-l-emerald-500">
              <h3 className="font-bold text-lg flex items-center gap-2 text-slate-900 dark:text-white"><Target className="w-5 h-5 text-emerald-500" /> {t("section_offball_activity")}</h3>

              <IntensitySelector label={t("indirects")} value={inputs.indirectsFrequency} onChange={v => ui("indirectsFrequency", v)}
                tooltip={t("hint_indirects")} />

              <div className="space-y-3">
                <FieldLabel label={t("editor.off_ball_role")} tooltip={t("editor.off_ball_role_hint")} />
                <div className="flex flex-wrap" style={{ flexWrap: "wrap", gap: 12 }}>
                  {(["screener", "cutter", "both", "none"] as const).map((roleOpt) => (
                    <Button
                      key={roleOpt}
                      type="button"
                      variant={inputs.offBallRole === roleOpt ? "default" : "outline"}
                      style={{ minHeight: 44 }}
                      className={`h-auto min-h-11 px-4 py-2 rounded-lg text-sm font-semibold ${
                        inputs.offBallRole === roleOpt
                          ? "bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-600 hover:text-white"
                          : ""
                      }`}
                      onClick={() => ui("offBallRole", inputs.offBallRole === roleOpt ? null : roleOpt)}
                    >
                      {t(`editor.off_ball_role.${roleOpt}` as "editor.off_ball_role.screener")}
                    </Button>
                  ))}
                </div>
              </div>

              {showOffBallScreenerAccordion && (
                <div
                  style={{
                    border: "1px solid",
                    borderColor: "var(--border)",
                    borderRadius: 8,
                    overflow: "hidden",
                    marginTop: 8,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setScreenerAccordionOpen((o) => !o)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 16px",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ fontWeight: 500, fontSize: 14 }}>{t("editor.as_screener")}</span>
                    <ChevronDown
                      size={16}
                      style={{
                        transition: "transform 200ms ease-out",
                        transform: screenerAccordionOpen ? "rotate(180deg)" : "rotate(0deg)",
                      }}
                    />
                  </button>
                  {screenerAccordionOpen && (
                    <div
                      style={{
                        padding: "0 16px 16px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 16,
                      }}
                    >
                      <div className="space-y-2">
                        <FieldLabel label={t("editor.off_ball_screen_pattern")} tooltip={t("editor.screener_action_hint")} />
                        <div className="flex flex-wrap" style={{ flexWrap: "wrap", gap: 12 }}>
                          {OFF_BALL_SCREEN_OPTS.map((opt) => (
                            <Button
                              key={opt}
                              type="button"
                              variant={inputs.offBallScreenPattern === opt ? "default" : "outline"}
                              style={{ minHeight: 44 }}
                              className={`h-auto min-h-11 px-4 py-2 rounded-lg text-sm font-semibold ${
                                inputs.offBallScreenPattern === opt
                                  ? "bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-600 hover:text-white"
                                  : ""
                              }`}
                              onClick={() => {
                                const next = inputs.offBallScreenPattern === opt ? null : opt;
                                ui("offBallScreenPattern", next);
                                ui(
                                  "offBallScreenPatternFreq",
                                  next && next !== "none"
                                    ? inputs.offBallScreenPatternFreq ?? "secondary"
                                    : null,
                                );
                                ui("screenerAction", screenPatternToLegacyScreener(next));
                              }}
                            >
                              {t(OFF_BALL_SCREEN_LABEL[opt] as never)}
                            </Button>
                          ))}
                        </div>
                      </div>
                      {inputs.offBallScreenPattern != null && inputs.offBallScreenPattern !== "none" && (
                        <div
                          style={{
                            background: "var(--color-background-info, rgba(59,130,246,0.06))",
                            borderRadius: 6,
                            padding: "8px 12px",
                          }}
                        >
                          <IntensitySelector
                            label={t("editor.off_ball_screen_pattern_freq")}
                            value={gradedToIntensity(inputs.offBallScreenPatternFreq)}
                            onChange={(v) => ui("offBallScreenPatternFreq", intensityToGraded(v))}
                            tooltip={t("editor.screener_action_frequency_hint")}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {showOffBallCutterAccordion && (
                <div
                  style={{
                    border: "1px solid",
                    borderColor: "var(--border)",
                    borderRadius: 8,
                    overflow: "hidden",
                    marginTop: 8,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setCutterAccordionOpen((o) => !o)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 16px",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ fontWeight: 500, fontSize: 14 }}>{t("editor.as_cutter")}</span>
                    <ChevronDown
                      size={16}
                      style={{
                        transition: "transform 200ms ease-out",
                        transform: cutterAccordionOpen ? "rotate(180deg)" : "rotate(0deg)",
                      }}
                    />
                  </button>
                  {cutterAccordionOpen && (
                    <div
                      style={{
                        padding: "0 16px 16px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 16,
                      }}
                    >
                      <div className="space-y-2">
                        <FieldLabel label={t("editor.off_ball_cut_action")} tooltip={t("hint_indirects")} />
                        <div className="flex flex-wrap" style={{ flexWrap: "wrap", gap: 12 }}>
                          {(["catch_and_shoot", "catch_and_drive", "curl", "flare"] as const).map((opt) => (
                            <Button
                              key={opt}
                              type="button"
                              variant={inputs.offBallCutAction === opt ? "default" : "outline"}
                              style={{ minHeight: 44 }}
                              className={`h-auto min-h-11 px-4 py-2 rounded-lg text-sm font-semibold ${
                                inputs.offBallCutAction === opt
                                  ? "bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-600 hover:text-white"
                                  : ""
                              }`}
                              onClick={() => ui("offBallCutAction", inputs.offBallCutAction === opt ? null : opt)}
                            >
                              {t(`editor.off_ball_cut_action.${opt}` as never)}
                            </Button>
                          ))}
                          <Button
                            type="button"
                            variant={inputs.offBallCutAction == null ? "secondary" : "outline"}
                            style={{ minHeight: 44 }}
                            className="h-auto min-h-11 px-4 py-2 rounded-lg text-sm"
                            onClick={() => ui("offBallCutAction", null)}
                          >
                            {t("not_observed")}
                          </Button>
                        </div>
                      </div>
                      <div
                        style={{
                          background: "var(--color-background-info, rgba(59,130,246,0.06))",
                          borderRadius: 6,
                          padding: "8px 12px",
                        }}
                      >
                        <IntensitySelector
                          label={t("editor.off_ball_cut_frequency")}
                          value={gradedToIntensity(inputs.cutterFrequency)}
                          onChange={(v) => ui("cutterFrequency", intensityToGraded(v))}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <IntensitySelector label={t("transition_frequency")} value={inputs.transitionFrequency} onChange={v => ui("transitionFrequency", v)}
                tooltip={t("hint_transition_frequency")} />

              <div className="mt-2 space-y-3">
                <FieldLabel label={t("editor.trans_role_primary")} tooltip={t("hint_transition_frequency")} />
                <div className="flex flex-wrap gap-3">
                  {TRANS_EDITOR_ROLES.map((role) => (
                    <Button
                      key={role}
                      type="button"
                      variant={inputs.transRolePrimary === role ? "default" : "outline"}
                      style={{ minHeight: 44 }}
                      className={`h-auto px-4 py-2 rounded-lg text-sm font-semibold ${
                        inputs.transRolePrimary === role
                          ? "bg-orange-500 border-orange-500 text-white hover:bg-orange-500 hover:text-white"
                          : "border-slate-200 dark:border-slate-700"
                      }`}
                      onClick={() => {
                        if (inputs.transRolePrimary === role) return;
                        ui("transRolePrimary", role);
                        ui("transSubPrimary", null);
                        ui("transRoleSecondary", null);
                        ui("transSubSecondary", null);
                      }}
                    >
                      {t(`editor.trans_role.${role}` as never)}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant={inputs.transRolePrimary == null ? "secondary" : "outline"}
                    style={{ minHeight: 44 }}
                    className="h-auto px-4 py-2 rounded-lg text-sm font-semibold"
                    onClick={() => {
                      ui("transRolePrimary", null);
                      ui("transSubPrimary", null);
                      ui("transRoleSecondary", null);
                      ui("transSubSecondary", null);
                    }}
                  >
                    {t("editor.trans_role_none")}
                  </Button>
                </div>
                {inputs.transRolePrimary && (
                  <div className="space-y-1.5 pl-0.5">
                    <div className="flex flex-wrap gap-3">
                      {TRANS_ROLE_SUB_OPTIONS[inputs.transRolePrimary].map((sub) => (
                        <Button
                          key={sub}
                          type="button"
                          variant={inputs.transSubPrimary === sub ? "default" : "outline"}
                          style={{ minHeight: 40 }}
                          className={`h-auto text-xs px-3 py-2 rounded-md font-semibold ${
                            inputs.transSubPrimary === sub
                              ? "bg-orange-500 border-orange-500 text-white hover:bg-orange-500 hover:text-white"
                              : "border-slate-200 dark:border-slate-700"
                          }`}
                          onClick={() => ui("transSubPrimary", inputs.transSubPrimary === sub ? null : sub)}
                        >
                          {t(`editor.trans_sub.${sub}` as never)}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {inputs.transRolePrimary && (
                <div className="mt-4 space-y-3">
                  <FieldLabel label={t("editor.trans_role_secondary")} tooltip={t("hint_transition_frequency")} />
                  <div className="flex flex-wrap gap-3">
                    {TRANS_EDITOR_ROLES.map((role) => {
                      const disabled = role === inputs.transRolePrimary;
                      return (
                        <Button
                          key={role}
                          type="button"
                          disabled={disabled}
                          variant={inputs.transRoleSecondary === role ? "default" : "outline"}
                          style={{ minHeight: 44 }}
                          className={`h-auto px-4 py-2 rounded-lg text-sm font-semibold ${
                            inputs.transRoleSecondary === role
                              ? "bg-orange-500 border-orange-500 text-white hover:bg-orange-500 hover:text-white"
                              : "border-slate-200 dark:border-slate-700"
                          } ${disabled ? "opacity-40 pointer-events-none cursor-not-allowed" : ""}`}
                          onClick={() => {
                            if (inputs.transRoleSecondary === role) {
                              ui("transRoleSecondary", null);
                              ui("transSubSecondary", null);
                            } else {
                              ui("transRoleSecondary", role);
                              ui("transSubSecondary", null);
                            }
                          }}
                        >
                          {t(`editor.trans_role.${role}` as never)}
                        </Button>
                      );
                    })}
                    <Button
                      type="button"
                      variant={inputs.transRoleSecondary == null ? "secondary" : "outline"}
                      style={{ minHeight: 44 }}
                      className="h-auto px-4 py-2 rounded-lg text-sm font-semibold"
                      onClick={() => {
                        ui("transRoleSecondary", null);
                        ui("transSubSecondary", null);
                      }}
                    >
                      {t("editor.trans_role_none")}
                    </Button>
                  </div>
                  {inputs.transRoleSecondary && (
                    <div className="space-y-1.5 pl-0.5">
                      <div className="flex flex-wrap gap-3">
                        {TRANS_ROLE_SUB_OPTIONS[inputs.transRoleSecondary].map((sub) => (
                          <Button
                            key={sub}
                            type="button"
                            variant={inputs.transSubSecondary === sub ? "default" : "outline"}
                            style={{ minHeight: 36 }}
                            className={`h-auto text-xs px-2.5 py-1.5 rounded-md font-semibold ${
                              inputs.transSubSecondary === sub
                                ? "bg-orange-500 border-orange-500 text-white hover:bg-orange-500 hover:text-white"
                                : "border-slate-200 dark:border-slate-700"
                            }`}
                            onClick={() => ui("transSubSecondary", inputs.transSubSecondary === sub ? null : sub)}
                          >
                            {t(`editor.trans_sub.${sub}` as never)}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {showTransFinishing && (
                <div className="mt-4 space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800 animate-in fade-in">
                  <FieldLabel label={t("editor.trans_finishing")} />
                  <div className="flex flex-wrap gap-3">
                    {(
                      [
                        { v: "high" as const, labelKey: "editor.eff.high" },
                        { v: "medium" as const, labelKey: "editor.eff.medium" },
                        { v: "low" as const, labelKey: "editor.eff.low" },
                        { v: "not_observed" as const, labelKey: "not_observed" },
                      ] as const
                    ).map(({ v, labelKey }) => (
                      <Button
                        key={v}
                        type="button"
                        variant={inputs.transFinishing === v ? "default" : "outline"}
                        style={{ minHeight: 44 }}
                        className={`h-auto px-4 py-2 rounded-lg text-sm font-semibold ${
                          inputs.transFinishing === v
                            ? "bg-orange-500 border-orange-500 text-white hover:bg-orange-500 hover:text-white"
                            : "border-slate-200 dark:border-slate-700"
                        }`}
                        onClick={() => ui("transFinishing", inputs.transFinishing === v ? null : v)}
                      >
                        {t(labelKey as never)}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <IntensitySelector label={t("backdoor")} value={inputs.backdoorFrequency} onChange={v => ui("backdoorFrequency", v)}
                tooltip={t("hint_backdoor")} />

              <IntensitySelector
                label={t("editor.free_cuts_frequency")}
                value={(inputs.freeCutsFrequency ?? "Never") as IntensityLevel}
                onChange={v => ui("freeCutsFrequency", v)}
              />

              {inputs.freeCutsFrequency != null && inputs.freeCutsFrequency !== "Never" && (
                <div className="space-y-2 animate-in fade-in">
                  <FieldLabel label={t("editor.free_cuts_type")} />
                  <div className="flex flex-wrap" style={{ flexWrap: "wrap", gap: 12 }}>
                    {FREE_CUTS_TYPE_OPTS.map((opt) => (
                      <Button
                        key={opt}
                        type="button"
                        variant={inputs.freeCutsType === opt ? "default" : "outline"}
                        style={{ minHeight: 44 }}
                        className={`h-auto min-h-11 px-4 py-2 rounded-lg text-sm font-semibold ${
                          inputs.freeCutsType === opt
                            ? "bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-600 hover:text-white"
                            : "border-slate-200 dark:border-slate-700"
                        }`}
                        onClick={() =>
                          ui("freeCutsType", inputs.freeCutsType === opt ? null : opt)
                        }
                      >
                        {t(FREE_CUTS_TYPE_I18N[opt] as never)}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <IntensitySelector label={t("orb")} value={inputs.offensiveReboundFrequency} onChange={v => ui("offensiveReboundFrequency", v)}
                tooltip={t("hint_orb")} />

              {inputs.offensiveReboundFrequency !== "Never" && (
                <div className="space-y-2 animate-in fade-in">
                  <FieldLabel label={t("editor.putback_quality")} />
                  <div className="flex flex-wrap" style={{ flexWrap: "wrap", gap: 12 }}>
                    {PUTBACK_QUALITY_OPTS.map((q) => (
                      <Button
                        key={q}
                        type="button"
                        variant={inputs.putbackQuality === q ? "default" : "outline"}
                        style={{ minHeight: 44 }}
                        className={`h-auto min-h-11 px-4 py-2 rounded-lg text-sm font-semibold ${
                          inputs.putbackQuality === q
                            ? "bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-600 hover:text-white"
                            : "border-slate-200 dark:border-slate-700"
                        }`}
                        onClick={() =>
                          ui("putbackQuality", inputs.putbackQuality === q ? null : q)
                        }
                      >
                        {t(PUTBACK_QUALITY_I18N[q] as never)}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
