import React, { useEffect, useMemo, useState } from "react";
import { useRoute, useLocation, useSearch } from "wouter";
import { usePlayer, useTeams, generateProfile, type MotorPlanCandidate } from "@/lib/mock-data";
import { useLocale } from "@/lib/i18n";
import { useAuth } from "@/lib/useAuth";
import { BasketballPlaceholderAvatar } from "@/components/BasketballPlaceholderAvatar";
import { isRealPhoto, cn } from "@/lib/utils";
import {
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  ShieldAlert,
  Shield,
  BookOpen,
  Settings,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { ApprovalBar, APPROVAL_ONBOARDING_LS } from "@/components/ApprovalBar";
import {
  useApprovalStatus,
  useSetReportOverride,
  useDeleteReportOverride,
  type ApprovalSlide,
} from "@/lib/approval-api";
import { useRecordPlayerSlideView } from "@/lib/player-home";

// ─── translateOutput ──────────────────────────────────────────────────────────
// Converts motor output keys to translated strings at render time.
// Static key:  "def_screen_roll" → t("def_screen_roll")
// Dynamic key: "for_direction|weak=left|wl=floater" → t("for_direction", {weak:"left", wl:"floater"})
// Fallback:    if key not in i18n, display as-is (backwards compatible with old saved data)
function translateOutput(item: string, tFn: (key: any) => string): string {
  if (!item) return item;
  // Check if it's a serialized dynamic key
  if (item.includes("|")) {
    const [key, ...paramParts] = item.split("|");
    const params: Record<string, string> = {};
    paramParts.forEach(p => {
      const [k, v] = p.split("=");
      if (k && v !== undefined) params[k] = v;
    });
    let s = tFn(key);
    // If t() returned the key itself, it's not in i18n — show raw
    if (s === key) return item;
    Object.entries(params).forEach(([k, v]) => {
      // Translate param values too (e.g. {side}=left, {wl}=opt_finish_pullup)
      // If there's no i18n entry for the param value, fallback to the raw one.
      const translatedParam = tFn(v as any);
      const replacement = translatedParam === v ? v : translatedParam;
      s = s.replace(new RegExp(`\\{${k}\\}`, "g"), replacement);
    });
    return s;
  }
  // Static key
  const translated = tFn(item);
  // If t() returned the key itself, it's not in i18n — show raw
  return translated === item ? item : translated;
}

/** Legacy runner-ups were plain strings; v2.1 stores { line, weight }. */
function normalizeRunnerCandidates(list: unknown): MotorPlanCandidate[] {
  if (!Array.isArray(list)) return [];
  return list.map((x) => {
    if (typeof x === "string") return { line: x, weight: 0 };
    const o = x as Partial<MotorPlanCandidate>;
    if (o && typeof o.line === "string")
      return { line: o.line, weight: typeof o.weight === "number" ? o.weight : 0 };
    return { line: String(x), weight: 0 };
  });
}

function MotorRunnerUpsReviewPanel({
  runnerUps,
  t,
  translateFn,
}: {
  runnerUps: {
    defender: unknown;
    forzar: unknown;
    concede: unknown;
    aware: unknown;
  };
  t: (key: any) => string;
  translateFn: (item: string) => string;
}) {
  const sections = [
    { titleKey: "defend_tab" as const, sym: "—", accent: "text-red-400", list: normalizeRunnerCandidates(runnerUps.defender) },
    { titleKey: "force_tab" as const, sym: "→", accent: "text-blue-400", list: normalizeRunnerCandidates(runnerUps.forzar) },
    { titleKey: "give_tab" as const, sym: "✓", accent: "text-emerald-400", list: normalizeRunnerCandidates(runnerUps.concede) },
    { titleKey: "review_aware_tab" as const, sym: "!", accent: "text-amber-300", list: normalizeRunnerCandidates(runnerUps.aware) },
  ];
  if (!sections.some((s) => s.list.length > 0)) return null;
  return (
    <div className="mt-4 w-full rounded-2xl border border-border bg-muted/50 px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-0.5">
        {t("review_runner_ups_title")}
      </p>
      <p className="text-[11px] text-muted-foreground leading-snug mb-3">{t("review_runner_ups_hint")}</p>
      {sections.map((sec) =>
        sec.list.length === 0 ? null : (
          <div key={sec.titleKey} className="mb-3 last:mb-0">
            <p className={`text-[10px] font-black uppercase tracking-widest mb-1.5 ${sec.accent}`}>
              {sec.sym} {t(sec.titleKey)}
            </p>
            {sec.list.map((c, i) => {
              const pct =
                c.weight > 0 ? t("review_weight_pct").replace("{n}", String(Math.round(c.weight * 100))) : "—";
              return (
                <div key={i} className="flex gap-2 items-start mb-2 last:mb-0 w-full min-w-0">
                  <span
                    className={`shrink-0 text-xs font-black tabular-nums w-11 text-right ${sec.accent}`}
                    title={c.weight > 0 ? String(c.weight) : undefined}
                  >
                    {pct}
                  </span>
                  <span className="text-sm font-semibold leading-snug text-foreground min-w-0 flex-1 break-words whitespace-normal">
                    {translateFn(c.line)}
                  </span>
                </div>
              );
            })}
          </div>
        ),
      )}
    </div>
  );
}

const toNum = (v: any, fb = 3): number =>
  typeof v === "number" ? v : v === "High" ? 4 : v === "Low" ? 2 : fb;
const isAct = (f?: string) => f === "Primary" || f === "Secondary";
const isPri = (f?: string) => f === "Primary";

// Translate trait labels from motor — maps motor label to i18n key
/** Legacy motor labels → i18n keys (persisted players). New motor uses `trait_*` keys directly. */
const TRAIT_KEY_MAP: Record<string, string> = {
  "Backdoor": "trait_backdoor",
  "Closeout": "trait_closeout",
  "Crashing": "trait_crashing",
  "Drag Screen": "trait_drag_screen",
  "Dual Role": "trait_dual_role",
  "Duck-In": "trait_duck_in",
  "Force Direction": "trait_force_direction",
  "Funnel Direction": "trait_funnel_direction",
  "Move Pattern": "trait_move_pattern",
  "Off Screens": "trait_off_screens",
  "On the Double": "trait_on_the_double",
  "Pass-First": "trait_pass_first",
  "Perimeter Threat": "trait_perimeter_threat",
  "Screen Action": "trait_screen_action",
  "Screen Coverage": "trait_screen_coverage",
  "Slip Threat": "trait_slip_threat",
  "Transition": "trait_transition",
  "Primary Post Scorer": "trait_primary_post_scorer",
  "Post Threat": "trait_post_threat",
  "Primary Scorer": "trait_primary_scorer",
  "Secondary Creator": "trait_secondary_creator",
};

function keyTraitI18nKey(trait: string): string {
  return TRAIT_KEY_MAP[trait] ?? trait;
}

function ProfileReviewToggle({
  reviewMode,
  itemKey,
  slide,
  hidden,
  pending,
  onHide,
  onRestore,
  labelHide,
  labelRestore,
}: {
  reviewMode: boolean;
  itemKey: string;
  slide: ApprovalSlide;
  hidden: boolean;
  pending: boolean;
  onHide: (slide: ApprovalSlide, itemKey: string) => void;
  onRestore: (itemKey: string) => void;
  labelHide: string;
  labelRestore: string;
}) {
  if (!reviewMode) return null;
  return (
    <button
      type="button"
      disabled={pending}
      title={hidden ? labelRestore : labelHide}
      aria-label={hidden ? labelRestore : labelHide}
      className="shrink-0 mt-0.5 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted border border-transparent transition-colors"
      onClick={() => (hidden ? onRestore(itemKey) : onHide(slide, itemKey))}
    >
      {hidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
    </button>
  );
}

// ─── BulletCard — respects deepReport mode ────────────────────────────────────
function BulletCard({
  title,
  top,
  rest = [],
  accent,
  barClass,
  deepReport,
  reviewMode,
  slide,
  itemKeys,
  hiddenKeys,
  overridePending,
  onHideLine,
  onRestoreLine,
  labelHide,
  labelRestore,
}: {
  title: string;
  top: string[];
  rest?: string[];
  accent: string;
  /** Left accent stripe only (no full-bleed tinted background). */
  barClass: string;
  deepReport: boolean;
  reviewMode?: boolean;
  slide?: ApprovalSlide;
  itemKeys?: string[];
  hiddenKeys?: Set<string>;
  overridePending?: boolean;
  onHideLine?: (slide: ApprovalSlide, itemKey: string) => void;
  onRestoreLine?: (itemKey: string) => void;
  labelHide?: string;
  labelRestore?: string;
}) {
  if (!top.length) return null;
  const visible = deepReport ? [...top, ...rest] : top;
  const rm = Boolean(
    reviewMode &&
      slide &&
      itemKeys &&
      hiddenKeys &&
      onHideLine &&
      onRestoreLine &&
      labelHide &&
      labelRestore,
  );
  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-2xl border border-border bg-card/95 shadow-sm",
        "border-l-4",
        barClass,
      )}
    >
      <div className="px-4 pt-3 pb-3 w-full">
        <p
          className={cn(
            "text-[10px] font-black uppercase tracking-widest mb-3 border-b border-border pb-2",
            accent,
          )}
        >
          {title}
        </p>
        {visible.map((item, i) => {
          const ik = itemKeys?.[i];
          const hidden = Boolean(ik && hiddenKeys?.has(ik));
          return (
            <div
              key={i}
              className={cn(
                "flex gap-2 items-start mb-2 last:mb-0 w-full min-w-0",
                hidden && "opacity-45",
              )}
            >
              {rm && ik ? (
                <ProfileReviewToggle
                  reviewMode
                  itemKey={ik}
                  slide={slide!}
                  hidden={hidden}
                  pending={Boolean(overridePending)}
                  onHide={onHideLine!}
                  onRestore={onRestoreLine!}
                  labelHide={labelHide!}
                  labelRestore={labelRestore!}
                />
              ) : null}
              <span className={`font-black text-sm shrink-0 leading-snug ${accent}`}>—</span>
              <span
                className={cn(
                  "text-sm font-semibold leading-snug text-foreground min-w-0 flex-1 break-words whitespace-normal",
                  hidden && "line-through",
                )}
              >
                {item}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── PlanCard — respects deepReport mode ──────────────────────────────────────
function PlanCard({
  label,
  symbol,
  items,
  accent,
  barClass,
  deepReport,
  reviewMode,
  slide,
  itemKeys,
  hiddenKeys,
  overridePending,
  onHideLine,
  onRestoreLine,
  labelHide,
  labelRestore,
}: {
  label: string;
  symbol: string;
  items: string[];
  accent: string;
  barClass: string;
  deepReport: boolean;
  reviewMode?: boolean;
  slide?: ApprovalSlide;
  itemKeys?: string[];
  hiddenKeys?: Set<string>;
  overridePending?: boolean;
  onHideLine?: (slide: ApprovalSlide, itemKey: string) => void;
  onRestoreLine?: (itemKey: string) => void;
  labelHide?: string;
  labelRestore?: string;
}) {
  if (!items.length) return null;
  const visible = deepReport ? items : items.slice(0, 2);
  const keys = itemKeys ?? [];
  const rm = Boolean(
    reviewMode &&
      slide &&
      itemKeys &&
      hiddenKeys &&
      onHideLine &&
      onRestoreLine &&
      labelHide &&
      labelRestore,
  );
  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-2xl border border-border bg-card/95 shadow-sm",
        "border-l-4",
        barClass,
      )}
    >
      <div className="px-4 pt-3 pb-3 w-full">
        <p
          className={cn(
            "text-[10px] font-black uppercase tracking-widest mb-3 border-b border-border pb-2",
            accent,
          )}
        >
          {symbol} {label}
        </p>
        {visible.map((item, i) => {
          const ik = keys[i];
          const hidden = Boolean(ik && hiddenKeys?.has(ik));
          return (
            <div
              key={i}
              className={cn("flex gap-2 items-start mb-2 last:mb-0 w-full min-w-0", hidden && "opacity-45")}
            >
              {rm && ik ? (
                <ProfileReviewToggle
                  reviewMode
                  itemKey={ik}
                  slide={slide!}
                  hidden={hidden}
                  pending={Boolean(overridePending)}
                  onHide={onHideLine!}
                  onRestore={onRestoreLine!}
                  labelHide={labelHide!}
                  labelRestore={labelRestore!}
                />
              ) : null}
              <span className={`font-black text-sm shrink-0 leading-snug ${accent}`}>{symbol}</span>
              <span
                className={cn(
                  "text-sm font-semibold leading-snug text-foreground min-w-0 flex-1 break-words whitespace-normal",
                  hidden && "line-through",
                )}
              >
                {item}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EmptySlate({ text }: { text: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 opacity-25 py-16">
      <ShieldAlert className="w-10 h-10 text-muted-foreground" />
      <p className="text-sm font-semibold text-muted-foreground text-center px-8">{text}</p>
    </div>
  );
}

// ScrollSlide — slide wrapper with top/bottom scroll indicators
function ScrollSlide({
  children,
  accentColor,
  bottomPadClass = "pb-24",
}: {
  children: React.ReactNode;
  accentColor: string;
  bottomPadClass?: string;
}) {
  const { t } = useLocale();
  const ref = React.useRef<HTMLDivElement>(null);
  const [canScrollDown, setCanScrollDown] = React.useState(false);
  const [canScrollUp,   setCanScrollUp]   = React.useState(false);

  const check = () => {
    const el = ref.current;
    if (!el) return;
    setCanScrollUp(el.scrollTop > 8);
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 8);
  };

  React.useEffect(() => {
    check();
    const el = ref.current;
    el?.addEventListener("scroll", check, { passive: true });
    return () => el?.removeEventListener("scroll", check);
  }, [children]);

  return (
    <div
      ref={ref}
      className="relative flex-1 min-h-0 flex flex-col w-full overflow-y-auto overflow-x-hidden bg-background scroll-smooth"
    >
      {/* Top fade + indicator */}
      {canScrollUp && (
        <div className="absolute top-0 left-0 w-full h-12 z-10 pointer-events-none bg-gradient-to-b from-background via-background/85 to-transparent">
          <div className="flex justify-center pt-1">
            <div className={`w-4 h-4 flex items-center justify-center opacity-60 ${accentColor}`}>
              <svg viewBox="0 0 10 6" className="w-3 h-3 fill-current"><path d="M5 0L10 6H0z"/></svg>
            </div>
          </div>
        </div>
      )}

      <div className={cn("w-full flex flex-col px-5 pt-20 gap-3", bottomPadClass)}>
        {children}
      </div>

      {/* Bottom fade + indicator */}
      {canScrollDown && (
        <div className="absolute bottom-0 left-0 w-full h-16 z-10 pointer-events-none bg-gradient-to-t from-background via-background/80 to-transparent">
          <div className="flex justify-center absolute bottom-3 w-full">
            <div className={`flex items-center gap-1 opacity-70 ${accentColor}`}>
              <svg viewBox="0 0 10 6" className="w-3 h-3 fill-current rotate-180"><path d="M5 0L10 6H0z"/></svg>
              <span className="text-[9px] font-black uppercase tracking-widest">{t("scroll")}</span>
              <svg viewBox="0 0 10 6" className="w-3 h-3 fill-current rotate-180"><path d="M5 0L10 6H0z"/></svg>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── main ──────────────────────────────────────────────────────────────────────
export default function PlayerProfileViewer() {
  const { t } = useLocale();
  const [, params] = useRoute("/player/:id");
  const [, paramsCoach] = useRoute("/coach/player/:id/profile");
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { profile, user } = useAuth();
  const [page, setPage] = useState(0);
  const [dir, setDir] = useState(0);
  const [deepReport, setDeepReport] = useState(false);

  const playerIdRoute = params?.id ?? paramsCoach?.id ?? "";
  const isReviewMode =
    Boolean(paramsCoach) &&
    new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("mode") === "review";

  const [approvalOnboardingDismissed, setApprovalOnboardingDismissed] = useState(() => {
    try {
      if (typeof window === "undefined") return false;
      return localStorage.getItem(APPROVAL_ONBOARDING_LS) === "1";
    } catch {
      return false;
    }
  });
  const showApprovalOnboarding = isReviewMode && !approvalOnboardingDismissed;
  const dismissApprovalOnboarding = () => {
    try {
      localStorage.setItem(APPROVAL_ONBOARDING_LS, "1");
    } catch {
      /* ignore */
    }
    setApprovalOnboardingDismissed(true);
  };

  const { data: approvalStatus } = useApprovalStatus(playerIdRoute, {
    enabled: Boolean(playerIdRoute) && isReviewMode,
  });
  const setOverrideMut = useSetReportOverride(playerIdRoute);
  const deleteOverrideMut = useDeleteReportOverride(playerIdRoute);

  const coachIdForReview = profile?.id ?? user?.id ?? "";
  const hiddenKeys = useMemo(() => {
    if (!approvalStatus?.overrides || !coachIdForReview) return new Set<string>();
    return new Set(
      approvalStatus.overrides
        .filter((o) => o.coachId === coachIdForReview && o.action === "hide")
        .map((o) => o.itemKey),
    );
  }, [approvalStatus?.overrides, coachIdForReview]);

  const onHideLine = (slide: ApprovalSlide, itemKey: string) => {
    setOverrideMut.mutate({ slide, itemKey, action: "hide" });
  };
  const onRestoreLine = (itemKey: string) => {
    deleteOverrideMut.mutate(itemKey);
  };
  const overridePending = setOverrideMut.isPending || deleteOverrideMut.isPending;
  const labelHide = t("approval_hide_line");
  const labelRestore = t("approval_restore_line");

  const { mutate: recordSlideView } = useRecordPlayerSlideView();
  useEffect(() => {
    if (!params?.id || isReviewMode) return;
    recordSlideView({ playerId: params.id, slideIndex: page });
  }, [params?.id, page, isReviewMode, recordSlideView]);

  const { data: player, isLoading: pLoad } = usePlayer(playerIdRoute);
  const { data: teams = [], isLoading: tLoad } = useTeams();
  const team = teams.find(t => t.id === player?.teamId);

  if (pLoad || tLoad) return (
    <div className="flex items-center justify-center h-[100dvh] bg-background">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!player || !team) return (
    <div className="flex flex-col items-center justify-center h-[100dvh] bg-background p-6 text-center gap-4">
      <ShieldAlert className="w-16 h-16 text-muted-foreground" />
      <h2 className="text-xl font-bold text-foreground">{t("profile_not_found")}</h2>
      <Button
        onClick={() =>
          setLocation(
            paramsCoach ? (isReviewMode ? "/coach/editor" : "/coach/reports") : "/player",
          )
        }
        variant="outline"
      >
        {t("back")}
      </Button>
    </div>
  );

  const inp = player.scoutingInputs ?? player.inputs;
  const generated = React.useMemo(() => generateProfile(inp, player.name), [player?.id, inp, player?.name]);
  const im  = generated.internalModel;
  const dp  = generated.defensivePlan ?? { defender: [], forzar: [], concede: [] };
  const archetype = generated.archetype ?? player.archetype;
  const keyTraits = generated.keyTraits ?? player.keyTraits;

  const getTraits = (arr: any[] = []) =>
    arr.map((item: any) => {
      const raw = typeof item === "string" ? item : (item?.valueToken ?? item?.value);
      return raw ? translateOutput(raw, t) : null;
    }).filter(Boolean) as string[];

  const postTraits    = getTraits(im?.postTraits);
  const isoTraits     = getTraits(im?.isoTraits);
  const pnrTraits     = getTraits(im?.pnrTraits);
  const offBallTraits = getTraits(im?.offBallTraits);

  const postScore    = (im?.postTraits    ?? []).reduce((s: number, t: any) => s + (t?.score ?? 0), 0);
  const isoScore     = (im?.isoTraits     ?? []).reduce((s: number, t: any) => s + (t?.score ?? 0), 0);
  const pnrScore     = (im?.pnrTraits     ?? []).reduce((s: number, t: any) => s + (t?.score ?? 0), 0);
  const offBallScore = (im?.offBallTraits ?? []).reduce((s: number, t: any) => s + (t?.score ?? 0), 0);

  // Threats ordered by danger
  const allThreatSections = [
    {
      label: "tab_post",
      traits: postTraits,
      score: postScore,
      freq: inp.postFrequency,
      accent: "text-purple-800 dark:text-purple-300",
      barClass: "border-l-purple-600/75 dark:border-l-purple-400/55",
    },
    {
      label: "tab_iso",
      traits: isoTraits,
      score: isoScore,
      freq: inp.isoFrequency,
      accent: "text-orange-800 dark:text-orange-300",
      barClass: "border-l-orange-600/75 dark:border-l-orange-400/55",
    },
    {
      label: "tab_pnr",
      traits: pnrTraits,
      score: pnrScore,
      freq: inp.pnrFrequency,
      accent: "text-blue-800 dark:text-blue-300",
      barClass: "border-l-blue-600/75 dark:border-l-blue-400/55",
    },
    {
      label: "tab_offball",
      traits: offBallTraits,
      score: offBallScore,
      freq: inp.transitionFrequency,
      accent: "text-emerald-800 dark:text-emerald-300",
      barClass: "border-l-emerald-600/75 dark:border-l-emerald-400/55",
    },
  ].filter((s) => s.traits.length > 0).sort((a, b) => b.score - a.score);

  // Slide 3 — spatial
  const slide3Items: string[] = [];
  if (im?.dominantSide && im.dominantSide !== "Ambidextrous") {
    const weak = im.dominantSide === "Right" ? "left" : "right";
    slide3Items.push(`spatial_goes|side=${im.dominantSide.toLowerCase()}|weak=${weak}`);
  } else if (im?.dominantSide === "Ambidextrous") {
    slide3Items.push("spatial_ambidextrous");
  }
  if (isAct(inp.postFrequency) && inp.postPreferredBlock && inp.postPreferredBlock !== "Any") {
    const block = inp.postPreferredBlock.toLowerCase().replace(" block", "");
    slide3Items.push(`spatial_post_block|block=${block}`);
  }
  if (isPri(inp.transitionFrequency)) {
    if (inp.transitionRole === "Pusher") slide3Items.push("spatial_trans_pusher");
    else if (inp.transitionRole === "Rim Runner") slide3Items.push("spatial_trans_runner");
    else if (inp.transitionRole === "Outlet") slide3Items.push("spatial_trans_outlet");
    else if (inp.transitionRole === "Trailer") slide3Items.push("spatial_trans_trailer");
    else slide3Items.push("spatial_transition_active");
  }
  if (isPri(inp.backdoorFrequency)) {
    slide3Items.push("spatial_backdoor_primary");
  } else if (isAct(inp.backdoorFrequency)) {
    slide3Items.push("spatial_backdoor_active");
  }
  if (isPri(inp.indirectsFrequency)) {
    slide3Items.push("spatial_indirects");
  }
  if (isPri(inp.offensiveReboundFrequency)) {
    slide3Items.push("spatial_crashing");
  }
  if ((inp as any).pnrTiming === "Early (Drag)") {
    slide3Items.push("spatial_drag_screens");
  }
  if (slide3Items.length === 0) slide3Items.push("no_spatial");

  // Slide 4 — PnR
  const slide4Items = [...pnrTraits];
  if ((inp as any).slipFrequency && isAct((inp as any).slipFrequency)) {
    slide4Items.push(translateOutput("spatial_slips", t));
  }

  const ath  = toNum(inp.athleticism, 3);
  const phys = toNum(inp.physicalStrength, 3);
  const vis  = toNum((inp as any).courtVision, 3);
  const subArch = generated.subArchetype;

  const identityPhysTags: { key: string; el: React.ReactNode }[] = [];
  if (ath === 5) {
    identityPhysTags.push({
      key: "identity:phys:ath5",
      el: (
        <span className="text-xs font-bold text-yellow-300 bg-yellow-500/15 px-3 py-1 rounded-full">
          ⚡ {t("elite_athlete")}
        </span>
      ),
    });
  }
  if (ath === 4) {
    identityPhysTags.push({
      key: "identity:phys:ath4",
      el: (
        <span className="text-xs font-bold text-yellow-400 bg-yellow-500/10 px-3 py-1 rounded-full">
          ⚡ {t("athletic")}
        </span>
      ),
    });
  }
  if (ath <= 1) {
    identityPhysTags.push({
      key: "identity:phys:ath_low",
      el: (
        <span className="text-xs font-bold text-muted-foreground bg-muted px-3 py-1 rounded-full border border-border">
          {t("limited_athlete")}
        </span>
      ),
    });
  }
  if (phys === 5) {
    identityPhysTags.push({
      key: "identity:phys:phys5",
      el: (
        <span className="text-xs font-bold text-red-300 bg-red-500/15 px-3 py-1 rounded-full">
          💪 {t("physically_dominant")}
        </span>
      ),
    });
  }
  if (phys === 4) {
    identityPhysTags.push({
      key: "identity:phys:phys4",
      el: (
        <span className="text-xs font-bold text-red-400 bg-red-500/10 px-3 py-1 rounded-full">
          💪 {t("physical")}
        </span>
      ),
    });
  }
  if (vis >= 4) {
    identityPhysTags.push({
      key: "identity:phys:vision",
      el: (
        <span className="text-xs font-bold text-blue-300 bg-blue-500/10 px-3 py-1 rounded-full">
          🧠 {vis === 5 ? t("elite_vision") : t("high_iq")}
        </span>
      ),
    });
  }

  const slideBottomPad = isReviewMode ? "pb-44" : "pb-24";

  // ── SLIDE 1 — Identity ────────────────────────────────────────────────────
  const S1 = (
    <div
      className={cn(
        "h-full min-h-0 flex flex-col items-center justify-center text-center px-6 gap-5 bg-background overflow-y-auto",
        isReviewMode && "pb-36",
      )}
    >
      <div className="absolute top-0 left-0 w-full h-1 bg-primary" />
      <div className="relative mt-4">
        <div className="absolute inset-0 blur-2xl opacity-25 rounded-full bg-primary" />
        {isRealPhoto(player.imageUrl)
          ? <img src={player.imageUrl} alt={player.name}
              className="w-32 h-32 rounded-full object-cover border-4 border-primary/35 shadow-2xl relative z-10" />
          : <div className="w-32 h-32 rounded-full border-4 border-primary/35 shadow-2xl relative z-10 overflow-hidden">
              <BasketballPlaceholderAvatar size={128} />
            </div>
        }
        <div className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full border-2 border-background flex items-center justify-center font-black text-sm z-20 bg-primary text-primary-foreground shadow-lg">
          {player.number}
        </div>
      </div>

      <div>
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight">{player.name}</h1>
        <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest mt-1">
          {inp.position} · {inp.height} · {inp.weight}
        </p>
      </div>

      {/* Archetype + subarchetype */}
      <div className="w-full bg-primary/10 border border-primary/25 rounded-2xl px-5 py-4 text-left">
        <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">{t("archetype")}</p>
        <div className="flex gap-2 items-start justify-center">
          <ProfileReviewToggle
            reviewMode={isReviewMode}
            itemKey="identity:archetype"
            slide="identity"
            hidden={hiddenKeys.has("identity:archetype")}
            pending={overridePending}
            onHide={onHideLine}
            onRestore={onRestoreLine}
            labelHide={labelHide}
            labelRestore={labelRestore}
          />
          <p
            className={cn(
              "text-2xl font-black italic text-foreground leading-tight flex-1 text-center",
              hiddenKeys.has("identity:archetype") && "opacity-45 line-through",
            )}
          >
            {archetype ? t(archetype as any) : "—"}
          </p>
        </div>
        {subArch && (
          <div className="flex gap-2 items-start mt-2 justify-center">
            <ProfileReviewToggle
              reviewMode={isReviewMode}
              itemKey="identity:subarch"
              slide="identity"
              hidden={hiddenKeys.has("identity:subarch")}
              pending={overridePending}
              onHide={onHideLine}
              onRestore={onRestoreLine}
              labelHide={labelHide}
              labelRestore={labelRestore}
            />
            <p
              className={cn(
                "text-xs font-bold text-primary/70 uppercase tracking-widest flex-1 text-center",
                hiddenKeys.has("identity:subarch") && "opacity-45 line-through",
              )}
            >
              {t("subarchetype_label")} {subArch ? t(subArch as any) : ""}
            </p>
          </div>
        )}
      </div>

      {/* Key traits */}
      {keyTraits && keyTraits.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {keyTraits.slice(0, 3).map((trait, i) => {
            const label = t(keyTraitI18nKey(trait) as any);
            const ik = `identity:keytrait:${i}`;
            const hid = hiddenKeys.has(ik);
            return (
              <div key={i} className="flex items-center gap-1">
                <ProfileReviewToggle
                  reviewMode={isReviewMode}
                  itemKey={ik}
                  slide="identity"
                  hidden={hid}
                  pending={overridePending}
                  onHide={onHideLine}
                  onRestore={onRestoreLine}
                  labelHide={labelHide}
                  labelRestore={labelRestore}
                />
                <span
                  className={cn(
                    "px-3 py-1 bg-secondary text-secondary-foreground rounded-full text-xs font-bold border border-border",
                    hid && "opacity-45 line-through",
                  )}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Physical tags */}
      <div className="flex flex-wrap justify-center gap-2">
        {identityPhysTags.map(({ key, el }) => {
          const hid = hiddenKeys.has(key);
          return (
            <div key={key} className="flex items-center gap-1">
              <ProfileReviewToggle
                reviewMode={isReviewMode}
                itemKey={key}
                slide="identity"
                hidden={hid}
                pending={overridePending}
                onHide={onHideLine}
                onRestore={onRestoreLine}
                labelHide={labelHide}
                labelRestore={labelRestore}
              />
              <span className={cn(hid && "opacity-45 line-through")}>{el}</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── SLIDE 2 — How she attacks ─────────────────────────────────────────────
  const S2 = (
    <div className="relative h-full min-h-0 bg-background flex flex-col">
      <div className="absolute top-0 left-0 w-full h-1 bg-red-500 z-20" />
      <ScrollSlide accentColor="text-red-400" bottomPadClass={slideBottomPad}>
      <h2 className="text-lg font-black text-foreground">⚠ {t("how_she_attacks")}</h2>
      <p className="text-xs text-muted-foreground -mt-1">{t("top_threats")}</p>
      {allThreatSections.length === 0
        ? <EmptySlate text={t("no_threats")} />
        : allThreatSections.map((s, i) => (
          <BulletCard key={i}
            title={`${t(s.label as any)} · ${s.freq ? t(("freq_" + s.freq.toLowerCase()) as any) : ""}`}
            top={s.traits.slice(0, 2)}
            rest={s.traits.slice(2)}
            accent={s.accent}
            barClass={s.barClass}
            deepReport={deepReport}
            reviewMode={isReviewMode}
            slide="attack"
            itemKeys={
              deepReport
                ? s.traits.map((_, li) => `attack:${i}:${li}`)
                : s.traits.slice(0, 2).map((_, li) => `attack:${i}:${li}`)
            }
            hiddenKeys={hiddenKeys}
            overridePending={overridePending}
            onHideLine={onHideLine}
            onRestoreLine={onRestoreLine}
            labelHide={labelHide}
            labelRestore={labelRestore}
          />
        ))
      }
      </ScrollSlide>
    </div>
  );

  // ── SLIDE 3 — Where dangerous ─────────────────────────────────────────────
  const slide3TranslatedItems = slide3Items.map(s => translateOutput(s, t));
  const S3 = (
    <div className="relative h-full min-h-0 bg-background flex flex-col">
      <div className="absolute top-0 left-0 w-full h-1 bg-amber-500 z-20" />
      <ScrollSlide accentColor="text-amber-400" bottomPadClass={slideBottomPad}>
      <h2 className="text-lg font-black text-foreground">📍 {t("where_dangerous")}</h2>
      <p className="text-xs text-muted-foreground -mt-1">{t("direction_space")}</p>
      <BulletCard
        title={t("spatial_reads")}
        top={slide3TranslatedItems.slice(0, 2)}
        rest={slide3TranslatedItems.slice(2)}
        accent="text-amber-900 dark:text-amber-200"
        barClass="border-l-amber-600/75 dark:border-l-amber-400/55"
        deepReport={deepReport}
        reviewMode={isReviewMode}
        slide="danger"
        itemKeys={
          deepReport
            ? slide3Items.map((_, idx) => `danger:${idx}`)
            : slide3Items.slice(0, 2).map((_, idx) => `danger:${idx}`)
        }
        hiddenKeys={hiddenKeys}
        overridePending={overridePending}
        onHideLine={onHideLine}
        onRestoreLine={onRestoreLine}
        labelHide={labelHide}
        labelRestore={labelRestore}
      />
      </ScrollSlide>
    </div>
  );

  // ── SLIDE 4 — Screens ─────────────────────────────────────────────────────
  const S4 = (
    <div className="relative h-full min-h-0 bg-background flex flex-col">
      <div className="absolute top-0 left-0 w-full h-1 bg-blue-500 z-20" />
      <ScrollSlide accentColor="text-blue-400" bottomPadClass={slideBottomPad}>
      <h2 className="text-lg font-black text-foreground">⚡ {t("screens_actions")}</h2>
      <p className="text-xs text-muted-foreground -mt-1">{t("pnr_coverage")}</p>
      {slide4Items.length > 0
        ? <BulletCard
            title={`${t("tab_pnr")} · ${inp.pnrFrequency ? t(("freq_" + inp.pnrFrequency.toLowerCase()) as any) : ""}`}
            top={slide4Items.slice(0, 2)}
            rest={slide4Items.slice(2)}
            accent="text-blue-800 dark:text-blue-300"
            barClass="border-l-blue-600/75 dark:border-l-blue-400/55"
            deepReport={deepReport}
            reviewMode={isReviewMode}
            slide="screens"
            itemKeys={
              deepReport
                ? slide4Items.map((_, idx) => `screens:${idx}`)
                : slide4Items.slice(0, 2).map((_, idx) => `screens:${idx}`)
            }
            hiddenKeys={hiddenKeys}
            overridePending={overridePending}
            onHideLine={onHideLine}
            onRestoreLine={onRestoreLine}
            labelHide={labelHide}
            labelRestore={labelRestore}
          />
        : <EmptySlate text={t("no_pnr")} />
      }
      </ScrollSlide>
    </div>
  );

  // ── SLIDE 5 — Defensive plan ──────────────────────────────────────────────
  const defender = (dp.defender ?? []).map(s => translateOutput(s, t));
  const forzar   = (dp.forzar   ?? []).map(s => translateOutput(s, t));
  const concede  = (dp.concede  ?? []).map(s => translateOutput(s, t));
  const hasPlan  = defender.length > 0 || forzar.length > 0 || concede.length > 0;

  const S5 = (
    <div className="relative h-full min-h-0 bg-background flex flex-col">
      <div className="absolute top-0 left-0 w-full h-1 bg-muted-foreground z-20" />
      <ScrollSlide accentColor="text-muted-foreground" bottomPadClass={slideBottomPad}>
      <div className="flex items-center gap-2">
        <Shield className="w-4 h-4 text-muted-foreground" />
        <h2 className="text-lg font-black text-foreground">{t("defensive_plan")}</h2>
      </div>
      <p className="text-xs text-muted-foreground -mt-1">{t("full_plan")}</p>
      {!hasPlan
        ? <EmptySlate text={t("save_to_generate")} />
        : <>
            <PlanCard label={t("defend_tab")} symbol="—" items={defender}
              accent="text-red-800 dark:text-red-300"
              barClass="border-l-red-600/75 dark:border-l-red-400/55"
              deepReport={deepReport}
              reviewMode={isReviewMode}
              slide="plan"
              itemKeys={defender.map((_, idx) => `plan:defender:${idx}`).slice(0, deepReport ? defender.length : Math.min(2, defender.length))}
              hiddenKeys={hiddenKeys}
              overridePending={overridePending}
              onHideLine={onHideLine}
              onRestoreLine={onRestoreLine}
              labelHide={labelHide}
              labelRestore={labelRestore}
            />
            <PlanCard label={t("force_tab")} symbol="→" items={forzar}
              accent="text-blue-800 dark:text-blue-300"
              barClass="border-l-blue-600/75 dark:border-l-blue-400/55"
              deepReport={deepReport}
              reviewMode={isReviewMode}
              slide="plan"
              itemKeys={forzar.map((_, idx) => `plan:forzar:${idx}`).slice(0, deepReport ? forzar.length : Math.min(2, forzar.length))}
              hiddenKeys={hiddenKeys}
              overridePending={overridePending}
              onHideLine={onHideLine}
              onRestoreLine={onRestoreLine}
              labelHide={labelHide}
              labelRestore={labelRestore}
            />
            <PlanCard label={t("give_tab")} symbol="✓" items={concede}
              accent="text-emerald-800 dark:text-emerald-300"
              barClass="border-l-emerald-600/75 dark:border-l-emerald-400/55"
              deepReport={deepReport}
              reviewMode={isReviewMode}
              slide="plan"
              itemKeys={concede.map((_, idx) => `plan:concede:${idx}`).slice(0, deepReport ? concede.length : Math.min(2, concede.length))}
              hiddenKeys={hiddenKeys}
              overridePending={overridePending}
              onHideLine={onHideLine}
              onRestoreLine={onRestoreLine}
              labelHide={labelHide}
              labelRestore={labelRestore}
            />
            {isReviewMode && paramsCoach && dp.motorRunnerUps ? (
              <MotorRunnerUpsReviewPanel
                runnerUps={dp.motorRunnerUps}
                t={t}
                translateFn={(s) => translateOutput(s, t)}
              />
            ) : null}
          </>
      }
      </ScrollSlide>
    </div>
  );

  // ── Navigation ─────────────────────────────────────────────────────────────
  const PAGES = [
    { id: "identity", node: S1, color: "bg-primary" },
    { id: "attack",   node: S2, color: "bg-red-500"    },
    { id: "space",    node: S3, color: "bg-amber-500"  },
    { id: "screens",  node: S4, color: "bg-blue-500"   },
    { id: "plan",     node: S5, color: "bg-muted-foreground"  },
  ];
  const total = PAGES.length;
  const next  = () => { setDir(1);  setPage(p => Math.min(total - 1, p + 1)); };
  const prev  = () => { setDir(-1); setPage(p => Math.max(0, p - 1)); };

  const variants = {
    enter:  (d: number) => ({ x: d > 0 ? "100%" : "-100%", opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit:   (d: number) => ({ x: d > 0 ? "-100%" : "100%", opacity: 0 }),
  };

  return (
    <div
      className={cn(
        "flex flex-col h-[100dvh] bg-background overflow-hidden relative",
        isReviewMode && "pb-[5.5rem]",
      )}
    >

      {/* Header */}
      <header className="absolute top-0 w-full z-50 px-4 pt-4 flex justify-between items-center">
        <Button
          variant="ghost"
          size="icon"
          onClick={() =>
            setLocation(
              paramsCoach ? (isReviewMode ? "/coach/editor" : "/coach/reports") : "/player",
            )
          }
          className="bg-secondary/85 backdrop-blur-md rounded-full border border-border/60 text-foreground hover:bg-muted"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>

        {/* Page dots */}
        <div className="flex gap-1.5 items-center p-2 bg-card/80 backdrop-blur-md border border-border/50 rounded-full">
          {PAGES.map((p, i) => (
            <button key={i} onClick={() => { setDir(i > page ? 1 : -1); setPage(i); }}
              className={`rounded-full transition-all duration-300 ${page === i ? `w-5 h-2 ${p.color}` : "w-2 h-2 bg-muted-foreground/35"}`} />
          ))}
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/player/settings")}
            className="bg-secondary/85 backdrop-blur-md rounded-full border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted w-9 h-9">
            <Settings className="w-4 h-4" />
          </Button>

        {/* Deep Report toggle — book icon + label */}
        <button
          onClick={() => setDeepReport(v => !v)}
          className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all"
          title={deepReport ? t("deep_report_on") : t("deep_report_off")}
        >
          <BookOpen className={`w-4 h-4 transition-colors ${deepReport ? "text-primary" : "text-muted-foreground"}`} />
          <span className={`text-[9px] font-black uppercase tracking-widest transition-colors ${deepReport ? "text-primary" : "text-muted-foreground"}`}>
            {deepReport ? t("deep") : t("basic")}
          </span>
        </button>
        </div>
      </header>

      {showApprovalOnboarding && (
        <div className="relative z-40 shrink-0 px-3 pt-16 pb-2">
          <div className="rounded-xl border border-border bg-card/95 text-card-foreground shadow-md backdrop-blur-sm p-3 max-w-md mx-auto">
            <p className="text-xs font-bold text-foreground mb-2">{t("onboarding_review_title")}</p>
            <ul className="space-y-2 text-xs text-muted-foreground mb-3">
              <li className="leading-snug">{t("onboarding_save_step")}</li>
              <li className="leading-snug">{t("onboarding_approve_step")}</li>
              <li className="leading-snug">{t("onboarding_publish_step")}</li>
            </ul>
            <Button
              type="button"
              size="sm"
              className="w-full font-bold"
              onClick={dismissApprovalOnboarding}
            >
              {t("onboarding_dismiss")}
            </Button>
          </div>
        </div>
      )}

      {/* Swipeable content */}
      <div className="flex-1 relative min-h-0">
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.div key={`${page}-${deepReport}`} custom={dir}
            variants={variants} initial="enter" animate="center" exit="exit"
            transition={{ type: "tween", duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="absolute inset-0 w-full h-full min-h-0 overflow-hidden"
            drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.12}
            onDragEnd={(_, { offset, velocity }) => {
              if (Math.abs(velocity.x) > 400) { velocity.x < 0 ? next() : prev(); }
              else if (Math.abs(offset.x) > 60) { offset.x < 0 ? next() : prev(); }
            }}>
            {PAGES[page].node}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Nav arrows */}
      <div
        className={cn(
          "absolute left-0 w-full flex justify-between px-6 z-50 pointer-events-none",
          isReviewMode ? "bottom-28" : "bottom-6",
        )}
      >
        <Button variant="ghost" size="icon" onClick={prev}
          className={`rounded-full pointer-events-auto border border-border/60 w-12 h-12 bg-secondary/85 backdrop-blur-md text-foreground hover:bg-muted transition-opacity ${page === 0 ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <Button variant="ghost" size="icon" onClick={next}
          className={`rounded-full pointer-events-auto border border-border/60 w-12 h-12 bg-secondary/85 backdrop-blur-md text-foreground hover:bg-muted transition-opacity ${page === total - 1 ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
          <ChevronRight className="w-6 h-6" />
        </Button>
      </div>

      {isReviewMode && paramsCoach && <ApprovalBar playerId={playerIdRoute} />}
    </div>
  );
}
