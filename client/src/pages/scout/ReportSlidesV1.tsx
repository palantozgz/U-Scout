import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, MoreVertical } from "lucide-react";
import { generateMotorV4 } from "@/lib/motor-v4";
import { SITUATION_ICONS, DEFENSE_ICONS, AWARE_ICONS } from "@/lib/motor-icons";
import {
  renderReport,
  renderSituationDescription,
  type RenderContext,
} from "@/lib/reportTextRenderer";
import {
  usePlayer,
  clubRowToMotorContext,
  playerInputToMotorInputs,
} from "@/lib/mock-data";
import { useLocale } from "@/lib/i18n";
import { useAuth } from "@/lib/useAuth";
import { useClub } from "@/lib/club-api";
import { cn, isRealPhoto } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { applyOverrides, type ReportOverride } from "@/lib/overrideEngine";

const BasketballPlaceholderAvatar = lazy(() =>
  import("@/components/BasketballPlaceholderAvatar").then(m => ({
    default: m.BasketballPlaceholderAvatar,
  })),
);

export interface ReportSlidesV1Props {
  playerId: string;
  onBack?: () => void;
  coachMode?: boolean;
  bottomBar?: React.ReactNode;
  overrides?: ReportOverride[];
}

interface ActiveSheet {
  title: string;
  current: string;
  alternatives: { text: string; score: number }[];
}

const TOTAL_SLIDES = 3;
const SWIPE_THRESHOLD = 50;
const DRAG_THRESHOLD = 40;
const ARROW_HIDE_DELAY = 1800;

// ── Design tokens ─────────────────────────────────────────────────────────────
const DENY_CLASSES  = { border: "border-l-red-500",    bg: "bg-red-500/8",     text: "text-red-500 dark:text-red-400",       dot: "bg-red-500"    };
const FORCE_CLASSES = { border: "border-l-amber-500",  bg: "bg-amber-500/8",   text: "text-amber-500 dark:text-amber-400",   dot: "bg-amber-500"  };
const ALLOW_CLASSES = { border: "border-l-emerald-500",bg: "bg-emerald-500/8", text: "text-emerald-600 dark:text-emerald-400",dot: "bg-emerald-500"};
const AWARE_CLASSES = { border: "border-l-violet-500", bg: "bg-violet-500/8",  text: "text-violet-500 dark:text-violet-400", dot: "bg-violet-500" };

