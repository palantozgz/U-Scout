import { useLocale, t } from "@/lib/i18n";
import { useState, useEffect, useRef, useMemo, type ChangeEvent } from "react";
import { useRoute, useLocation, useSearch } from "wouter";
import {
  usePlayer, useTeams, useCreatePlayer, useUpdatePlayer, useDeletePlayer,
  generateProfile, createDefaultPlayer, clubRowToMotorContext,
  TRANS_ROLE_SUB_OPTIONS,
  type PlayerInput, type IntensityLevel,
  type CloseoutReaction, type PlayerProfile, type PhysicalLevel,
  type PostQuadrants, type ScreenerAction, type PnrFinish,
  type HighPostAction, type HighPostZonesMotor,
  type TransRoleEditor,
} from "@/lib/mock-data";
import { useClub } from "@/lib/club-api";
import { ArrowLeft, Save, Info, Flame, Zap, Target, Trash2, HelpCircle, X, Check, Plus, ChevronDown, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { BasketballPlaceholderAvatar } from "@/components/BasketballPlaceholderAvatar";
import { isRealPhoto } from "@/lib/utils";

// ─── Transition roles ─────────────────────────────────────────────────────────
const TRANS_EDITOR_ROLES = ["rim_runner", "trail", "runner", "pusher"] as const satisfies readonly TransRoleEditor[];

// ─── PnR finish options ───────────────────────────────────────────────────────
const PNR_FINISH_OPTS = [
  { v: "Drive to Rim" as PnrFinish, labelKey: "opt_finish_drive" },
  { v: "Floater" as PnrFinish, labelKey: "opt_finish_floater" },
  { v: "Pull-up" as PnrFinish, labelKey: "opt_finish_pullup" },
  { v: "Mid-range" as PnrFinish, labelKey: "opt_finish_midrange" },
] as const;

// ─── Screen timing ────────────────────────────────────────────────────────────
const PNR_SCREEN_TIMING_OPTS = ["holds_long", "quick_release", "ghost_touch", "slip"] as const satisfies readonly NonNullable<PlayerInput["pnrScreenTiming"]>[];
const PNR_SCREEN_TIMING_I18N: Record<(typeof PNR_SCREEN_TIMING_OPTS)[number], string> = {
  holds_long: "editor.pnr_timing_holds_long",
  quick_release: "editor.pnr_timing_quick",
  ghost_touch: "editor.pnr_timing_ghost",
  slip: "editor.pnr_timing_slip",
};

// ─── Putback quality ──────────────────────────────────────────────────────────
const PUTBACK_QUALITY_OPTS = ["primary", "capable", "palms_only", "not_observed"] as const satisfies readonly NonNullable<PlayerInput["putbackQuality"]>[];
const PUTBACK_QUALITY_I18N: Record<(typeof PUTBACK_QUALITY_OPTS)[number], string> = {
  primary: "editor.putback_converts",
  capable: "editor.putback_capable",
  palms_only: "editor.putback_tips",
  not_observed: "editor.putback_not_observed",
};

// ─── Free cuts ────────────────────────────────────────────────────────────────
const FREE_CUTS_TYPE_OPTS = ["basket", "flash", "both"] as const satisfies readonly NonNullable<PlayerInput["freeCutsType"]>[];
const FREE_CUTS_TYPE_I18N: Record<(typeof FREE_CUTS_TYPE_OPTS)[number], string> = {
  basket: "editor.free_cuts_basket",
  flash: "editor.free_cuts_flash",
  both: "editor.free_cuts_both",
};

// ─── Personality ──────────────────────────────────────────────────────────────
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

// ─── Pill helpers ─────────────────────────────────────────────────────────────
type PillScheme = "default" | "neutral";
function pillActiveClasses(scheme: PillScheme): string {
  if (scheme === "neutral") return "bg-slate-700 border-slate-600 text-white dark:bg-slate-600";
  return "bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-600 hover:text-white";
}

// ─── Legacy migration helpers ─────────────────────────────────────────────────
function legacyOppositeToIsoWeakFinish(f: PlayerInput["isoOppositeFinish"]): PlayerInput["isoWeakHandFinish"] | null {
  if (!f) return null;
  if (f === "Drive") return "drive";
  if (f === "Pull-up") return "pullup";
  if (f === "Floater") return "floater";
  if (f === "Pass") return "pass";
  return null;
}

function legacyScreenerToScreenPattern(a: PlayerInput["screenerAction"]): PlayerInput["offBallScreenPattern"] | null {
  if (!a) return null;
  switch (a) {
    case "roll_to_rim": return "roll";
    case "slip": return "slip";
    case "pop_mid": return "pop_mid";
    case "pop_3": return "pop_short";
    case "short_roll": return "short_roll";
    default: return null;
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
    return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("touchstart", handler); };
  }, [open]);
  return (
    <>
      <button ref={btnRef} type="button" onClick={() => setOpen(v => !v)} className="ml-1.5 text-slate-400 hover:text-primary transition-colors flex-shrink-0">
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm bg-slate-900 text-slate-100 text-sm rounded-2xl p-5 shadow-2xl border border-slate-700 leading-relaxed" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <p>{text}</p>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-white shrink-0 mt-0.5"><X className="w-4 h-4" /></button>
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

// ─── Avatar upload ────────────────────────────────────────────────────────────
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
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
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
          {real ? <img src={imageUrl} className="w-full h-full object-cover" /> : <BasketballPlaceholderAvatar size={96} />}
        </div>
        <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center"><Plus className="w-8 h-8 text-white" /></div>
        <input ref={inputRef} type="file" accept="image/*" capture className="hidden" onChange={handleFile} />
      </div>
    </div>
  );
}

// ─── Power Bar ────────────────────────────────────────────────────────────────
function PowerBar({ label, value, onChange, tooltip }: {
  label: string; value: PhysicalLevel; onChange: (v: PhysicalLevel) => void; tooltip?: string;
}) {
  const levelColorMap: Record<1 | 2 | 3 | 4 | 5, string> = {
    1: "bg-sky-300 border-sky-300",
    2: "bg-blue-400 border-blue-400",
    3: "bg-violet-500 border-violet-500",
    4: "bg-purple-600 border-purple-600",
    5: "bg-amber-500 border-amber-500",
  };
  return (
    <div className="space-y-2">
      <FieldLabel label={label} tooltip={tooltip} />
      <div className="flex gap-1.5 items-end h-9">
        {([1, 2, 3, 4, 5] as const).map(level => {
          const filled = value >= level;
          return (
            <button key={level} type="button" onClick={() => onChange(value === level ? 0 : level)}
              style={{ width: 20 + level * 8, height: 12 + level * 4 }}
              className={`rounded-sm transition-all duration-150 border-2 ${filled ? levelColorMap[level] + " shadow-sm" : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-primary/50"}`}
            />
          );
        })}
        <span className="ml-2 text-xs font-bold text-slate-500 dark:text-slate-400 self-center">{value === 0 ? "—" : `${value}/5`}</span>
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
            onClick={() => onChange(level)}>
            {level === "Primary" ? t("freq_primary") : level === "Secondary" ? t("freq_secondary") : level === "Rare" ? t("freq_rare") : t("freq_never")}
          </Button>
        ))}
      </div>
    </div>
  );
}