export default function ReportSlidesV1({
  playerId,
  onBack,
  coachMode = false,
  bottomBar,
  overrides,
}: ReportSlidesV1Props) {
  const { t, locale } = useLocale();
  const { user } = useAuth();
  const { data: player, isLoading } = usePlayer(playerId);
  const clubQ = useClub({ enabled: Boolean(user) });
  const clubMotorCtx = useMemo(
    () => clubRowToMotorContext(clubQ.data?.club),
    [clubQ.data?.club],
  );
  const clubGender = clubQ.data?.club?.gender;
  const gender = clubGender === "F" ? "f" : clubGender === "M" ? "m" : "n";
  const clubEmoji =
    (clubQ.data?.club as { emoji?: string } | undefined)?.emoji ?? "🏀";

  const [slide, setSlide] = useState(0);
  const [arrowsVisible, setArrowsVisible] = useState(false);
  const [activeSheet, setActiveSheet] = useState<ActiveSheet | null>(null);
  const [showSwipeHint, setShowSwipeHint] = useState(false);

  const touchStartX = useRef<number | null>(null);
  const dragStartX = useRef<number | null>(null);
  const isDragging = useRef(false);
  const arrowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const key = "uscout:swipe-hint-seen:v1";
    try {
      if (!localStorage.getItem(key)) {
        setShowSwipeHint(true);
        localStorage.setItem(key, "1");
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (coachMode) return;
    if (!user) return;
    if (!playerId) return;
    void fetch("/api/player/views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId, slideIndex: slide }),
    }).catch(() => {
      // ignore
    });
  }, [slide, coachMode, playerId, user]);

  function showArrows() {
    setArrowsVisible(true);
    if (arrowTimer.current) clearTimeout(arrowTimer.current);
    arrowTimer.current = setTimeout(() => setArrowsVisible(false), ARROW_HIDE_DELAY);
  }

  const motorOutput = useMemo(() => {
    if (!player) return null;
    const inp = player.scoutingInputs ?? player.inputs;
    return generateMotorV4(playerInputToMotorInputs(inp), clubMotorCtx);
  }, [player, clubMotorCtx]);

  const ctx: RenderContext = { locale, gender };

  const report = useMemo(() => {
    if (!motorOutput) return null;
    return renderReport(motorOutput, ctx);
  }, [motorOutput, locale, gender]);

  const finalReport = useMemo(() => {
    if (!report) return null;
    if (!overrides || overrides.length === 0) return report;
    return applyOverrides(report, overrides);
  }, [report, overrides]);

  const situationRunnersUp = useMemo(() => {
    if (!motorOutput || !report) return [];
    const shownIds = new Set(report.situations.slice(0, 3).map((s) => s.id));
    return motorOutput.situations
      .filter((s) => s.score > 0 && !shownIds.has(s.id))
      .sort((a, b) => b.score - a.score)
      .map((s) => ({
        text: renderSituationDescription(s, ctx, motorOutput.inputs),
        score: s.score,
        id: s.id,
      }));
  }, [motorOutput, report, locale, gender]);

  function openSituationSheet(sitId: string, current: string) {
    setActiveSheet({
      title: locale === "es" ? "Alternativas" : locale === "zh" ? "其他选项" : "Alternatives",
      current,
      alternatives: situationRunnersUp.map((r) => ({ text: r.text, score: r.score })),
    });
  }

  function openDefenseSheet(
    type: "deny" | "force" | "allow",
    current: string,
    alternatives: { instruction: string; score: number }[],
  ) {
    const labels = {
      deny:  { en: "DENY alternatives",  es: "Alternativas DENY",  zh: "封堵备选" },
      force: { en: "FORCE alternatives", es: "Alternativas FORCE", zh: "逼迫备选" },
      allow: { en: "ALLOW alternatives", es: "Alternativas ALLOW", zh: "放开备选" },
    };
    setActiveSheet({
      title: labels[type][locale],
      current,
      alternatives: alternatives.map((a) => ({ text: a.instruction, score: a.score })),
    });
  }

  function openArchetypeSheet(current: string) {
    if (!finalReport) return;
    setActiveSheet({
      title:
        locale === "es" ? "Alternativas de arquetipo"
        : locale === "zh" ? "原型备选"
        : "Archetype alternatives",
      current,
      alternatives: finalReport.identity.archetypeAlternatives.map((a) => ({
        text: a.label,
        score: a.score,
      })),
    });
  }

  function goTo(i: number) {
    setSlide(Math.min(Math.max(i, 0), TOTAL_SLIDES - 1));
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    showArrows();
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const delta = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(delta) < SWIPE_THRESHOLD) { touchStartX.current = null; return; }
    if (delta > 0) goTo(slide + 1);
    else goTo(slide - 1);
    touchStartX.current = null;
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (e.pointerType === "touch") return;
    dragStartX.current = e.clientX;
    isDragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function handlePointerMove(e: React.PointerEvent) {
    if (e.pointerType !== "touch") showArrows();
    if (!isDragging.current || dragStartX.current === null) return;
    if (Math.abs(e.clientX - dragStartX.current) > 8) e.preventDefault();
  }
  function handlePointerUp(e: React.PointerEvent) {
    if (!isDragging.current || dragStartX.current === null) return;
    const delta = dragStartX.current - e.clientX;
    if (Math.abs(delta) >= DRAG_THRESHOLD) {
      if (delta > 0) goTo(slide + 1);
      else goTo(slide - 1);
    }
    dragStartX.current = null;
    isDragging.current = false;
  }

  if (isLoading || !player) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center text-muted-foreground">
        {t("saving")}
      </div>
    );
  }
  if (!finalReport || !motorOutput) {
    return (
      <div className="p-4 text-muted-foreground">
        {locale === "es" ? "No se pudo generar el informe."
          : locale === "zh" ? "无法生成报告。"
          : "Could not generate report."}
      </div>
    );
  }

  const photo = isRealPhoto(player.imageUrl);
  const subAlt = finalReport.identity.archetypeAlternatives[0];
  const topSituations = finalReport.situations.slice(0, 3);
  const topAlerts = finalReport.alerts.slice(0, 2);
  const hasPrev = slide > 0;
  const hasNext = slide < TOTAL_SLIDES - 1;
  const position = (player.inputs?.position ?? "").split("/")[0]?.trim() ?? "";
  const jerseyNumber = player.number?.trim() ?? "";

  // Slide labels
  const slideLabels = [
    locale === "es" ? "¿Quién es?" : locale === "zh" ? "她是谁？" : "Who are they?",
    locale === "es" ? "¿Qué hará?" : locale === "zh" ? "她会怎么做？" : "What will they do?",
    locale === "es" ? "¿Qué hago yo?" : locale === "zh" ? "我该怎么做？" : "What do I do?",
  ];

  return (
    <>
      <style>{`
        @keyframes swipe-hint {
          0% { opacity: 0; transform: translateX(-50%) translateX(0px); }
          20% { opacity: 1; transform: translateX(-50%) translateX(0px); }
          45% { opacity: 1; transform: translateX(-50%) translateX(-12px); }
          55% { opacity: 1; transform: translateX(-50%) translateX(12px); }
          80% { opacity: 1; transform: translateX(-50%) translateX(0px); }
          100% { opacity: 0; transform: translateX(-50%) translateX(0px); }
        }
      `}</style>
      <div
        className="flex min-h-[100dvh] flex-col bg-background select-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* ── HEADER ───────────────────────────────────── */}
        <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
          <div className="flex items-center gap-3 px-4 py-3">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="-ml-1 rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            ) : (
              <div className="w-7" />
            )}

            {/* Slide pills */}
            <div className="flex flex-1 items-center justify-center gap-2">
              {Array.from({ length: TOTAL_SLIDES }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => goTo(i)}
                  className={cn(
                    "rounded-full transition-all duration-200",
                    i === slide
                      ? "h-2 w-8 bg-primary"
                      : "h-2 w-2 bg-muted-foreground/25 hover:bg-muted-foreground/50",
                  )}
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
            </div>

            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-base">
              {clubEmoji}
            </div>
          </div>

          {/* Slide label under pills */}
          <div className="pb-2 text-center">
            <span className="text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground/40">
              {slideLabels[slide]}
            </span>
          </div>
        </div>

        {/* ── SLIDE VIEWPORT ───────────────────────────── */}
        <div
          className="relative flex-1 overflow-hidden cursor-grab active:cursor-grabbing"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {showSwipeHint && (
            <div
              className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
              style={{ animation: "swipe-hint 1.5s ease-in-out 0.5s forwards" }}
            >
              <div className="flex items-center gap-2 bg-foreground/80 text-background text-xs font-bold px-4 py-2 rounded-full backdrop-blur-sm">
                <span>←</span>
                <span>swipe</span>
                <span>→</span>
              </div>
            </div>
          )}
          <div
            className="flex h-full transition-transform duration-300 ease-out"
            style={{
              width: `${TOTAL_SLIDES * 100}%`,
              transform: `translateX(-${(slide * 100) / TOTAL_SLIDES}%)`,
            }}
          >
            {/* ════ SLIDE 1 — Who are they? ════ */}
            <div
              className="flex flex-col overflow-y-auto px-6 pb-10 pt-6"
              style={{ width: `${100 / TOTAL_SLIDES}%` }}
            >
              {/* Avatar */}
              <div className="flex justify-center mb-5">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full overflow-hidden bg-muted flex items-center justify-center ring-2 ring-border">
                    {photo ? (
                      <img src={player.imageUrl!} alt={player.name} className="w-full h-full object-cover" />
                    ) : (
                      <Suspense fallback={<div className="w-full h-full bg-muted" />}>
                        <BasketballPlaceholderAvatar size={96} />
                      </Suspense>
                    )}
                  </div>
                  {jerseyNumber && (
                    <div className="absolute -bottom-1 -right-1 min-w-[26px] h-[26px] rounded-full bg-primary flex items-center justify-center px-1">
                      <span className="text-[11px] font-black text-primary-foreground">{jerseyNumber}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Name */}
              <h1 className="text-[26px] font-black text-center text-foreground leading-tight mb-1">
                {player.name || "—"}
              </h1>

              {/* Archetype badge */}
              <div className="flex justify-center mb-3">
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-primary/30 bg-primary/8"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => openArchetypeSheet(finalReport.identity.archetypeLabel)}
                >
                  <span className="text-[11px] font-black uppercase tracking-[0.15em] text-primary">
                    {finalReport.identity.archetypeLabel}
                  </span>
                  {position && (
                    <>
                      <span className="text-primary/40">·</span>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-primary/70">{position}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Tagline */}
              <p className="text-center text-[13px] italic text-muted-foreground/70 leading-relaxed mb-5 px-2">
                {finalReport.identity.tagline}
              </p>

              {/* Threat Card — matches Figma exactly */}
              <div className={cn(
                "rounded-2xl border border-border/50 overflow-hidden mb-5",
                finalReport.identity.dangerLevel >= 4 ? "border-red-500/20" :
                finalReport.identity.dangerLevel >= 3 ? "border-orange-500/20" : "border-border/40"
              )}>
                <div className="flex">
                  {/* Accent bar */}
                  <div className={cn("w-1 shrink-0",
                    finalReport.identity.dangerLevel >= 4 ? "bg-red-500" :
                    finalReport.identity.dangerLevel >= 3 ? "bg-orange-500" :
                    finalReport.identity.dangerLevel >= 2 ? "bg-yellow-400" : "bg-muted"
                  )} />
                  <div className="flex-1 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground/50 mb-1">
                          THREAT LEVEL
                        </p>
                        <p className={cn("text-[18px] font-black leading-none",
                          finalReport.identity.dangerLevel >= 4 ? "text-red-500 dark:text-red-400" :
                          finalReport.identity.dangerLevel >= 3 ? "text-orange-500 dark:text-orange-400" :
                          finalReport.identity.dangerLevel >= 2 ? "text-yellow-600 dark:text-yellow-400" :
                          "text-muted-foreground"
                        )}>
                          {finalReport.identity.dangerLevel >= 5 ? "ELITE" :
                           finalReport.identity.dangerLevel >= 4 ? "HIGH" :
                           finalReport.identity.dangerLevel >= 3 ? "DANGEROUS" :
                           finalReport.identity.dangerLevel >= 2 ? "MODERATE" : "LOW"}
                        </p>
                      </div>
                      <p className="text-[12px] text-muted-foreground/70 leading-snug text-right max-w-[180px]">
                        {(finalReport.identity as any).threat}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Top situations list */}
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground/40 mb-3">
                  TOP SITUATIONS
                </p>
                <div className="space-y-2">
                  {topSituations.map((sit, idx) => {
                    const colors = situationColors(sit.id);
                    const barW = Math.round(Math.min(sit.score, 1) * 100);
                    return (
                      <div key={sit.id} className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-[12px] font-black text-foreground truncate">{sit.label}</p>
                            <p className={cn("text-[9px] font-bold uppercase shrink-0 ml-2", colors.text)}>
                              {sit.tier === "primary" ? "PRIMARY" : "SECONDARY"}
                            </p>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-muted/40 overflow-hidden">
                            <div
                              className={cn("h-full rounded-full", colors.border.replace("border-l-", "bg-"))}
                              style={{ width: `${barW}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ════ SLIDE 2 — What will they do? ════ */}
            <div
              className="flex flex-col overflow-y-auto px-6 pb-10 pt-4"
              style={{ width: `${100 / TOTAL_SLIDES}%` }}
            >
              <p className="text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground/40 mb-1">
                {locale === "es" ? "¿QUÉ HARÁ?" : locale === "zh" ? "她会怎么做？" : "WHAT WILL THEY DO?"}
              </p>
              <h2 className="text-[20px] font-black text-foreground mb-3">{player.name || "—"}</h2>
              <div className="h-px bg-border/40 mb-4" />
              <div className="space-y-4">
                {topSituations.map((sit, idx) => {
                  const colors = situationColors(sit.id);
                  const barW = Math.round(Math.min(sit.score, 1) * 100);
                  return (
                    <div key={sit.id} className={cn(
                      "rounded-2xl border border-border/30 border-l-[4px] overflow-hidden",
                      colors.border
                    )}>
                      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
                        {/* Big rank number */}
                        <span className={cn("text-[32px] font-black tabular-nums leading-none opacity-15 shrink-0 select-none mt-0.5", colors.text)}>
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                        <div className="flex-1 min-w-0">
                          {/* Title + badge */}
                          <div className="flex items-center gap-2 mb-2">
                            {(() => { const Icon = SITUATION_ICONS[sit.id]; return Icon ? <Icon className="w-4 h-4 shrink-0 text-muted-foreground/60" /> : null; })()}
                            <p className="text-[15px] font-black text-foreground flex-1 truncate">{sit.label}</p>
                            {coachMode && (
                              <button
                                type="button"
                                className="shrink-0 p-1.5 -mr-1 text-muted-foreground/40 hover:text-muted-foreground"
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={() => openSituationSheet(sit.id, sit.description)}
                              >
                                <MoreVertical className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                          <div className={cn("inline-flex items-center px-2 py-0.5 rounded-full mb-2", colors.bg)}>
                            <span className={cn("text-[9px] font-black uppercase tracking-wider", colors.text)}>
                              {sit.tier === "primary" ? "PRIMARY" : sit.tier === "secondary" ? "SECONDARY" : "SITUATIONAL"}
                            </span>
                          </div>
                          {/* Description */}
                          <p className="text-[13px] leading-snug text-foreground/80 mb-3">{sit.description}</p>
                          {/* Frequency bar */}
                          <div className="h-1.5 w-full rounded-full bg-muted/35 overflow-hidden">
                            <div
                              className={cn("h-full rounded-full", colors.border.replace("border-l-", "bg-"))}
                              style={{ width: `${barW}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ════ SLIDE 3 — What do I do? ════ */}
            <div
              className="flex flex-col overflow-y-auto px-6 pb-10 pt-4"
              style={{ width: `${100 / TOTAL_SLIDES}%` }}
            >
              <p className="text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground/40 mb-1">
                {locale === "es" ? "¿QUÉ HAGO YO?" : locale === "zh" ? "我该怎么做？" : "WHAT DO I DO?"}
              </p>
              <h2 className="text-[20px] font-black text-foreground mb-3">{player.name || "—"}</h2>
              <div className="h-px bg-border/40 mb-4" />

              <div className="space-y-3">
                {/* DENY */}
                {finalReport.defense.deny && (
                  <div className={cn("rounded-2xl border border-border/30 overflow-hidden", DENY_CLASSES.bg)}>
                    <div className="border-l-[4px] border-red-500 px-4 pt-4 pb-3">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        {(() => { const Icon = DEFENSE_ICONS["deny"]; return Icon ? <Icon className="w-3.5 h-3.5 text-red-500" /> : null; })()}
                        <p className={cn("text-[10px] font-black uppercase tracking-[0.25em]", DENY_CLASSES.text)}>
                          {finalReport.defense.deny.label}
                        </p>
                      </div>
                      <p className="text-[18px] font-black text-foreground leading-tight mb-3">
                        {finalReport.defense.deny.instruction}
                      </p>
                      {(finalReport.defense.deny as any).when && (
                        <div className="space-y-1 mb-3">
                          <div className="flex gap-2">
                            <span className="text-[11px] font-black text-muted-foreground/50 w-10 shrink-0">When:</span>
                            <span className="text-[11px] text-foreground/75 leading-snug">{(finalReport.defense.deny as any).when}</span>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-[11px] font-black text-muted-foreground/50 w-10 shrink-0">How:</span>
                            <span className="text-[11px] text-foreground/75 leading-snug">{(finalReport.defense.deny as any).how}</span>
                          </div>
                          {(finalReport.defense.deny as any).why && (
                            <div className="flex gap-2">
                              <span className="text-[11px] font-black text-muted-foreground/50 w-10 shrink-0">Why:</span>
                              <span className="text-[11px] text-foreground/75 leading-snug">{(finalReport.defense.deny as any).why}</span>
                            </div>
                          )}
                        </div>
                      )}
                      {coachMode && finalReport.defense.deny.alternatives?.length > 0 && (
                        <button
                          type="button"
                          className={cn("text-[11px] font-bold float-right", DENY_CLASSES.text)}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={() => openDefenseSheet("deny", finalReport.defense.deny.instruction, finalReport.defense.deny.alternatives)}
                        >
                          {finalReport.defense.deny.alternatives.length} alternatives ›
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* FORCE */}
                {finalReport.defense.force && (
                  <div className={cn("rounded-2xl border border-border/30 overflow-hidden", FORCE_CLASSES.bg)}>
                    <div className="border-l-[4px] border-amber-500 px-4 pt-4 pb-3">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        {(() => { const Icon = DEFENSE_ICONS["force"]; return Icon ? <Icon className="w-3.5 h-3.5 text-amber-500" /> : null; })()}
                        <p className={cn("text-[10px] font-black uppercase tracking-[0.25em]", FORCE_CLASSES.text)}>
                          {finalReport.defense.force.label}
                        </p>
                      </div>
                      <p className="text-[18px] font-black text-foreground leading-tight mb-3">
                        {finalReport.defense.force.instruction}
                      </p>
                      {(finalReport.defense.force as any).when && (
                        <div className="space-y-1 mb-3">
                          <div className="flex gap-2">
                            <span className="text-[11px] font-black text-muted-foreground/50 w-10 shrink-0">When:</span>
                            <span className="text-[11px] text-foreground/75 leading-snug">{(finalReport.defense.force as any).when}</span>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-[11px] font-black text-muted-foreground/50 w-10 shrink-0">How:</span>
                            <span className="text-[11px] text-foreground/75 leading-snug">{(finalReport.defense.force as any).how}</span>
                          </div>
                        </div>
                      )}
                      {coachMode && finalReport.defense.force.alternatives?.length > 0 && (
                        <button
                          type="button"
                          className={cn("text-[11px] font-bold float-right", FORCE_CLASSES.text)}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={() => openDefenseSheet("force", finalReport.defense.force.instruction, finalReport.defense.force.alternatives)}
                        >
                          {finalReport.defense.force.alternatives.length} alternatives ›
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* ALLOW */}
                {motorOutput.defense.allow.winner.key !== "none" && (
                  <div className={cn("rounded-2xl border border-border/30 overflow-hidden", ALLOW_CLASSES.bg)}>
                    <div className="border-l-[4px] border-emerald-500 px-4 pt-4 pb-3">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        {(() => { const Icon = DEFENSE_ICONS["allow"]; return Icon ? <Icon className="w-3.5 h-3.5 text-emerald-500" /> : null; })()}
                        <p className={cn("text-[10px] font-black uppercase tracking-[0.25em]", ALLOW_CLASSES.text)}>
                          {finalReport.defense.allow.label}
                        </p>
                      </div>
                      <p className="text-[18px] font-black text-foreground leading-tight mb-2">
                        {finalReport.defense.allow.instruction}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* ALSO WATCH / AWARE */}
              {topAlerts.length > 0 && (
                <div className="mt-5">
                  <p className="text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground/40 mb-3">
                    ALSO WATCH
                  </p>
                  <div className="space-y-2">
                    {topAlerts.map((alert, idx) => (
                      <div
                        key={idx}
                        className={cn("rounded-xl border border-border/40 border-l-[3px] px-4 py-3", AWARE_CLASSES.border, AWARE_CLASSES.bg)}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          {(() => { const Icon = AWARE_ICONS[(alert as any).key]; return Icon ? <Icon className="w-3.5 h-3.5 shrink-0 text-amber-500" /> : null; })()}
                          <p className={cn("text-[12px] font-black", AWARE_CLASSES.text)}>
                            {alert.text.split(" — ")[0] ?? alert.text}
                          </p>
                        </div>
                        <p className="text-[11px] text-muted-foreground/70 leading-snug">
                          {alert.triggerCue ?? alert.text.split(" — ")[1] ?? ""}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── FLECHAS ─────────────────────────────── */}
          <button
            type="button"
            onClick={() => goTo(slide - 1)}
            aria-label="Slide anterior"
            className={cn(
              "absolute left-1 top-1/2 z-10 -translate-y-1/2 flex items-center justify-center p-3 transition-opacity duration-500",
              hasPrev && arrowsVisible
                ? "opacity-35 hover:opacity-70 pointer-events-auto"
                : "opacity-0 pointer-events-none",
            )}
          >
            <ChevronLeft className="h-7 w-7 text-foreground drop-shadow" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={() => goTo(slide + 1)}
            aria-label="Slide siguiente"
            className={cn(
              "absolute right-1 top-1/2 z-10 -translate-y-1/2 flex items-center justify-center p-3 transition-opacity duration-500",
              hasNext && arrowsVisible
                ? "opacity-35 hover:opacity-70 pointer-events-auto"
                : "opacity-0 pointer-events-none",
            )}
          >
            <ChevronRight className="h-7 w-7 text-foreground drop-shadow" strokeWidth={1.5} />
          </button>
        </div>

        {/* ── BOTTOM BAR ───────────────────────────── */}
        {bottomBar && (
          <div className="sticky bottom-0 z-10 border-t border-border bg-background/95 backdrop-blur-sm">
            {bottomBar}
          </div>
        )}
      </div>

      {/* ── RUNNERS-UP SHEET ─────────────────────── */}
      <Sheet open={activeSheet !== null} onOpenChange={(open) => !open && setActiveSheet(null)}>
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] overflow-y-auto rounded-t-2xl px-4 pb-[calc(2rem+env(safe-area-inset-bottom))]"
        >
          <div className="mx-auto mb-4 mt-1 h-1 w-10 rounded-full bg-muted" />
          <SheetHeader className="pb-3 text-left">
            <SheetTitle className="text-sm font-black uppercase tracking-[0.15em] text-muted-foreground">
              {activeSheet?.title}
            </SheetTitle>
          </SheetHeader>

          <div className="mb-4 rounded-xl border border-border bg-muted/40 px-4 py-3">
            <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">
              {locale === "es" ? "Actual" : locale === "zh" ? "当前" : "Current"}
            </p>
            <p className="text-sm font-semibold text-foreground/80">
              {activeSheet?.current}
            </p>
          </div>

          {activeSheet && activeSheet.alternatives.length > 0 ? (
            <div className="space-y-2">
              <p className="mb-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">
                {locale === "es" ? "Alternativas del motor" : locale === "zh" ? "引擎备选" : "Engine alternatives"}
              </p>
              {activeSheet.alternatives.map((alt, idx) => (
                <div key={idx} className="rounded-xl border border-border/60 bg-card px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="flex-1 text-sm leading-snug text-foreground/85">{alt.text}</p>
                    <span className="shrink-0 text-xs font-black tabular-nums text-muted-foreground/50">
                      {Math.round(alt.score * 100)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground/50">
              {locale === "es" ? "Sin alternativas disponibles"
                : locale === "zh" ? "暂无备选"
                : "No alternatives available"}
            </p>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function situationColors(id: string): { border: string; text: string; bg: string } {
  if (id.startsWith("iso"))  return { border: "border-l-orange-500", text: "text-orange-500 dark:text-orange-400", bg: "bg-orange-500/8" };
  if (id.startsWith("pnr"))  return { border: "border-l-blue-500",   text: "text-blue-500 dark:text-blue-400",    bg: "bg-blue-500/8"   };
  if (id.startsWith("post")) return { border: "border-l-purple-500", text: "text-purple-500 dark:text-purple-400",bg: "bg-purple-500/8" };
  if (id === "catch_shoot")  return { border: "border-l-teal-500",   text: "text-teal-600 dark:text-teal-400",   bg: "bg-teal-500/8"   };
  if (id === "transition")   return { border: "border-l-emerald-500",text: "text-emerald-600 dark:text-emerald-400",bg:"bg-emerald-500/8"};
  if (id === "off_ball")     return { border: "border-l-violet-500", text: "text-violet-500 dark:text-violet-400",bg: "bg-violet-500/8" };
  if (id === "floater")      return { border: "border-l-cyan-500",   text: "text-cyan-600 dark:text-cyan-400",   bg: "bg-cyan-500/8"   };
  if (id === "oreb")         return { border: "border-l-rose-500",   text: "text-rose-500 dark:text-rose-400",   bg: "bg-rose-500/8"   };
  return { border: "border-l-muted-foreground/30", text: "text-muted-foreground", bg: "" };
}