// ─── Closeout ─────────────────────────────────────────────────────────────────
function CloseoutSelect({ label, value, onChange, fallback, tooltip }: {
  label: string; value?: CloseoutReaction; onChange: (v: CloseoutReaction) => void; fallback: CloseoutReaction; tooltip?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-0.5">
        <Label className="font-semibold text-slate-700 dark:text-slate-300 text-xs">{label}</Label>
        {tooltip && <Tooltip text={tooltip} />}
      </div>
      <Select value={value ?? fallback} onValueChange={v => onChange(v as CloseoutReaction)}>
        <SelectTrigger className="h-10 rounded-xl bg-slate-50 dark:bg-slate-950/50 dark:border-slate-800 text-xs"><SelectValue /></SelectTrigger>
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

function IsoCloseoutReactionSection({ inputs, ui }: { inputs: PlayerInput; ui: (key: keyof PlayerInput, value: any) => void }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/40 p-4 space-y-3">
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
      <div className="grid grid-cols-2 gap-3">
        <CloseoutSelect label={`⬅️ ${t("left_wing")}`} value={inputs.closeoutLeft} onChange={v => ui("closeoutLeft", v)} fallback={inputs.closeoutReaction} tooltip={t("hint_closeout_directional")} />
        <CloseoutSelect label={`➡️ ${t("right_wing")}`} value={inputs.closeoutRight} onChange={v => ui("closeoutRight", v)} fallback={inputs.closeoutReaction} tooltip={t("hint_closeout_directional")} />
      </div>
    </div>
  );
}

// ─── Half-court diagram ───────────────────────────────────────────────────────
function HalfCourtDiagram({ dominant }: { dominant?: "Right" | "Left" }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3 space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 text-center">Top view — player's back to the baseline</p>
      <svg viewBox="0 0 240 175" className="w-full max-w-xs mx-auto block" xmlns="http://www.w3.org/2000/svg">
        <rect x="10" y="18" width="220" height="140" fill="none" stroke="#94a3b8" strokeWidth="1.5" rx="3"/>
        <rect x="70" y="60" width="100" height="88" fill="none" stroke="#94a3b8" strokeWidth="1.2"/>
        <line x1="70" y1="98" x2="170" y2="98" stroke="#94a3b8" strokeWidth="0.8" strokeDasharray="3,2"/>
        <ellipse cx="120" cy="98" rx="26" ry="11" fill="none" stroke="#94a3b8" strokeWidth="0.8" strokeDasharray="3,2"/>
        <path d="M 102 148 A 18 18 0 0 1 138 148" fill="none" stroke="#94a3b8" strokeWidth="0.8"/>
        <circle cx="120" cy="140" r="5" fill="none" stroke="#94a3b8" strokeWidth="1.5"/>
        <line x1="120" y1="145" x2="120" y2="153" stroke="#94a3b8" strokeWidth="1.5"/>
        <line x1="103" y1="153" x2="137" y2="153" stroke="#94a3b8" strokeWidth="2"/>
        <path d="M 32 148 A 88 88 0 0 1 208 148" fill="none" stroke="#94a3b8" strokeWidth="0.8" strokeDasharray="2,2"/>
        <line x1="32" y1="103" x2="32" y2="148" stroke="#94a3b8" strokeWidth="0.8" strokeDasharray="2,2"/>
        <line x1="208" y1="103" x2="208" y2="148" stroke="#94a3b8" strokeWidth="0.8" strokeDasharray="2,2"/>
        <text x="120" y="13" textAnchor="middle" fontSize="6" fill="#94a3b8">↑ {t("center_court")}</text>
        <rect x="52" y="120" width="24" height="18" fill={dominant === "Left" ? "#93c5fd" : "#dbeafe"} stroke={dominant === "Left" ? "#3b82f6" : "#93c5fd"} strokeWidth={dominant === "Left" ? "2.5" : "1.5"} rx="3"/>
        <text x="64" y="132" textAnchor="middle" fontSize="8" fontWeight="bold" fill={dominant === "Left" ? "#1d4ed8" : "#64748b"}>L</text>
        {dominant === "Left" && <text x="64" y="118" textAnchor="middle" fontSize="8" fill="#1d4ed8">★</text>}
        <rect x="164" y="120" width="24" height="18" fill={dominant === "Right" ? "#fca5a5" : "#fee2e2"} stroke={dominant === "Right" ? "#ef4444" : "#fca5a5"} strokeWidth={dominant === "Right" ? "2.5" : "1.5"} rx="3"/>
        <text x="176" y="132" textAnchor="middle" fontSize="8" fontWeight="bold" fill={dominant === "Right" ? "#dc2626" : "#64748b"}>R</text>
        {dominant === "Right" && <text x="176" y="118" textAnchor="middle" fontSize="8" fill="#dc2626">★</text>}
        <path d="M 64 138 L 64 150" stroke="#3b82f6" strokeWidth="1" markerEnd="url(#arrowBlue)" opacity="0.5"/>
        <path d="M 76 129 L 95 129" stroke="#3b82f6" strokeWidth="1" markerEnd="url(#arrowBlue)" opacity="0.5"/>
        <path d="M 176 138 L 176 150" stroke="#ef4444" strokeWidth="1" markerEnd="url(#arrowRed)" opacity="0.5"/>
        <path d="M 164 129 L 145 129" stroke="#ef4444" strokeWidth="1" markerEnd="url(#arrowRed)" opacity="0.5"/>
        <text x="64" y="168" textAnchor="middle" fontSize="7" fontWeight="700" fill="#2563eb">{t("left_block")}</text>
        <text x="176" y="168" textAnchor="middle" fontSize="7" fontWeight="700" fill="#dc2626">{t("right_block_label")}</text>
        <defs>
          <marker id="arrowRed" markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto"><path d="M0,0 L4,2 L0,4 Z" fill="#ef4444"/></marker>
          <marker id="arrowBlue" markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto"><path d="M0,0 L4,2 L0,4 Z" fill="#3b82f6"/></marker>
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

// ─── Quadrant selector ────────────────────────────────────────────────────────
const QUADRANT_MOVES = {
  rightBaseline: ["Drop Step (Baseline)", "Jump Hook", "Spin Move (Baseline)", "Fadeaway", "Baby Hook", "Back Down", "— Pass options —", "Pass to cutter", "Kick out to perimeter", "High-low pass"],
  rightMiddle: ["Drop Step (Middle)", "Cross Hook", "Up & Under", "Turnaround Jumper", "Face-up Drive", "Baby Hook", "Dream Shake", "— Pass options —", "Pass to cutter", "Kick out to perimeter", "High-low pass"],
  leftBaseline: ["Drop Step (Baseline)", "Jump Hook", "Spin Move (Baseline)", "Fadeaway", "Baby Hook", "Back Down", "— Pass options —", "Pass to cutter", "Kick out to perimeter", "High-low pass"],
  leftMiddle: ["Drop Step (Middle)", "Cross Hook", "Up & Under", "Turnaround Jumper", "Face-up Drive", "Baby Hook", "Dream Shake", "— Pass options —", "Pass to cutter", "Kick out to perimeter", "High-low pass"],
} as const;

const MOVE_DESC: Record<string, string> = {
  "Drop Step (Baseline)": t("move_desc_drop_step"), "Drop Step (Middle)": t("move_desc_drop_step"),
  "Jump Hook": t("move_desc_jump_hook"), "Cross Hook": t("move_desc_cross_hook"),
  "Up & Under": t("move_desc_up_under"), "Fadeaway": t("move_desc_fadeaway"),
  "Turnaround Jumper": t("move_desc_turnaround"), "Face-up Drive": t("move_desc_face_up_drive"),
  "Back Down": t("move_desc_back_down"), "Baby Hook": t("move_desc_baby_hook"),
  "Dream Shake": t("move_desc_dream_shake"), "Pass to cutter": t("move_desc_pass_cutter"),
  "Kick out to perimeter": t("move_desc_kick_out"), "High-low pass": t("move_desc_high_low"),
};

function PostQuadrantSelector({ value, onChange, dominantHand }: {
  value: PostQuadrants; onChange: (v: PostQuadrants) => void; dominantHand?: "Right" | "Left";
}) {
  const quadrants: { key: keyof PostQuadrants; label: string; side: "right" | "left" }[] = [
    { key: "rightBaseline", label: t("block_right_baseline"), side: "right" },
    { key: "rightMiddle", label: t("block_right_middle"), side: "right" },
    { key: "leftBaseline", label: t("block_left_baseline"), side: "left" },
    { key: "leftMiddle", label: t("block_left_middle"), side: "left" },
  ];
  const updateQ = (key: keyof PostQuadrants, moveName: string | null) => onChange({ ...value, [key]: moveName ? { moveName } : undefined });
  return (
    <div className="space-y-3">
      <FieldLabel label={t("post_moves_quadrant")} tooltip={`${t("hint_post_quadrant")} ${t("hint_motor_post_moves_quadrant")}`} />
      <HalfCourtDiagram dominant={dominantHand} />
      <div className="grid grid-cols-2 gap-2">
        {quadrants.map(q => {
          const current = value[q.key];
          const isRight = q.side === "right";
          const isStrongSide = dominantHand === "Right" ? isRight : !isRight;
          const borderColor = isRight
            ? current ? "border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/20" : "border-red-100 dark:border-red-900/30 bg-white dark:bg-slate-900"
            : current ? "border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20" : "border-blue-100 dark:border-blue-900/30 bg-white dark:bg-slate-900";
          const labelColor = isRight ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400";
          const moves = QUADRANT_MOVES[q.key];
          return (
            <div key={q.key} className={`rounded-xl border p-2.5 space-y-2 transition-all ${borderColor}`}>
              <div className="flex items-center justify-between gap-1">
                <p className={`text-[11px] font-bold leading-tight ${labelColor}`}>{q.label}{isStrongSide && dominantHand && <span className="ml-1">★</span>}</p>
                {current && <button type="button" onClick={() => updateQ(q.key, null)} className="text-slate-400 hover:text-red-400 shrink-0"><X className="w-3 h-3" /></button>}
              </div>
              <Select value={current?.moveName ?? "none"} onValueChange={v => updateQ(q.key, v === "none" || v.startsWith("—") ? null : v)}>
                <SelectTrigger className={`h-8 rounded-lg text-xs border ${isRight ? "border-red-200 dark:border-red-900 text-red-700 dark:text-red-300" : "border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300"} bg-white dark:bg-slate-800`}>
                  <SelectValue placeholder="Not observed" />
                </SelectTrigger>
                <SelectContent className="z-[100] max-h-64">
                  <SelectItem value="none"><span className="text-slate-400 text-xs">{t("not_observed")}</span></SelectItem>
                  {moves.map(move => move.startsWith("—") ? (
                    <div key={move} className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 border-t border-slate-100 dark:border-slate-800 mt-1 pt-2">Pass options</div>
                  ) : (
                    <SelectItem key={move} value={move}>
                      <div className="flex flex-col py-0.5">
                        <span className="font-semibold text-xs">{move}</span>
                        {MOVE_DESC[move] && <span className="text-[10px] text-slate-400 leading-tight">{MOVE_DESC[move]}</span>}
                      </div>
                    </SelectItem>
                  ))}
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
const getScreenerOptions = () => [
  { value: "Roll" as ScreenerAction, label: t("opt_screen_roll"), desc: t("screen_desc_roll") },
  { value: "Pop" as ScreenerAction, label: t("opt_screen_pop"), desc: t("screen_desc_pop") },
  { value: "Pop (Elbow / Mid)" as ScreenerAction, label: t("opt_screen_pop_elbow"), desc: t("screen_desc_pop_elbow") },
  { value: "Short Roll" as ScreenerAction, label: t("opt_screen_short_roll"), desc: t("screen_desc_short_roll") },
  { value: "Slip" as ScreenerAction, label: t("opt_screen_slip"), desc: t("screen_desc_slip") },
  { value: "Lob Only" as ScreenerAction, label: t("opt_screen_lob"), desc: t("screen_desc_lob") },
];

function ScreenerActionSelector({ primaryValue, secondaryValue, onPrimaryChange, onSecondaryChange }: {
  primaryValue: ScreenerAction; secondaryValue?: ScreenerAction;
  onPrimaryChange: (v: ScreenerAction) => void; onSecondaryChange: (v: ScreenerAction | undefined) => void;
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
                <p className={`font-bold text-xs ${primaryValue === opt.value ? "text-blue-700 dark:text-blue-300" : "text-slate-800 dark:text-slate-200"}`}>{opt.label}</p>
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
  const { t, locale } = useLocale();
  const [, params] = useRoute("/coach/player/:id");
  const [, setLocation] = useLocation();
  const search = useSearch();
  const isNew = params?.id === "new";
  const urlPlayerId = params?.id || "";
  const searchTeamId = new URLSearchParams(search).get("team") || "";

  const createdIdRef = useRef<string | null>(null);
  const getPlayerId = () => createdIdRef.current || urlPlayerId;
  const isSaving = useRef(false);

  const { data: teams = [], isLoading: teamsLoading } = useTeams();
  const { data: existingPlayer, isLoading: playerLoading } = usePlayer(isNew ? "" : urlPlayerId);
  const { data: clubPayload } = useClub();
  const motorClubContext = useMemo(() => clubRowToMotorContext(clubPayload?.club), [clubPayload?.club]);
  const createPlayerMutation = useCreatePlayer();
  const updatePlayerMutation = useUpdatePlayer();
  const deletePlayerMutation = useDeletePlayer();

  const [player, setPlayer] = useState<Omit<PlayerProfile, "id"> & { id?: string } | null>(null);
  const [inputs, setInputs] = useState<PlayerInput | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [showSaveFlash, setShowSaveFlash] = useState(false);
  const [personalityAccordionOpen, setPersonalityAccordionOpen] = useState(false);
  const isDirty = useRef(false);
  const latestPlayerRef = useRef(player);
  const latestInputsRef = useRef(inputs);
  const isNewRef = useRef(isNew);
  const firstUserEditAtRef = useRef<number | null>(null);
  const touchedFieldKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => { latestPlayerRef.current = player; latestInputsRef.current = inputs; }, [player, inputs]);
  useEffect(() => { isNewRef.current = isNew; }, [isNew]);

  useEffect(() => {
    if (!isNew || teamsLoading || teams.length === 0) return;
    const tid = searchTeamId || teams[0].id;
    const defaultP = createDefaultPlayer(tid);
    setPlayer(defaultP); setInputs(defaultP.inputs);
    firstUserEditAtRef.current = null; touchedFieldKeysRef.current = new Set();
  }, [isNew, teamsLoading, teams.length, searchTeamId]);

  useEffect(() => {
    if (!isNew && existingPlayer) {
      let ins = existingPlayer.inputs;
      if (ins.isoWeakHandFinish == null && ins.isoOppositeFinish) { const h = legacyOppositeToIsoWeakFinish(ins.isoOppositeFinish); if (h) ins = { ...ins, isoWeakHandFinish: h }; }
      if (ins.offBallScreenPattern == null && ins.screenerAction) { const p = legacyScreenerToScreenPattern(ins.screenerAction); if (p) ins = { ...ins, offBallScreenPattern: p }; }
      setPlayer(existingPlayer); setInputs(ins);
    } else if (!isNew && !playerLoading && !existingPlayer) setLocation("/coach");
  }, [isNew, existingPlayer, playerLoading]);

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runAutoSaveAttempt = async () => {
    const currentPlayer = latestPlayerRef.current; const currentInputs = latestInputsRef.current;
    if (!currentPlayer || !currentInputs || isSaving.current) return;
    const brandNewSession = isNewRef.current && !createdIdRef.current;
    if (brandNewSession) {
      if (firstUserEditAtRef.current == null || touchedFieldKeysRef.current.size === 0) return;
      const elapsed = Date.now() - firstUserEditAtRef.current;
      if (touchedFieldKeysRef.current.size < 3 || elapsed < 10_000) {
        const delay = touchedFieldKeysRef.current.size < 3 ? 800 : Math.max(250, 10_000 - elapsed);
        autoSaveTimer.current = setTimeout(() => { void runAutoSaveAttempt(); }, delay); return;
      }
    }
    isSaving.current = true;
    const finalName = currentPlayer.name.trim() || "Unnamed Player";
    const generated = generateProfile(currentInputs, currentPlayer?.name, motorClubContext);
    const updated = { ...currentPlayer, name: finalName, inputs: currentInputs, internalModel: generated.internalModel, archetype: generated.archetype, subArchetype: generated.subArchetype, keyTraits: generated.keyTraits, defensivePlan: generated.defensivePlan };
    const currentId = getPlayerId();
    if (!currentId || currentId === "new") {
      createPlayerMutation.mutate(updated as Omit<PlayerProfile, "id">, { onSuccess: (created: PlayerProfile) => { createdIdRef.current = created.id; isSaving.current = false; }, onError: () => { isSaving.current = false; } });
    } else {
      updatePlayerMutation.mutate({ id: currentId, updates: updated }, { onSuccess: () => { isSaving.current = false; }, onError: () => { isSaving.current = false; } });
    }
    setDraftSaved(true); setTimeout(() => setDraftSaved(false), 2000); isDirty.current = false;
  };

  const triggerAutoSave = () => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => { void runAutoSaveAttempt(); }, 1500);
  };

  if ((isNew ? teamsLoading : playerLoading) || !player || !inputs) {
    return <div className="flex flex-col min-h-[100dvh] bg-slate-50 dark:bg-slate-950 items-center justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  const handleSave = async () => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    const finalName = player.name.trim() || "Unnamed Player";
    const generated = generateProfile(inputs, finalName, motorClubContext);
    const updated = {
      ...player,
      name: finalName,
      inputs,
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
        const created = await createPlayerMutation.mutateAsync(updated as Omit<PlayerProfile, "id">);
        createdIdRef.current = created.id;
      } else {
        await updatePlayerMutation.mutateAsync({ id: currentId, updates: updated });
      }
    } catch {}
    setTimeout(() => setShowSaveFlash(false), 600);
  };

  const ui = (key: keyof PlayerInput, value: any) => {
    setInputs(prev => {
      if (!prev) return prev;
      isDirty.current = true;
      if (isNewRef.current && !createdIdRef.current) { if (firstUserEditAtRef.current == null) firstUserEditAtRef.current = Date.now(); touchedFieldKeysRef.current.add(String(key)); }
      triggerAutoSave();
      return { ...prev, [key]: value };
    });
  };
  const um = (key: keyof PlayerProfile, value: string) => {
    setPlayer(prev => {
      if (!prev) return prev;
      isDirty.current = true;
      if (isNewRef.current && !createdIdRef.current) { if (firstUserEditAtRef.current == null) firstUserEditAtRef.current = Date.now(); touchedFieldKeysRef.current.add(`profile:${String(key)}`); }
      triggerAutoSave();
      return { ...prev, [key]: value };
    });
  };

  const postActive = inputs.postFrequency === "Primary" || inputs.postFrequency === "Secondary";
  const pnrBoth = inputs.pnrRole === "Both";
  const showHandlerSection = inputs.pnrRole === "Handler" || pnrBoth;
  const showScreenerSection = inputs.pnrRole === "Screener" || pnrBoth;
  const showOppositeFinishInISO = inputs.isoFrequency !== "Never";
  const showOppositeFinishInPNR = inputs.isoFrequency === "Never" && inputs.pnrFrequency !== "Never" && showHandlerSection;

  return (
    <div className="flex flex-col min-h-[100dvh] bg-slate-50 dark:bg-slate-950">
      {showSaveFlash && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] pointer-events-none">
          <div className="flex flex-col items-center gap-1 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-900/90 dark:bg-white/90 backdrop-blur-md rounded-2xl px-6 py-4 shadow-2xl border border-white/10 flex flex-col items-center gap-2">
              <span className="text-4xl font-black italic text-white dark:text-slate-900 leading-none tracking-tighter">U</span>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60 dark:text-slate-900/60">{t("editor_inputs_saved")}</span>
            </div>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          {/* Botón volver al review — solo para jugadoras existentes */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (isNew) setLocation("/coach/editor");
              else setLocation(`/coach/scout/${getPlayerId()}/review`);
            }}
            className="-ml-2 gap-1.5 text-xs font-bold text-muted-foreground"
            data-testid="player-editor-back"
          >
            <ArrowLeft className="w-4 h-4" />
            {isNew ? t("back") : t("editor_back_to_report")}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {!isNew && (
            confirmDelete ? (
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)} className="text-xs h-8 px-2 text-slate-500">
                  {t("cancel")}
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    const id = getPlayerId();
                    setLocation("/coach");
                    if (id && id !== "new") setTimeout(() => deletePlayerMutation.mutate(id), 150);
                  }}
                  className="rounded-full h-8 px-3 font-bold bg-red-500 hover:bg-red-600 text-white text-xs"
                >
                  {t("delete")}
                </Button>
              </div>
            ) : (
              <Button size="icon" variant="ghost" onClick={() => setConfirmDelete(true)} className="text-slate-400 hover:text-red-500">
                <Trash2 className="w-4 h-4" />
              </Button>
            )
          )}
          <Button
            size="sm"
            onClick={handleSave}
            className="rounded-full px-5 font-bold bg-primary hover:bg-primary/90 text-white shadow-md"
          >
            <Save className="w-4 h-4 mr-1.5" />
            {t("editor_save_inputs")}
          </Button>
        </div>
      </header>

      <main className="flex-1 p-4 pb-24">
        <Tabs defaultValue="context" className="w-full">
          <TabsList className="grid w-full grid-cols-6 mb-6 p-1 bg-slate-200/60 dark:bg-slate-800/60 rounded-xl shadow-inner">
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
            <TabsTrigger value="spot" className="rounded-lg text-[10px] sm:text-xs font-bold py-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm text-slate-600 dark:text-slate-400 data-[state=active]:text-pink-600 dark:data-[state=active]:text-pink-400">
              <span className="text-[11px] sm:text-xs font-black md:mr-1 text-pink-500">3</span>
              <span className="hidden md:inline">{t("tab_spot")}</span>
            </TabsTrigger>
          </TabsList>

          {/* ── CONTEXT ── */}
          <TabsContent value="context" className="space-y-4 animate-in fade-in slide-in-from-bottom-2">

            {/* Identidad */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 space-y-4 border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="font-bold text-lg flex items-center gap-2 text-slate-900 dark:text-white"><Info className="w-5 h-5 text-primary" /> {t("identity")}</h3>
              <PlayerAvatarUpload imageUrl={player.imageUrl} onUpload={url => um("imageUrl", url)} />

              {/* Nombre + superestrella — diseño vertical */}
              <div className="space-y-1.5">
                <FieldLabel label={t("player_name")} />
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50/80 dark:bg-slate-950/40 shadow-sm">
                  <div className="flex gap-2 items-center p-2">
                    <Input value={player.name} onChange={e => um("name", e.target.value)} placeholder={t("placeholder_player_name")}
                      className="flex-1 min-w-0 h-11 rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950/80" aria-describedby="star-caption" />
                    {/* Botón superestrella — vertical con icono + texto */}
                    <button type="button"
                      className={`shrink-0 flex flex-col items-center justify-center gap-0.5 h-11 w-14 rounded-lg border transition-colors ${inputs.starPlayer === true ? "border-amber-400/60 bg-amber-500/15 text-amber-500" : "border-slate-200 dark:border-slate-700 text-slate-400 bg-white dark:bg-slate-950/80 hover:border-amber-300 hover:text-amber-400"}`}
                      onClick={() => ui("starPlayer", inputs.starPlayer !== true)} aria-label={t("editor.star_player")} aria-pressed={inputs.starPlayer === true}>
                      <Star className={`w-4 h-4 ${inputs.starPlayer === true ? "fill-amber-400 text-amber-400" : "fill-none"}`} strokeWidth={inputs.starPlayer === true ? 0 : 1.5} />
                      <span className="text-[9px] font-bold leading-none">{inputs.starPlayer === true ? t("editor.star_player_badge_label") : t("star")}</span>
                    </button>
                  </div>
                  {/* Caption siempre debajo, mismo ancho */}
                  <div id="star-caption" className={`flex items-center gap-2 px-3 py-2 border-t text-xs transition-colors ${inputs.starPlayer === true ? "border-amber-400/25 bg-amber-500/[0.08]" : "border-slate-200/90 dark:border-slate-700/90 bg-slate-100/60 dark:bg-slate-900/50"}`}>
                    <Star className={`w-3 h-3 shrink-0 ${inputs.starPlayer === true ? "fill-amber-400 text-amber-400" : "text-slate-400 fill-none"}`} strokeWidth={inputs.starPlayer === true ? 0 : 1.5} aria-hidden />
                    <span className={`text-[11px] ${inputs.starPlayer === true ? "text-amber-700 dark:text-amber-300 font-semibold" : "text-slate-500 dark:text-slate-400"}`}>{t("editor.star_player_limit_note")}</span>
                    <Tooltip text={`${t("editor.star_player_hint")}\n\n${t("editor.star_player_limit_note")}`} />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <FieldLabel label={t("team")} />
                <Select value={player.teamId} onValueChange={v => setPlayer(prev => prev ? { ...prev, teamId: v } : prev)} disabled={teams.length < 2}>
                  <SelectTrigger className="h-12 rounded-xl bg-slate-50 dark:bg-slate-950/50 dark:border-slate-800"><SelectValue /></SelectTrigger>
                  <SelectContent>{teams.map(tm => <SelectItem key={tm.id} value={tm.id}>{tm.logo} {tm.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <FieldLabel label={t("number")} />
                  <Input value={player.number} onChange={e => um("number", e.target.value)} placeholder="e.g. 23" className="bg-slate-50 dark:bg-slate-950/50 h-12 rounded-xl dark:border-slate-800" />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel label={t("position")} tooltip={t("hint_position")} />
                  <div className="flex flex-wrap" style={{ flexWrap: "wrap", gap: 8 }}>
                    {(["PG","SG","SF","PF","C"] as const).map(pos => {
                      const parts = (inputs.position ?? "").split("/").filter(Boolean);
                      const selected = parts.includes(pos);
                      return (
                        <button key={pos} type="button" style={{ minHeight: 44 }}
                          onClick={() => { if (selected) { ui("position", parts.filter(p => p !== pos).join("/") || pos); } else { ui("position", parts.length === 0 ? pos : `${parts[0]}/${pos}`); } }}
                          className={`inline-flex min-h-11 min-w-11 items-center justify-center px-3 py-2 rounded-xl text-sm font-bold border transition-all ${selected ? pillActiveClasses("neutral") : "bg-transparent border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"}`}>
                          {pos}
                        </button>
                      );
                    })}
                  </div>
                  {inputs.position?.includes("/") && <p className="text-xs text-primary font-semibold">{t("hybrid_detection_active").replace("{position}", inputs.position)}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <FieldLabel label={t("height")} />
                  <Input value={inputs.height} onChange={e => ui("height", e.target.value)} onFocus={e => { if (e.target.value === "183 cm") ui("height", ""); }} placeholder="e.g. 195 cm" className="bg-slate-50 dark:bg-slate-950/50 h-12 rounded-xl dark:border-slate-800" />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel label={t("weight")} />
                  <Input value={inputs.weight} onChange={e => ui("weight", e.target.value)} onFocus={e => { if (e.target.value === "82 kg") ui("weight", ""); }} placeholder="e.g. 95 kg" className="bg-slate-50 dark:bg-slate-950/50 h-12 rounded-xl dark:border-slate-800" />
                </div>
              </div>

              {/* Mano dominante — aquí, campo general */}
              <div className="space-y-2">
                <FieldLabel label={t("post_dominant_hand")} tooltip={t("hint_post_dominant_hand")} />
                <div className="flex flex-wrap" style={{ flexWrap: "wrap", gap: 12 }}>
                  {(["Right", "Left"] as const).map(h => (
                    <Button key={h} type="button" variant={inputs.postDominantHand === h ? "default" : "outline"}
                      style={{ minHeight: 44 }}
                      className={`h-auto min-h-11 min-w-11 flex-1 px-4 rounded-xl text-sm font-bold ${inputs.postDominantHand === h ? pillActiveClasses("neutral") : "bg-transparent border-slate-200 dark:border-slate-700 dark:text-slate-300"}`}
                      onClick={() => ui("postDominantHand", h)}>
                      {h === "Right" ? `🤜 ${t("right_hand")}` : `🤛 ${t("left_hand")}`}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* Perfil físico */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 space-y-5 border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="font-bold text-lg flex items-center gap-2 text-slate-900 dark:text-white">💪 {t("physical_profile")}</h3>
              {/* Todas las barras con el mismo color (primary) */}
              <PowerBar label={t("athleticism")} value={inputs.athleticism} onChange={v => ui("athleticism", v)} tooltip={t("hint_athleticism")} />
              <PowerBar label={t("physical_strength")} value={inputs.physicalStrength} onChange={v => ui("physicalStrength", v)} tooltip={t("hint_physical_strength")} />
              <PowerBar label={t("court_vision")} value={inputs.courtVision ?? 3} onChange={v => ui("courtVision", v)} tooltip={t("hint_court_vision")} />

              {/* Contacto en penetración — aplica a ISO, PnR y cualquier drive */}
              <div className="space-y-2">
                <FieldLabel label={t("editor.contact_type_heading")} tooltip={t("hint_contact_type")} />
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { v: "seeks" as const, labelKey: "editor.contact_seeks", emoji: "💥" },
                      { v: "absorbs" as const, labelKey: "editor.contact_absorbs", emoji: "🛡️" },
                      { v: "avoids" as const, labelKey: "editor.contact_avoids", emoji: "💨" },
                    ] as const
                  ).map(({ v, labelKey, emoji }) => (
                    <Button
                      key={v}
                      type="button"
                      variant={inputs.contactType === v ? "default" : "outline"}
                      style={{ minHeight: 44 }}
                      className={`h-auto min-h-11 gap-2 rounded-full px-4 text-sm font-semibold ${inputs.contactType === v ? pillActiveClasses("neutral") : "border-slate-200 bg-transparent dark:border-slate-700"}`}
                      onClick={() => ui("contactType", inputs.contactType === v ? null : v)}
                    >
                      <span aria-hidden>{emoji}</span>
                      {t(labelKey as never)}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant={inputs.contactType == null ? "secondary" : "outline"}
                    style={{ minHeight: 44 }}
                    className="h-auto min-h-11 rounded-full px-4 text-sm font-semibold"
                    onClick={() => ui("contactType", null)}
                  >
                    {t("not_observed")}
                  </Button>
                </div>
              </div>

            </div>

            {/* Tiros libres y provocación de faltas */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 space-y-5 border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="font-bold text-lg flex items-center gap-2 text-slate-900 dark:text-white">🎯 {t("free_throws_fouling")}</h3>
              <PowerBar label={t("ft_shooting")} value={(inputs as any).ftShooting ?? 3} onChange={v => ui("ftShooting" as any, v)} tooltip={t("hint_ft_shooting")} />
              <PowerBar label={t("foul_drawing")} value={(inputs as any).foulDrawing ?? 2} onChange={v => ui("foulDrawing" as any, v)} tooltip={t("hint_foul_drawing")} />
            </div>

            {/* Manejo de balón */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 space-y-5 border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="font-bold text-lg flex items-center gap-2 text-slate-900 dark:text-white">🏀 {t("editor.ball_handling")}</h3>
              <div className="space-y-2">
                <FieldLabel label={t("editor.ball_handling")} tooltip={t("editor.ball_handling_hint")} />
                <Select value={inputs.motorBallHandling ?? "__none__"} onValueChange={v => ui("motorBallHandling", v === "__none__" ? null : v as NonNullable<PlayerInput["motorBallHandling"]>)}>
                  <SelectTrigger className="h-12 rounded-xl bg-slate-50 dark:bg-slate-950/50 dark:border-slate-800"><SelectValue placeholder={t("not_observed")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t("not_observed")}</SelectItem>
                    <SelectItem value="elite">{t("editor.ball_handling.elite")}</SelectItem>
                    <SelectItem value="capable">{t("editor.ball_handling.capable")}</SelectItem>
                    <SelectItem value="limited">{t("editor.ball_handling.limited")}</SelectItem>
                    <SelectItem value="liability">{t("editor.ball_handling.liability")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* Manejo bajo presión — presión física en toda la pista, diferente al trap PnR */}
              <div className="space-y-2">
                <FieldLabel label={t("editor.pressure_response")} tooltip={t("hint_motor_pressure")} />
                <Select value={inputs.motorPressureResponse ?? "__none__"} onValueChange={v => ui("motorPressureResponse", v === "__none__" ? null : v as NonNullable<PlayerInput["motorPressureResponse"]>)}>
                  <SelectTrigger className="h-12 rounded-xl bg-slate-50 dark:bg-slate-950/50 dark:border-slate-800"><SelectValue placeholder={t("not_observed")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t("not_observed")}</SelectItem>
                    <SelectItem value="breaks">{t("editor.pressure.breaks")}</SelectItem>
                    <SelectItem value="escapes">{t("editor.pressure.escapes")}</SelectItem>
                    <SelectItem value="struggles">{t("editor.pressure.struggles")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>



            {/* Personalidad */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                <button type="button" onClick={() => setPersonalityAccordionOpen(o => !o)}
                  className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                  <span className="font-medium text-sm text-slate-900 dark:text-white">{t("editor.personality")}</span>
                  <ChevronDown className={`w-4 h-4 shrink-0 text-slate-500 transition-transform duration-200 ${personalityAccordionOpen ? "rotate-180" : ""}`} />
                </button>
                {personalityAccordionOpen && (
                  <div className="px-4 pb-4 pt-0 flex flex-col gap-3">
                    <div className="flex flex-wrap" style={{ flexWrap: "wrap", gap: 12 }}>
                      {PERSONALITY_TRAITS.filter(pt => pt.tone === "positive").map(pt => {
                        const active = (inputs.personality ?? []).includes(pt.id);
                        return <Button key={pt.id} type="button" variant={active ? "default" : "outline"} style={{ minHeight: 44 }} className={`h-auto min-h-11 px-4 py-2 rounded-lg text-sm font-semibold ${active ? "bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-600" : "border-slate-200 dark:border-slate-700"}`} onClick={() => { const list = inputs.personality ?? []; ui("personality", list.includes(pt.id) ? list.filter(x => x !== pt.id) || null : [...list, pt.id]); }}>{t(pt.i18nKey as never)}</Button>;
                      })}
                    </div>
                    <div className="flex flex-wrap" style={{ flexWrap: "wrap", gap: 12 }}>
                      {PERSONALITY_TRAITS.filter(pt => pt.tone === "negative").map(pt => {
                        const active = (inputs.personality ?? []).includes(pt.id);
                        return <Button key={pt.id} type="button" variant={active ? "default" : "outline"} style={{ minHeight: 44 }} className={`h-auto min-h-11 px-4 py-2 rounded-lg text-sm font-semibold ${active ? "bg-amber-500 border-amber-500 text-white hover:bg-amber-500" : "border-slate-200 dark:border-slate-700"}`} onClick={() => { const list = inputs.personality ?? []; ui("personality", list.includes(pt.id) ? list.filter(x => x !== pt.id) || null : [...list, pt.id]); }}>{t(pt.i18nKey as never)}</Button>;
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
              <IntensitySelector label={t("post_frequency")} value={inputs.postFrequency} onChange={v => ui("postFrequency", v)} tooltip={t("hint_post_frequency")} />

              {postActive && (
                <>
                  {/* Perfil de juego */}
                  <div className="space-y-2">
                    <FieldLabel label={t("post_profile")} tooltip={t("hint_post_profile")} />
                    <Select value={inputs.postProfile ?? "Back to Basket"} onValueChange={v => ui("postProfile", v)}>
                      <SelectTrigger className="h-12 rounded-xl bg-slate-50 dark:bg-slate-950/50 dark:border-slate-800"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Back to Basket">{t("opt_post_back_to_basket")}</SelectItem>
                        <SelectItem value="Face-Up">{t("opt_post_face_up")}</SelectItem>
                        <SelectItem value="Mixed">{t("opt_post_mixed")}</SelectItem>
                        <SelectItem value="High Post">{t("opt_post_high_post")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Cómo entra — principal */}
                  <div className="space-y-2">
                    <FieldLabel label={t("editor.post_entry")} tooltip={t("hint_motor_post_entry")} />
                    <Select value={inputs.motorPostEntry ?? "__none__"} onValueChange={v => ui("motorPostEntry", v === "__none__" ? null : v as PlayerInput["motorPostEntry"])}>
                      <SelectTrigger className="h-12 rounded-xl bg-slate-50 dark:bg-slate-950/50 dark:border-slate-800"><SelectValue placeholder={t("not_observed")} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">{t("not_observed")}</SelectItem>
                        <SelectItem value="duck_in">{t("editor.post_entry.duck_in")}</SelectItem>
                        <SelectItem value="seal">{t("editor.post_entry.seal")}</SelectItem>
                        <SelectItem value="flash">{t("editor.post_entry.flash")}</SelectItem>
                        <SelectItem value="pass">{t("editor.post_entry.pass")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Cómo entra — secundaria */}
                  <div className="space-y-2">
                    <FieldLabel label={t("editor.post_entry_secondary")} tooltip={t("hint_motor_post_entry_secondary")} />
                    <Select value={inputs.motorPostEntrySecondary ?? "__none__"} onValueChange={v => ui("motorPostEntrySecondary", v === "__none__" ? null : v as PlayerInput["motorPostEntrySecondary"])}>
                      <SelectTrigger className="h-12 rounded-xl bg-slate-50 dark:bg-slate-950/50 dark:border-slate-800"><SelectValue placeholder={t("not_observed")} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">{t("not_observed")}</SelectItem>
                        <SelectItem value="duck_in">{t("editor.post_entry.duck_in")}</SelectItem>
                        <SelectItem value="seal">{t("editor.post_entry.seal")}</SelectItem>
                        <SelectItem value="flash">{t("editor.post_entry.flash")}</SelectItem>
                        <SelectItem value="pass">{t("editor.post_entry.pass")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Movimientos por cuadrante */}
                  <PostQuadrantSelector value={inputs.postQuadrants ?? {}} onChange={v => ui("postQuadrants", v)} dominantHand={inputs.postDominantHand} />

                  {/* High post zones */}
                  <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{t("editor.high_post_zones")}</p>
                    <div className="grid grid-cols-2 gap-3">
                      {([{ zone: "leftElbow" as const, labelKey: "editor.high_post_zone.leftElbow" }, { zone: "rightElbow" as const, labelKey: "editor.high_post_zone.rightElbow" }] as const).map(({ zone, labelKey }) => {
                        const hz = (inputs.highPostZones ?? {}) as HighPostZonesMotor;
                        const v = hz[zone] ?? null;
                        return (
                          <div key={zone} className="rounded-xl border border-purple-200/60 dark:border-purple-900/50 bg-purple-50/40 dark:bg-purple-950/20 p-2.5 space-y-2">
                            <Label className="text-[11px] font-bold uppercase tracking-wide text-purple-700 dark:text-purple-300">{t(labelKey as never)}</Label>
                            <Select value={v ?? "__none__"} onValueChange={val => { const next: HighPostZonesMotor = { ...(inputs.highPostZones ?? {}) }; if (val === "__none__") delete next[zone]; else next[zone] = val as HighPostAction; ui("highPostZones", Object.keys(next).length ? next : {}); }}>
                              <SelectTrigger className="h-10 rounded-xl bg-white dark:bg-slate-900 dark:border-slate-800 text-xs"><SelectValue placeholder={t("not_observed")} /></SelectTrigger>
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

                  {/* Eficiencia */}
                  <div className="space-y-2">
                    <FieldLabel label={t("editor.post_eff")} tooltip={t("hint_motor_post_eff")} />
                    <Select value={inputs.motorPostEff ?? "__none__"} onValueChange={v => ui("motorPostEff", v === "__none__" ? null : v as PlayerInput["motorPostEff"])}>
                      <SelectTrigger className="h-12 rounded-xl bg-slate-50 dark:bg-slate-950/50 dark:border-slate-800"><SelectValue placeholder={t("not_observed")} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">{t("not_observed")}</SelectItem>
                        <SelectItem value="high">{t("editor.eff.high")}</SelectItem>
                        <SelectItem value="medium">{t("editor.eff.medium")}</SelectItem>
                        <SelectItem value="low">{t("editor.eff.low")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Ante el doble equipo */}
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
                </>
              )}
            </div>
          </TabsContent>

          {/* ── ISO ── */}
          <TabsContent value="iso" className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 space-y-5 border border-slate-200 dark:border-slate-800 shadow-sm border-l-4 border-l-orange-500">
              <h3 className="font-bold text-lg flex items-center gap-2 text-slate-900 dark:text-white"><Flame className="w-5 h-5 text-orange-500" /> {t("section_iso")}</h3>
              <IntensitySelector label={t("iso_frequency")} value={inputs.isoFrequency} onChange={v => ui("isoFrequency", v)} tooltip={t("hint_iso_frequency")} />

              {inputs.isoFrequency !== "Never" && (
                <>
                  {/* Dirección preferida */}
                  <div className="space-y-2">
                    <FieldLabel label={t("iso_dominant_direction")} tooltip={t("hint_iso_dominant_direction")} />
                    <div className="flex flex-wrap" style={{ flexWrap: "wrap", gap: 12 }}>
                      {(["Left", "Right", "Balanced"] as const).map(dir => (
                        <Button key={dir} type="button" variant={inputs.isoDominantDirection === dir ? "default" : "outline"}
                          style={{ minHeight: 44 }}
                          className={`h-auto min-h-11 min-w-11 flex-1 px-4 rounded-xl text-sm ${inputs.isoDominantDirection === dir ? pillActiveClasses("neutral") : "bg-transparent border-slate-200 dark:border-slate-700 dark:text-slate-300"}`}
                          onClick={() => ui("isoDominantDirection", dir)}>
                          {dir === "Left" ? t("opt_dir_left") : dir === "Right" ? t("opt_dir_right") : t("opt_dir_balanced")}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Decisión al crear ventaja */}
                  <div className="space-y-2">
                    <FieldLabel label={t("iso_decision")} tooltip={t("hint_iso_decision")} />
                    <div className="flex flex-wrap" style={{ flexWrap: "wrap", gap: 12 }}>
                      {([{ v: "Finish" as const, labelKey: "opt_iso_decision_finish" }, { v: "Shoot" as const, labelKey: "balanced" }, { v: "Pass" as const, labelKey: "opt_iso_decision_pass" }] as const).map(({ v, labelKey }) => (
                        <Button key={v} type="button" variant={inputs.isoDecision === v ? "default" : "outline"}
                          style={{ minHeight: 44 }}
                          className={`h-auto min-h-11 min-w-11 flex-1 px-4 rounded-xl text-sm ${inputs.isoDecision === v ? pillActiveClasses("neutral") : "bg-transparent border-slate-200 dark:border-slate-700 dark:text-slate-300"}`}
                          onClick={() => ui("isoDecision", v)}>
                          {t(labelKey as never)}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Iniciación */}
                  <div className="space-y-2">
                    <FieldLabel label={t("iso_initiation")} tooltip={t("hint_iso_initiation")} />
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        type="button"
                        variant={inputs.isoInitiation === "Controlled" ? "default" : "outline"}
                        style={{ minHeight: 56 }}
                        className={`h-auto flex flex-col items-center justify-center gap-0.5 px-3 py-3 rounded-xl text-sm font-semibold ${inputs.isoInitiation === "Controlled" ? pillActiveClasses("neutral") : "border-slate-200 dark:border-slate-700"}`}
                        onClick={() => ui("isoInitiation", "Controlled")}
                      >
                        <span className="font-semibold">{t("opt_iso_init_controlled")}</span>
                        <span className="text-xs opacity-60 font-normal">jab / reads first</span>
                      </Button>

                      <Button
                        type="button"
                        variant={inputs.isoInitiation === "Quick Attack" ? "default" : "outline"}
                        style={{ minHeight: 56 }}
                        className={`h-auto flex flex-col items-center justify-center gap-0.5 px-3 py-3 rounded-xl text-sm font-semibold ${inputs.isoInitiation === "Quick Attack" ? pillActiveClasses("neutral") : "border-slate-200 dark:border-slate-700"}`}
                        onClick={() => ui("isoInitiation", "Quick Attack")}
                      >
                        <span className="font-semibold">{t("opt_iso_init_quick")}</span>
                        <span className="text-xs opacity-60 font-normal">off the catch</span>
                      </Button>
                    </div>
                  </div>

                  {/* Finalización por lado */}
                  <div className="space-y-2">
                    <FieldLabel label={t("editor.iso_finish_by_side")} tooltip={t("hint_iso_finish_by_side")} />
                    <div className="grid grid-cols-2 gap-3">
                      {([{ field: "isoFinishLeft" as const, labelKey: "left" }, { field: "isoFinishRight" as const, labelKey: "right" }] as const).map(({ field, labelKey }) => (
                        <div key={field} className="space-y-2">
                          <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">{t(labelKey as never)}</Label>
                          <div className="flex flex-row flex-wrap gap-1">
                            {([{ v: "drive" as const, lk: "opt_finish_drive" }, { v: "floater" as const, lk: "opt_finish_floater" }, { v: "pullup" as const, lk: "opt_finish_pullup" }, { v: "pass" as const, lk: "opt_iso_decision_pass" }] as const).map(({ v, lk }) => (
                              <Button key={v} type="button" variant={inputs[field] === v ? "default" : "outline"} style={{ minHeight: 40 }}
                                className={`h-auto min-h-10 px-3 py-2 rounded-lg text-xs font-semibold ${inputs[field] === v ? pillActiveClasses("neutral") : "border-slate-200 dark:border-slate-700"}`}
                                onClick={() => ui(field, inputs[field] === v ? null : v)}>
                                {t(lk as never)}
                              </Button>
                            ))}
                            <Button type="button" variant={inputs[field] == null ? "secondary" : "outline"} style={{ minHeight: 40 }}
                              className="h-auto min-h-10 px-3 py-2 rounded-lg text-xs font-semibold" onClick={() => ui(field, null)}>
                              {t("not_observed")}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ¿Finaliza con mano contraria? — solo si ISO activo */}
                  {showOppositeFinishInISO && (
                    <div className="space-y-2">
                      <FieldLabel label={t("iso_opposite_finish")} tooltip={t("hint_iso_opposite_finish")} />
                      <div className="flex flex-wrap gap-3">
                        {([{ v: "Drive" as const, labelKey: "opt_iso_opposite_yes" }, { v: "Pass" as const, labelKey: "opt_iso_opposite_no" }] as const).map(({ v, labelKey }) => (
                          <Button key={v} type="button" variant={inputs.isoOppositeFinish === v ? "default" : "outline"}
                            style={{ minHeight: 44 }}
                            className={`h-auto min-h-11 px-4 rounded-xl text-sm font-semibold ${inputs.isoOppositeFinish === v ? pillActiveClasses("neutral") : "border-slate-200 dark:border-slate-700"}`}
                            onClick={() => ui("isoOppositeFinish", inputs.isoOppositeFinish === v ? undefined : v)}>
                            {t(labelKey as never)}
                          </Button>
                        ))}
                        <Button type="button" variant={inputs.isoOppositeFinish == null ? "secondary" : "outline"} style={{ minHeight: 44 }}
                          className="h-auto min-h-11 px-4 py-2 rounded-xl text-sm font-semibold" onClick={() => ui("isoOppositeFinish", undefined)}>
                          {t("not_observed")}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Eficiencia ISO */}
                  <div className="space-y-2">
                    <FieldLabel label={t("editor_iso_finish_eff")} tooltip={t("hint_iso_finish_eff")} />
                    <div className="flex flex-wrap" style={{ flexWrap: "wrap", gap: 12 }}>
                      {(["high", "medium", "low"] as const).map(lvl => (
                        <Button key={lvl} type="button" variant={inputs.motorIsoEff === lvl ? "default" : "outline"}
                          style={{ minHeight: 44 }}
                          className={`h-auto min-h-11 min-w-11 flex-1 px-4 rounded-xl text-sm font-semibold ${inputs.motorIsoEff === lvl ? pillActiveClasses("neutral") : "border-slate-200 dark:border-slate-700"}`}
                          onClick={() => ui("motorIsoEff", inputs.motorIsoEff === lvl ? null : lvl)}>
                          {lvl === "high" ? t("opt_eff_high") : lvl === "medium" ? t("opt_eff_medium") : t("opt_eff_low")}
                        </Button>
                      ))}
                      <Button type="button" variant={inputs.motorIsoEff == null ? "secondary" : "outline"} style={{ minHeight: 44 }}
                        className="h-auto min-h-11 px-4 py-2 rounded-xl text-sm font-semibold" onClick={() => ui("motorIsoEff", null)}>
                        {t("not_observed")}
                      </Button>
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
              <IntensitySelector label={t("pnr_frequency")} value={inputs.pnrFrequency} onChange={v => ui("pnrFrequency", v)} tooltip={t("hint_pnr_frequency")} />

              {inputs.pnrFrequency !== "Never" && (
                <>
                  {/* Rol */}
                  <div className="space-y-2">
                    <FieldLabel label={t("pnr_role")} tooltip={t("hint_pnr_role")} />
                    <div className="flex flex-wrap" style={{ flexWrap: "wrap", gap: 12 }}>
                      {(["Handler", "Screener", "Both"] as const).map(v => (
                        <Button key={v} type="button" variant={inputs.pnrRole === v ? "default" : "outline"}
                          style={{ minHeight: 44 }}
                          className={`h-auto min-h-11 min-w-11 flex-1 px-4 rounded-xl text-sm font-bold ${inputs.pnrRole === v ? pillActiveClasses("neutral") : "bg-transparent border-slate-200 dark:border-slate-700 dark:text-slate-300"}`}
                          onClick={() => ui("pnrRole", v)}>
                          {v === "Handler" ? t("handler") : v === "Screener" ? t("screener") : t("both")}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* ── BLOQUE MANEJADOR ── */}
                  {showHandlerSection && (
                    <div className="rounded-xl border border-blue-200 dark:border-blue-800/50 bg-blue-50/40 dark:bg-blue-950/10 p-4 space-y-4">
                      {pnrBoth && <p className="text-xs font-bold uppercase tracking-widest text-blue-500">{t("as_handler")}</p>}

                      {/* Scoring vs passing */}
                      <div className="space-y-2">
                        <FieldLabel label={t("pnr_scoring_priority")} tooltip={t("hint_pnr_scoring")} />
                        <div className="flex flex-wrap" style={{ flexWrap: "wrap", gap: 12 }}>
                          {(["Score First", "Balanced", "Pass First"] as const).map(opt => (
                            <Button key={opt} type="button" variant={inputs.pnrScoringPriority === opt ? "default" : "outline"}
                              style={{ minHeight: 44 }}
                              className={`h-auto min-h-11 min-w-11 flex-1 px-4 rounded-xl text-sm font-semibold ${inputs.pnrScoringPriority === opt ? pillActiveClasses("neutral") : "bg-transparent border-slate-200 dark:border-slate-700 dark:text-slate-300"}`}
                              onClick={() => ui("pnrScoringPriority", opt)}>
                              {opt === "Score First" ? t("opt_pnr_score_first") : opt === "Pass First" ? t("opt_pnr_pass_first") : t("opt_pnr_balanced")}
                            </Button>
                          ))}
                        </div>
                      </div>

                      {/* Ante cobertura baja */}
                      <div className="space-y-2">
                        <FieldLabel label={t("pnr_reaction_under")} tooltip={t("hint_pnr_under")} />
                        <div className="flex flex-wrap" style={{ flexWrap: "wrap", gap: 12 }}>
                          {([
                            { v: "Pull-up 3" as const, lk: "opt_finish_pullup3" },
                            { v: "Re-screen" as const, lk: "opt_pnr_under_rescreen" },
                            { v: "Reject / Attack" as const, lk: "opt_pnr_under_reject" },
                            { v: "Mixed" as const, lk: "opt_pnr_under_mixed" },
                          ] as const).map(({ v, lk }) => (
                            <Button key={v} type="button" variant={inputs.pnrReactionVsUnder === v ? "default" : "outline"}
                              style={{ minHeight: 44 }}
                              className={`h-auto min-h-11 min-w-11 px-4 rounded-xl text-sm font-semibold ${inputs.pnrReactionVsUnder === v ? pillActiveClasses("neutral") : "bg-transparent border-slate-200 dark:border-slate-700 dark:text-slate-300"}`}
                              onClick={() => ui("pnrReactionVsUnder", v)}>
                              {t(lk as never)}
                            </Button>
                          ))}
                          <Button type="button" variant={inputs.pnrReactionVsUnder == null ? "secondary" : "outline"}
                            style={{ minHeight: 44 }}
                            className="h-auto min-h-11 min-w-11 px-4 rounded-xl text-sm font-semibold"
                            onClick={() => ui("pnrReactionVsUnder", null)}>
                            {t("not_observed")}
                          </Button>
                        </div>
                      </div>

                      {/* Timing */}
                      <div className="space-y-2">
                        <FieldLabel label={t("pnr_timing")} tooltip={t("hint_pnr_timing")} />
                        <div className="flex flex-wrap" style={{ flexWrap: "wrap", gap: 12 }}>
                          {(["Early (Drag)", "Deep (Half-court)"] as const).map(opt => (
                            <Button key={opt} type="button" variant={inputs.pnrTiming === opt ? "default" : "outline"}
                              style={{ minHeight: 44 }}
                              className={`h-auto min-h-11 min-w-11 flex-1 px-4 rounded-xl text-sm font-semibold ${inputs.pnrTiming === opt ? pillActiveClasses("neutral") : "bg-transparent border-slate-200 dark:border-slate-700 dark:text-slate-300"}`}
                              onClick={() => ui("pnrTiming", opt)}>
                              {opt === "Early (Drag)" ? t("opt_pnr_timing_drag") : t("opt_pnr_timing_halfcourt")}
                            </Button>
                          ))}
                        </div>
                      </div>

                      {/* Finalización balón izquierda */}
                      <div className="space-y-2">
                        <FieldLabel label={t("pnr_finish_left")} tooltip={t("hint_pnr_finish_side")} />
                        <div className="flex flex-row flex-wrap gap-2">
                          {PNR_FINISH_OPTS.map(({ v, labelKey }) => (
                            <Button key={v} type="button" variant={inputs.pnrFinishBallLeft === v ? "default" : "outline"} style={{ minHeight: 40 }}
                              className={`h-auto min-h-10 px-3 py-2 rounded-lg text-xs font-semibold ${inputs.pnrFinishBallLeft === v ? pillActiveClasses("neutral") : "border-slate-200 dark:border-slate-700"}`}
                              onClick={() => ui("pnrFinishBallLeft", inputs.pnrFinishBallLeft === v ? null : v)}>
                              {t(labelKey as never)}
                            </Button>
                          ))}
                          <Button type="button" variant={inputs.pnrFinishBallLeft == null ? "secondary" : "outline"} style={{ minHeight: 40 }}
                            className="h-auto min-h-10 px-3 py-2 rounded-lg text-xs font-semibold" onClick={() => ui("pnrFinishBallLeft", null)}>
                            {t("not_observed")}
                          </Button>
                        </div>
                      </div>

                      {/* Finalización balón derecha */}
                      <div className="space-y-2">
                        <FieldLabel label={t("pnr_finish_right")} tooltip={t("hint_pnr_finish_side")} />
                        <div className="flex flex-row flex-wrap gap-2">
                          {PNR_FINISH_OPTS.map(({ v, labelKey }) => (
                            <Button key={v} type="button" variant={inputs.pnrFinishBallRight === v ? "default" : "outline"} style={{ minHeight: 40 }}
                              className={`h-auto min-h-10 px-3 py-2 rounded-lg text-xs font-semibold ${inputs.pnrFinishBallRight === v ? pillActiveClasses("neutral") : "border-slate-200 dark:border-slate-700"}`}
                              onClick={() => ui("pnrFinishBallRight", inputs.pnrFinishBallRight === v ? null : v)}>
                              {t(labelKey as never)}
                            </Button>
                          ))}
                          <Button type="button" variant={inputs.pnrFinishBallRight == null ? "secondary" : "outline"} style={{ minHeight: 40 }}
                            className="h-auto min-h-10 px-3 py-2 rounded-lg text-xs font-semibold" onClick={() => ui("pnrFinishBallRight", null)}>
                            {t("not_observed")}
                          </Button>
                        </div>
                      </div>

                      {/* ¿Finaliza con mano contraria? — solo si ISO = Never */}
                      {showOppositeFinishInPNR && (
                        <div className="space-y-2">
                          <FieldLabel label={t("iso_opposite_finish")} tooltip={t("hint_iso_opposite_finish")} />
                          <div className="flex flex-wrap gap-3">
                            {([{ v: "Drive" as const, labelKey: "opt_iso_opposite_yes" }, { v: "Pass" as const, labelKey: "opt_iso_opposite_no" }] as const).map(({ v, labelKey }) => (
                              <Button key={v} type="button" variant={inputs.isoOppositeFinish === v ? "default" : "outline"}
                                style={{ minHeight: 44 }}
                                className={`h-auto min-h-11 px-4 rounded-xl text-sm font-semibold ${inputs.isoOppositeFinish === v ? pillActiveClasses("neutral") : "border-slate-200 dark:border-slate-700"}`}
                                onClick={() => ui("isoOppositeFinish", inputs.isoOppositeFinish === v ? undefined : v)}>
                                {t(labelKey as never)}
                              </Button>
                            ))}
                            <Button type="button" variant={inputs.isoOppositeFinish == null ? "secondary" : "outline"} style={{ minHeight: 44 }}
                              className="h-auto min-h-11 px-4 py-2 rounded-xl text-sm font-semibold" onClick={() => ui("isoOppositeFinish", undefined)}>
                              {t("not_observed")}
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Snake */}
                      <div className="space-y-2">
                        <FieldLabel label={t("pnr_snake")} tooltip={t("hint_pnr_snake")} />
                        <div className="flex flex-wrap" style={{ flexWrap: "wrap", gap: 12 }}>
                          {([{ v: true as const, labelKey: "opt_pnr_snake_yes" }, { v: false as const, labelKey: "opt_pnr_snake_no" }] as const).map(({ v, labelKey }) => (
                            <Button key={String(v)} type="button" variant={inputs.pnrSnake === v ? "default" : "outline"}
                              style={{ minHeight: 44 }}
                              className={`h-auto min-h-11 min-w-11 flex-1 px-4 rounded-xl text-sm font-semibold ${inputs.pnrSnake === v ? pillActiveClasses("neutral") : "border-slate-200 dark:border-slate-700"}`}
                              onClick={() => ui("pnrSnake", inputs.pnrSnake === v ? null : v)}>
                              {t(labelKey as never)}
                            </Button>
                          ))}
                          <Button type="button" variant={inputs.pnrSnake == null ? "secondary" : "outline"} style={{ minHeight: 44 }}
                            className="h-auto min-h-11 px-4 py-2 rounded-xl text-sm font-semibold" onClick={() => ui("pnrSnake", null)}>
                            {t("not_observed")}
                          </Button>
                        </div>
                      </div>

                      {/* Eficiencia general PnR */}
                      <div className="space-y-2">
                        <FieldLabel label={t("editor_pnr_finish_eff")} tooltip={t("hint_pnr_finish_eff")} />
                        <div className="flex flex-wrap" style={{ flexWrap: "wrap", gap: 12 }}>
                          {(["high", "medium", "low"] as const).map(lvl => (
                            <Button key={lvl} type="button" variant={inputs.motorPnrEff === lvl ? "default" : "outline"}
                              style={{ minHeight: 44 }}
                              className={`h-auto min-h-11 min-w-11 flex-1 px-4 rounded-xl text-sm font-semibold ${inputs.motorPnrEff === lvl ? pillActiveClasses("neutral") : "bg-transparent border-slate-200 dark:border-slate-700 dark:text-slate-300"}`}
                              onClick={() => ui("motorPnrEff", lvl)}>
                              {t(`editor.eff.${lvl}` as never)}
                            </Button>
                          ))}
                          <Button type="button" variant={inputs.motorPnrEff == null ? "secondary" : "outline"} style={{ minHeight: 44 }}
                            className="h-auto min-h-11 px-4 py-2 rounded-xl text-sm font-semibold" onClick={() => ui("motorPnrEff", null)}>
                            {t("not_observed")}
                          </Button>
                        </div>
                      </div>

                      {/* Reacción al trap/blitz — campo propio, NO toca motorPressureResponse */}
                      <div className="space-y-2 pt-1 border-t border-blue-200 dark:border-blue-800/40">
                        <FieldLabel label={t("editor.pnr_trap_reaction")} tooltip={t("hint_pnr_trap_reaction")} />
                        <div className="grid grid-cols-2 gap-2">
                          {([
                            { v: "escape" as const, labelKey: "opt_pnr_trap_escapes" },
                            { v: "pass" as const, labelKey: "opt_pnr_trap_pass" },
                            { v: "struggle" as const, labelKey: "opt_pnr_trap_struggles" },
                          ] as const).map(({ v, labelKey }) => (
                            <Button key={v} type="button" variant={inputs.motorTrapResponse === v ? "default" : "outline"}
                              style={{ minHeight: 44 }}
                              className={`h-auto min-h-11 w-full px-2 rounded-xl text-sm font-semibold ${inputs.motorTrapResponse === v ? pillActiveClasses("neutral") : "border-slate-200 dark:border-slate-700"}`}
                              onClick={() => ui("motorTrapResponse", inputs.motorTrapResponse === v ? null : v)}>
                              {t(labelKey as never)}
                            </Button>
                          ))}
                          <Button type="button" variant={inputs.motorTrapResponse == null ? "secondary" : "outline"} style={{ minHeight: 44 }}
                            className="h-auto min-h-11 w-full px-2 rounded-xl text-sm font-semibold" onClick={() => ui("motorTrapResponse", null)}>
                            {t("not_observed")}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── BLOQUE BLOQUEADOR ── */}
                  {showScreenerSection && (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/40 p-4 space-y-4">
                      {pnrBoth && <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{t("as_screener")}</p>}

                      {/* Timing de pantalla */}
                      <div className="space-y-2">
                        <FieldLabel label={t("editor.pnr_screen_timing")} tooltip={t("hint_pnr_screen_timing")} />
                        <div className="flex flex-wrap" style={{ flexWrap: "wrap", gap: 12 }}>
                          {PNR_SCREEN_TIMING_OPTS.map(opt => (
                            <Button key={opt} type="button" variant={inputs.pnrScreenTiming === opt ? "default" : "outline"}
                              style={{ minHeight: 44 }}
                              className={`h-auto min-h-11 flex-1 min-w-[8rem] px-4 py-2 rounded-xl text-sm font-semibold ${inputs.pnrScreenTiming === opt ? pillActiveClasses("neutral") : "border-slate-200 dark:border-slate-700"}`}
                              onClick={() => ui("pnrScreenTiming", inputs.pnrScreenTiming === opt ? null : opt)}>
                              {t(PNR_SCREEN_TIMING_I18N[opt] as never)}
                            </Button>
                          ))}
                        </div>
                      </div>

                      {inputs.pnrScreenTiming === "slip" ? (
                        <p className="text-xs text-slate-400">{t("editor.pnr_slip_note")}</p>
                      ) : (
                        <>
                          <ScreenerActionSelector
                            primaryValue={inputs.pnrScreenerAction}
                            secondaryValue={(inputs as any).pnrScreenerActionSecondary}
                            onPrimaryChange={v => ui("pnrScreenerAction", v)}
                            onSecondaryChange={v => ui("pnrScreenerActionSecondary" as any, v)}
                          />
                          {/* Rango exterior — solo si acción = Pop */}
                          {(inputs.pnrScreenerAction === "Pop" || inputs.pnrScreenerAction === "Pop (Elbow / Mid)" ||
                            (inputs as any).pnrScreenerActionSecondary === "Pop" || (inputs as any).pnrScreenerActionSecondary === "Pop (Elbow / Mid)") && (
                            <div className="space-y-2">
                              <FieldLabel label={t("pnr_pop_range")} tooltip={t("hint_pnr_pop_range")} />
                              <div className="flex flex-wrap" style={{ flexWrap: "wrap", gap: 12 }}>
                                {([{ v: "three" as const, labelKey: "opt_pop_range_three" }, { v: "midrange" as const, labelKey: "opt_pop_range_mid" }] as const).map(({ v, labelKey }) => (
                                  <Button key={v} type="button" variant={(inputs as any).popRange === v ? "default" : "outline"}
                                    style={{ minHeight: 44 }}
                                    className={`h-auto min-h-11 min-w-11 flex-1 px-4 rounded-xl text-sm font-semibold ${(inputs as any).popRange === v ? pillActiveClasses("neutral") : "border-slate-200 dark:border-slate-700"}`}
                                    onClick={() => ui("popRange" as any, (inputs as any).popRange === v ? null : v)}>
                                    {t(labelKey as never)}
                                  </Button>
                                ))}
                                <Button type="button" variant={(inputs as any).popRange == null ? "secondary" : "outline"} style={{ minHeight: 44 }}
                                  className="h-auto min-h-11 px-4 py-2 rounded-xl text-sm font-semibold" onClick={() => ui("popRange" as any, null)}>
                                  {t("not_observed")}
                                </Button>
                              </div>
                            </div>
                          )}
                        </>
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

              {/* ── TRANSICIÓN ── */}
              <div className="space-y-4">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{t("offball_section_transition")}</p>
                <IntensitySelector label={t("transition_frequency")} value={inputs.transitionFrequency} onChange={v => ui("transitionFrequency", v)} />

                {inputs.transitionFrequency !== "Never" && (
                  <>
                    {/* Rol principal */}
                    <div className="space-y-2">
                      <FieldLabel label={t("trans_role_primary")} tooltip={t("hint_trans_role_primary")} />
                      <div className="flex flex-wrap gap-3">
                        {TRANS_EDITOR_ROLES.map(v => (
                          <Button key={v} type="button" variant={inputs.transRolePrimary === v ? "default" : "outline"}
                            style={{ minHeight: 44 }}
                            className={`h-auto min-h-11 px-4 py-2 rounded-xl text-sm font-semibold ${inputs.transRolePrimary === v ? "bg-emerald-600 border-emerald-600 text-white" : "border-slate-200 dark:border-slate-700"}`}
                            onClick={() => { if (inputs.transRolePrimary === v) { ui("transRolePrimary", null); ui("transSubPrimary", null); ui("transRoleSecondary", null); ui("transSubSecondary", null); } else { ui("transRolePrimary", v); ui("transSubPrimary", null); ui("transRoleSecondary", null); ui("transSubSecondary", null); } }}>
                            {t(`opt_trans_role_${v}` as never)}
                          </Button>
                        ))}
                        <Button type="button" variant={inputs.transRolePrimary == null ? "secondary" : "outline"} style={{ minHeight: 44 }}
                          className="h-auto min-h-11 px-4 py-2 rounded-xl text-sm font-semibold"
                          onClick={() => { ui("transRolePrimary", null); ui("transSubPrimary", null); ui("transRoleSecondary", null); ui("transSubSecondary", null); }}>
                          {t("not_observed")}
                        </Button>
                      </div>

                      {/* Sub-opciones del rol primario */}
                      {inputs.transRolePrimary && TRANS_ROLE_SUB_OPTIONS[inputs.transRolePrimary as keyof typeof TRANS_ROLE_SUB_OPTIONS] && (
                        <div className="mt-2 pl-3 border-l-2 border-emerald-400 dark:border-emerald-600 space-y-2">
                          <div className="flex flex-wrap gap-2">
                            {(TRANS_ROLE_SUB_OPTIONS[inputs.transRolePrimary as keyof typeof TRANS_ROLE_SUB_OPTIONS] as readonly string[]).map(sub => (
                              <Button key={sub} type="button"
                                variant={inputs.transSubPrimary === sub ? "default" : "outline"}
                                style={{ minHeight: 36 }}
                                className={`h-auto min-h-9 px-3 py-1.5 rounded-lg text-xs font-semibold ${inputs.transSubPrimary === sub ? "bg-emerald-600 border-emerald-600 text-white" : "border-slate-200 dark:border-slate-700"}`}
                                onClick={() => ui("transSubPrimary", inputs.transSubPrimary === sub ? null : sub)}>
                                {t(`editor.trans_sub.${sub}` as never)}
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Rol secundario — solo si hay primario */}
                    {inputs.transRolePrimary && (
                      <div className="space-y-2">
                        <FieldLabel label={t("trans_role_secondary")} tooltip={t("hint_trans_role_secondary")} />
                        <div className="flex flex-wrap gap-3">
                          {TRANS_EDITOR_ROLES.map(v => {
                            const disabled = v === inputs.transRolePrimary;
                            return (
                              <Button key={v} type="button" disabled={disabled}
                                variant={inputs.transRoleSecondary === v ? "default" : "outline"}
                                style={{ minHeight: 44 }}
                                className={`h-auto min-h-11 px-4 py-2 rounded-xl text-sm font-semibold ${disabled ? "opacity-40 pointer-events-none" : ""} ${inputs.transRoleSecondary === v ? pillActiveClasses("neutral") : "border-slate-200 dark:border-slate-700"}`}
                                onClick={() => { if (inputs.transRoleSecondary === v) { ui("transRoleSecondary", null); ui("transSubSecondary", null); } else { ui("transRoleSecondary", v); ui("transSubSecondary", null); } }}>
                                {t(`opt_trans_role_${v}` as never)}
                              </Button>
                            );
                          })}
                          <Button type="button" variant={inputs.transRoleSecondary == null ? "secondary" : "outline"} style={{ minHeight: 44 }}
                            className="h-auto min-h-11 px-4 py-2 rounded-xl text-sm font-semibold"
                            onClick={() => { ui("transRoleSecondary", null); ui("transSubSecondary", null); }}>
                            {t("not_observed")}
                          </Button>
                        </div>

                        {/* Sub-opciones del rol secundario */}
                        {inputs.transRoleSecondary && TRANS_ROLE_SUB_OPTIONS[inputs.transRoleSecondary as keyof typeof TRANS_ROLE_SUB_OPTIONS] && (
                          <div className="mt-2 pl-3 border-l-2 border-slate-300 dark:border-slate-600 space-y-2">
                            <div className="flex flex-wrap gap-2">
                              {(TRANS_ROLE_SUB_OPTIONS[inputs.transRoleSecondary as keyof typeof TRANS_ROLE_SUB_OPTIONS] as readonly string[]).map(sub => (
                                <Button key={sub} type="button"
                                  variant={inputs.transSubSecondary === sub ? "default" : "outline"}
                                  style={{ minHeight: 36 }}
                                  className={`h-auto min-h-9 px-3 py-1.5 rounded-lg text-xs font-semibold ${inputs.transSubSecondary === sub ? pillActiveClasses("neutral") : "border-slate-200 dark:border-slate-700"}`}
                                  onClick={() => ui("transSubSecondary", inputs.transSubSecondary === sub ? null : sub)}>
                                  {t(`editor.trans_sub.${sub}` as never)}
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Finalización en el aro */}
                    <div className="space-y-2">
                      <FieldLabel label={t("editor.trans_finishing")} />
                      <div className="flex flex-wrap gap-3">
                        {(["high", "medium", "low"] as const).map(v => (
                          <Button key={v} type="button" variant={inputs.transFinishing === v ? "default" : "outline"}
                            style={{ minHeight: 44 }}
                            className={`h-auto min-h-11 px-4 py-2 rounded-xl text-sm font-semibold ${inputs.transFinishing === v ? pillActiveClasses("neutral") : "border-slate-200 dark:border-slate-700"}`}
                            onClick={() => ui("transFinishing", inputs.transFinishing === v ? null : v)}>
                            {t(`opt_eff_${v}` as never)}
                          </Button>
                        ))}
                        <Button type="button" variant={inputs.transFinishing == null ? "secondary" : "outline"} style={{ minHeight: 44 }}
                          className="h-auto min-h-11 px-4 py-2 rounded-xl text-sm font-semibold" onClick={() => ui("transFinishing", null)}>
                          {t("not_observed")}
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-1" />

              {/* ── CORTES ── */}
              <div className="space-y-4">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{t("offball_subsection_cuts")}</p>
                <IntensitySelector label={t("backdoor")} value={inputs.backdoorFrequency} onChange={v => ui("backdoorFrequency", v)} tooltip={t("hint_backdoor")} />
                <IntensitySelector label={t("editor.free_cuts_frequency")} value={(inputs.freeCutsFrequency ?? "Never") as IntensityLevel} onChange={v => ui("freeCutsFrequency", v)} />
                {inputs.freeCutsFrequency != null && inputs.freeCutsFrequency !== "Never" && (
                  <div className="space-y-2">
                    <FieldLabel label={t("editor.free_cuts_type")} />
                    <div className="flex flex-wrap gap-3">
                      {FREE_CUTS_TYPE_OPTS.map(opt => (
                        <Button key={opt} type="button" variant={inputs.freeCutsType === opt ? "default" : "outline"} style={{ minHeight: 44 }}
                          className={`h-auto min-h-11 px-4 py-2 rounded-xl text-sm font-semibold ${inputs.freeCutsType === opt ? pillActiveClasses("neutral") : "border-slate-200 dark:border-slate-700"}`}
                          onClick={() => ui("freeCutsType", inputs.freeCutsType === opt ? null : opt)}>
                          {t(FREE_CUTS_TYPE_I18N[opt] as never)}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dunker spot — ÚNICO lugar */}
                <div className="space-y-2">
                  <FieldLabel label={t("editor.dunker_spot")} tooltip={t("editor.dunker_spot_hint")} />
                  <div className="flex flex-wrap gap-3">
                    {([{ v: 0 as const, lk: "editor.dunker_spot_0" }, { v: 1 as const, lk: "editor.dunker_spot_1" }, { v: 2 as const, lk: "editor.dunker_spot_2" }] as const).map(({ v, lk }) => (
                      <Button key={v} type="button" variant={inputs.dunkerSpot === v ? "default" : "outline"} style={{ minHeight: 44 }}
                        className={`h-auto min-h-11 px-4 py-2 rounded-xl text-sm font-semibold ${inputs.dunkerSpot === v ? pillActiveClasses("neutral") : "border-slate-200 dark:border-slate-700"}`}
                        onClick={() => ui("dunkerSpot", inputs.dunkerSpot === v ? null : v)}>
                        {t(lk as never)}
                      </Button>
                    ))}
                    <Button type="button" variant={inputs.dunkerSpot == null ? "secondary" : "outline"} style={{ minHeight: 44 }}
                      className="h-auto min-h-11 px-4 py-2 rounded-xl text-sm font-semibold" onClick={() => ui("dunkerSpot", null)}>
                      {t("not_observed")}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-1" />

              {/* ── BLOQUEO INDIRECTO ── */}
              <div className="space-y-4">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{t("offball_section_screens")}</p>
                <IntensitySelector label={t("indirects")} value={inputs.indirectsFrequency} onChange={v => ui("indirectsFrequency", v)} tooltip={t("hint_indirects")} />
                {inputs.indirectsFrequency !== "Never" && (
                  <>
                    <div className="space-y-2">
                      <FieldLabel label={t("offball_role_label")} />
                      <div className="flex flex-wrap gap-3">
                        {([
                          { v: "screener" as const, lk: "opt_offball_role_screener" },
                          { v: "cutter" as const, lk: "opt_offball_role_cutter" },
                          { v: "both" as const, lk: "opt_offball_role_both" },
                        ] as const).map(({ v, lk }) => (
                          <Button key={v} type="button" variant={inputs.offBallRole === v ? "default" : "outline"} style={{ minHeight: 44 }}
                            className={`h-auto min-h-11 px-4 py-2 rounded-xl text-sm font-semibold ${inputs.offBallRole === v ? pillActiveClasses("neutral") : "border-slate-200 dark:border-slate-700"}`}
                            onClick={() => ui("offBallRole", v)}>
                            {t(lk as never)}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {(inputs.offBallRole === "screener" || inputs.offBallRole === "both") && (
                      <div className="space-y-4 border-l-2 border-emerald-700 pl-4">
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{t("offball_role_screener")}</p>

                        <div className="space-y-2">
                          <FieldLabel label={t("offball_screen_primary_action")} tooltip={t("hint_offball_screen_primary_action")} />
                          <div className="flex flex-wrap gap-3">
                            {([{ v: "roll" as const, lk: "editor.screener_action_roll" }, { v: "pop_short" as const, lk: "editor.screener_action_pop_short" }, { v: "slip" as const, lk: "editor.screener_action_slip" }, { v: null, lk: "opt_ghost" }] as const).map(({ v, lk }) => (
                              <Button key={String(v)} type="button" variant={inputs.offBallScreenPattern === v ? "default" : "outline"} style={{ minHeight: 44 }}
                                className={`h-auto min-h-11 px-4 py-2 rounded-xl text-sm font-semibold ${inputs.offBallScreenPattern === v ? pillActiveClasses("neutral") : "border-slate-200 dark:border-slate-700"}`}
                                onClick={() => ui("offBallScreenPattern", inputs.offBallScreenPattern === v ? null : v)}>
                                {t(lk as never)}
                              </Button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <FieldLabel label={t("pnr_screener_action_secondary")} />
                          <div className="flex flex-wrap gap-3">
                            {([{ v: "roll" as const, lk: "editor.screener_action_roll" }, { v: "pop_short" as const, lk: "editor.screener_action_pop_short" }, { v: "slip" as const, lk: "editor.screener_action_slip" }, { v: null, lk: "opt_ghost" }] as const).map(({ v, lk }) => (
                              <Button key={String(v)} type="button" variant={(inputs as any).offBallScreenPatternSecondary === v ? "default" : "outline"} style={{ minHeight: 44 }}
                                className={`h-auto min-h-11 px-4 py-2 rounded-xl text-sm font-semibold ${(inputs as any).offBallScreenPatternSecondary === v ? pillActiveClasses("neutral") : "border-slate-200 dark:border-slate-700"}`}
                                onClick={() => ui("offBallScreenPatternSecondary" as any, (inputs as any).offBallScreenPatternSecondary === v ? null : v)}>
                                {t(lk as never)}
                              </Button>
                            ))}
                            <Button type="button" variant={(inputs as any).offBallScreenPatternSecondary == null ? "secondary" : "outline"} style={{ minHeight: 44 }}
                              className="h-auto min-h-11 px-4 py-2 rounded-xl text-sm font-semibold" onClick={() => ui("offBallScreenPatternSecondary" as any, null)}>
                              {t("opt_screen_none")}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {(inputs.offBallRole === "cutter" || inputs.offBallRole === "both") && (
                      <div className="space-y-4 border-l-2 border-emerald-400 pl-4">
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{t("offball_role_cutter")}</p>

                        <div className="space-y-2">
                          <FieldLabel label={t("offball_cut_action")} />
                          <div className="flex flex-wrap gap-3">
                            {([
                              { v: "catch_and_shoot" as const, lk: "opt_cut_catch_shoot" },
                              { v: "curl" as const, lk: "opt_cut_curl" },
                              { v: "flare" as const, lk: "opt_cut_flare" },
                              { v: "backdoor" as const, lk: "opt_cut_backdoor" },
                              { v: "catch_and_drive" as const, lk: "opt_cut_drive" },
                            ] as const).map(({ v, lk }) => (
                              <Button key={v} type="button" variant={inputs.offBallCutAction === v ? "default" : "outline"} style={{ minHeight: 44 }}
                                className={`h-auto min-h-11 px-4 py-2 rounded-xl text-sm font-semibold ${inputs.offBallCutAction === v ? pillActiveClasses("neutral") : "border-slate-200 dark:border-slate-700"}`}
                                onClick={() => ui("offBallCutAction", inputs.offBallCutAction === v ? null : v)}>
                                {t(lk as never)}
                              </Button>
                            ))}
                            <Button type="button" variant={inputs.offBallCutAction == null ? "secondary" : "outline"} style={{ minHeight: 44 }}
                              className="h-auto min-h-11 px-4 py-2 rounded-xl text-sm font-semibold" onClick={() => ui("offBallCutAction", null)}>
                              {t("not_observed")}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-1" />

              {/* ── REBOTE OFENSIVO ── */}
              <div className="space-y-4">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{t("offball_section_rebounds")}</p>
                <IntensitySelector label={t("orb")} value={inputs.offensiveReboundFrequency} onChange={v => ui("offensiveReboundFrequency", v)} tooltip={t("hint_orb")} />
                {inputs.offensiveReboundFrequency !== "Never" && (
                  <div className="space-y-2">
                    <FieldLabel label={t("editor.putback_quality")} />
                    <div className="flex flex-wrap gap-3">
                      {PUTBACK_QUALITY_OPTS.map(q => (
                        <Button key={q} type="button" variant={inputs.putbackQuality === q ? "default" : "outline"} style={{ minHeight: 44 }}
                          className={`h-auto min-h-11 px-4 py-2 rounded-xl text-sm font-semibold ${inputs.putbackQuality === q ? pillActiveClasses("neutral") : "border-slate-200 dark:border-slate-700"}`}
                          onClick={() => ui("putbackQuality", inputs.putbackQuality === q ? null : q)}>
                          {t(PUTBACK_QUALITY_I18N[q] as never)}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ── SPOT-UP ── */}
          <TabsContent value="spot" className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 space-y-5 border border-slate-200 dark:border-slate-800 shadow-sm border-l-4 border-l-pink-500">
              <h3 className="font-bold text-lg flex items-center gap-2 text-slate-900 dark:text-white">
                <span className="w-5 h-5 inline-flex items-center justify-center rounded-md bg-pink-500/15 text-pink-500 font-black text-sm">3</span>
                {t("section_spot")}
              </h3>
              <IntensitySelector label={t("spot_frequency")} value={((inputs as any).perimeterThreats ?? "Never") as IntensityLevel} onChange={v => ui("perimeterThreats" as any, v)} />

              {/* Closeout Reaction — ÚNICO lugar en toda la app (siempre visible) */}
              <IsoCloseoutReactionSection inputs={inputs} ui={ui} />

              {((inputs as any).perimeterThreats ?? "Never") !== "Never" && (
                <>
                  {/* Zona preferida */}
                  <div className="space-y-2">
                    <FieldLabel label={t("spot_zone")} tooltip={t("hint_spot_zone")} />
                    <div className="flex flex-wrap gap-3">
                      {([{ v: "corner" as const, lk: "opt_spot_zone_corner" }, { v: "wing" as const, lk: "opt_spot_zone_wing" }, { v: "top" as const, lk: "opt_spot_zone_top" }] as const).map(({ v, lk }) => (
                        <Button key={v} type="button" variant={((inputs as any).spotZone ?? null) === v ? "default" : "outline"} style={{ minHeight: 44 }}
                          className={`h-auto min-h-11 px-4 py-2 rounded-xl text-sm font-semibold ${((inputs as any).spotZone ?? null) === v ? pillActiveClasses("neutral") : "border-slate-200 dark:border-slate-700"}`}
                          onClick={() => ui("spotZone" as any, ((inputs as any).spotZone ?? null) === v ? null : v)}>
                          {t(lk as never)}
                        </Button>
                      ))}
                      <Button type="button" variant={((inputs as any).spotZone ?? null) == null ? "secondary" : "outline"} style={{ minHeight: 44 }}
                        className="h-auto min-h-11 px-4 py-2 rounded-xl text-sm font-semibold" onClick={() => ui("spotZone" as any, null)}>
                        {t("not_observed")}
                      </Button>
                    </div>
                  </div>

                  {/* Rango profundo */}
                  <div className="space-y-2">
                    <FieldLabel label={t("spot_deep_range")} tooltip={t("hint_spot_deep_range")} />
                    <div className="flex flex-wrap gap-3">
                      {([{ v: true as const, lk: "yes" }, { v: false as const, lk: "no" }] as const).map(({ v, lk }) => (
                        <Button key={String(v)} type="button" variant={((inputs as any).deepRange ?? null) === v ? "default" : "outline"} style={{ minHeight: 44 }}
                          className={`h-auto min-h-11 px-4 py-2 rounded-xl text-sm font-semibold ${((inputs as any).deepRange ?? null) === v ? pillActiveClasses("neutral") : "border-slate-200 dark:border-slate-700"}`}
                          onClick={() => ui("deepRange" as any, ((inputs as any).deepRange ?? null) === v ? null : v)}>
                          {t(lk as never)}
                        </Button>
                      ))}
                      <Button type="button" variant={((inputs as any).deepRange ?? null) == null ? "secondary" : "outline"} style={{ minHeight: 44 }}
                        className="h-auto min-h-11 px-4 py-2 rounded-xl text-sm font-semibold" onClick={() => ui("deepRange" as any, null)}>
                        {t("not_observed")}
                      </Button>
                    </div>
                  </div>

                  {/* Rango extra-largo (scout-confirmed) */}
                  <div className="space-y-2">
                    <FieldLabel
                      label={
                        locale === "es"
                          ? "Rango extra-largo (más allá del arco estándar)"
                          : "Long range (beyond standard arc)"
                      }
                    />
                    <div className="flex flex-wrap gap-3">
                      {([{ v: true as const, lk: "yes" }, { v: false as const, lk: "no" }] as const).map(({ v, lk }) => (
                        <Button
                          key={String(v)}
                          type="button"
                          variant={(inputs.motorLongRange ?? null) === v ? "default" : "outline"}
                          style={{ minHeight: 44 }}
                          className={`h-auto min-h-11 px-4 py-2 rounded-xl text-sm font-semibold ${(inputs.motorLongRange ?? null) === v ? pillActiveClasses("neutral") : "border-slate-200 dark:border-slate-700"}`}
                          onClick={() => ui("motorLongRange" as any, (inputs.motorLongRange ?? null) === v ? null : v)}
                        >
                          {t(lk as never)}
                        </Button>
                      ))}
                      <Button
                        type="button"
                        variant={(inputs.motorLongRange ?? null) == null ? "secondary" : "outline"}
                        style={{ minHeight: 44 }}
                        className="h-auto min-h-11 px-4 py-2 rounded-xl text-sm font-semibold"
                        onClick={() => ui("motorLongRange" as any, null)}
                      >
                        {t("not_observed")}
                      </Button>
                    </div>
                  </div>

                </>
              )}
            </div>
          </TabsContent>

        </Tabs>
      </main>
    </div>
  );
}
