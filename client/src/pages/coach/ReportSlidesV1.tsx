import { useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, MoreVertical } from "lucide-react";
import { generateMotorV4 } from "@/lib/motor-v4";
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
import { BasketballPlaceholderAvatar } from "@/components/BasketballPlaceholderAvatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export interface ReportSlidesV1Props {
  playerId: string;
  onBack?: () => void;
  coachMode?: boolean;
  bottomBar?: React.ReactNode;
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

  const touchStartX = useRef<number | null>(null);
  const dragStartX = useRef<number | null>(null);
  const isDragging = useRef(false);
  const arrowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    if (!report) return;
    setActiveSheet({
      title:
        locale === "es" ? "Alternativas de arquetipo"
        : locale === "zh" ? "原型备选"
        : "Archetype alternatives",
      current,
      alternatives: report.identity.archetypeAlternatives.map((a) => ({
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
  if (!report || !motorOutput) {
    return (
      <div className="p-4 text-muted-foreground">
        {locale === "es" ? "No se pudo generar el informe."
          : locale === "zh" ? "无法生成报告。"
          : "Could not generate report."}
      </div>
    );
  }

  const photo = isRealPhoto(player.imageUrl);
  const subAlt = report.identity.archetypeAlternatives[0];
  const topSituations = report.situations.slice(0, 3);
  const topAlerts = report.alerts.slice(0, 2);
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
          <div
            className="flex h-full transition-transform duration-300 ease-out"
            style={{
              width: `${TOTAL_SLIDES * 100}%`,
              transform: `translateX(-${(slide * 100) / TOTAL_SLIDES}%)`,
            }}
          >
            {/* ════════════════════════════════
                SLIDE 1 — Quién es
            ════════════════════════════════ */}
            <div
              className="flex flex-col items-center overflow-y-auto px-5 pb-10 pt-5"
              style={{ width: `${100 / TOTAL_SLIDES}%` }}
            >
              {/* Avatar */}
              <div className="relative mb-5 mt-3">
                <div className="relative h-28 w-28">
                  {photo ? (
                    <>
                      <div className="absolute inset-0 scale-110 rounded-full bg-primary/20 blur-2xl" aria-hidden />
                      <img
                        src={player.imageUrl!}
                        alt={player.name ?? ""}
                        className="relative h-28 w-28 rounded-full border-2 border-primary/20 object-cover shadow-lg ring-4 ring-primary/10"
                      />
                    </>
                  ) : (
                    <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-2 border-border bg-muted shadow-md">
                      <BasketballPlaceholderAvatar size={112} />
                    </div>
                  )}
                  {jerseyNumber && (
                    <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-primary shadow-md">
                      <span className="text-[11px] font-black leading-none text-primary-foreground">
                        {jerseyNumber}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Name + position */}
              <h1 className="text-center text-2xl font-black tracking-tight text-foreground">
                {player.name?.trim() || t("dashboard_unnamed_player")}
              </h1>
              {position && (
                <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
                  {position}
                </span>
              )}

              {/* Archetype card */}
              <div className="relative mt-5 w-full rounded-2xl border border-primary/20 bg-primary/6 px-5 py-4 text-center">
                {coachMode && (
                  <button
                    type="button"
                    className="absolute right-2 top-2 rounded p-2 text-muted-foreground/40 hover:text-muted-foreground"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => openArchetypeSheet(report.identity.archetypeLabel)}
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                  </button>
                )}
                <p className="mb-1 text-[8px] font-black uppercase tracking-[0.25em] text-primary/50">
                  {t("archetype")}
                </p>
                <p className="text-2xl font-black italic leading-tight text-foreground">
                  {report.identity.archetypeLabel}
                </p>
                {subAlt && (
                  <p className="mt-2 text-[8px] font-bold uppercase tracking-[0.15em] text-primary/40">
                    {t("subarchetype")} {subAlt.label}
                  </p>
                )}
              </div>

              {/* Tagline */}
              <p className="mt-3 text-center text-xs italic leading-relaxed text-muted-foreground/60">
                {report.identity.tagline}
              </p>

              {/* Threat level */}
              <div className="mt-5 w-full">
                <ThreatLevel level={report.identity.dangerLevel ?? 1} />
              </div>
            </div>

            {/* ════════════════════════════════
                SLIDE 2 — Qué hará
            ════════════════════════════════ */}
            <div
              className="flex flex-col overflow-y-auto px-4 pb-10 pt-5"
              style={{ width: `${100 / TOTAL_SLIDES}%` }}
            >
              <div className="space-y-3">
                {topSituations.map((sit, idx) => {
                  const colors = situationColors(sit.id);
                  return (
                    <SituationCard
                      key={sit.id}
                      sit={sit}
                      colors={colors}
                      coachMode={coachMode}
                      rank={idx + 1}
                      onKebab={() => openSituationSheet(sit.id, sit.description)}
                    />
                  );
                })}
              </div>
            </div>

            {/* ════════════════════════════════
                SLIDE 3 — Qué hago yo
            ════════════════════════════════ */}
            <div
              className="flex flex-col overflow-y-auto px-4 pb-10 pt-5"
              style={{ width: `${100 / TOTAL_SLIDES}%` }}
            >
              <div className="space-y-3">
                {(["deny", "force"] as const).map((type) => {
                  const instr = report.defense[type];
                  if (!instr) return null;
                  return (
                    <DefenseCard
                      key={type}
                      type={type}
                      label={instr.label}
                      instruction={instr.instruction}
                      coachMode={coachMode}
                      onKebab={() =>
                        openDefenseSheet(type, instr.instruction, instr.alternatives)
                      }
                    />
                  );
                })}
                {motorOutput.defense.allow.winner.key !== "none" && (
                  <DefenseCard
                    type="allow"
                    label={report.defense.allow.label}
                    instruction={report.defense.allow.instruction}
                    coachMode={coachMode}
                    onKebab={() =>
                      openDefenseSheet("allow", report.defense.allow.instruction, report.defense.allow.alternatives)
                    }
                  />
                )}
              </div>

              {/* AWARE */}
              {topAlerts.length > 0 && (
                <div className="mt-5">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="h-px flex-1 bg-border/40" />
                    <p className="text-[8px] font-black uppercase tracking-[0.25em] text-violet-500/70 dark:text-violet-400/70">
                      {t("report_aware")}
                    </p>
                    <div className="h-px flex-1 bg-border/40" />
                  </div>
                  <div className="space-y-2.5">
                    {topAlerts.map((alert, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "rounded-2xl border border-border/50 border-l-[4px] px-4 py-3.5",
                          AWARE_CLASSES.border,
                          AWARE_CLASSES.bg,
                        )}
                      >
                        <div className="mb-1 flex items-center gap-2">
                          <span className={cn("text-[9px] font-black uppercase tracking-[0.2em]", AWARE_CLASSES.text)}>
                            {t("report_aware")}
                          </span>
                        </div>
                        <p className="text-[15px] font-semibold leading-snug text-foreground/90">
                          {alert.text}
                        </p>
                        {alert.triggerCue && (
                          <p className="mt-1.5 text-[11px] italic text-muted-foreground/55">
                            {alert.triggerCue}
                          </p>
                        )}
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
              "absolute left-1 top-1/2 z-10 -translate-y-1/2 flex items-center justify-center p-2 transition-opacity duration-500",
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
              "absolute right-1 top-1/2 z-10 -translate-y-1/2 flex items-center justify-center p-2 transition-opacity duration-500",
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

function ThreatLevel({ level }: { level: number }) {
  const safe = Math.min(Math.max(level, 1), 5);
  const configs = [
    { label: "",            barColor: "bg-muted/40",       text: "text-muted-foreground" },
    { label: "Low threat",  barColor: "bg-slate-400/60",  text: "text-slate-500 dark:text-slate-400" },
    { label: "Moderate",    barColor: "bg-yellow-400/80", text: "text-yellow-600 dark:text-yellow-400" },
    { label: "Dangerous",   barColor: "bg-orange-500",    text: "text-orange-500 dark:text-orange-400" },
    { label: "High danger", barColor: "bg-red-500",       text: "text-red-500 dark:text-red-400" },
    { label: "Elite threat",barColor: "bg-red-600",       text: "text-red-600 dark:text-red-300" },
  ];
  const cfg = configs[safe]!;
  return (
    <div className="flex w-full flex-col items-center gap-2.5 rounded-2xl border border-border/40 bg-muted/20 px-5 py-4">
      <p className="text-[8px] font-black uppercase tracking-[0.25em] text-muted-foreground/40">
        Threat level
      </p>
      <div className="flex w-full max-w-[180px] gap-1.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={cn("h-2 flex-1 rounded-full transition-colors", i < safe ? cfg.barColor : "bg-muted/40")}
          />
        ))}
      </div>
      <span className={cn("text-[11px] font-black uppercase tracking-[0.2em]", cfg.text)}>
        {cfg.label}
      </span>
    </div>
  );
}

function SituationCard({
  sit,
  colors,
  coachMode,
  rank,
  onKebab,
}: {
  sit: { id: string; label: string; score: number; tier: "primary" | "secondary" | "situational"; description: string };
  colors: { border: string; text: string; bg: string };
  coachMode: boolean;
  rank: number;
  onKebab: () => void;
}) {
  // Barra de frecuencia visual basada en score
  const barWidth = Math.round(Math.min(sit.score, 1) * 100);
  const tierLabel = sit.tier === "primary" ? "PRIMARY" : sit.tier === "secondary" ? "SECONDARY" : "SITUATIONAL";

  return (
    <div className={cn("rounded-2xl border border-border/50 border-l-[4px] px-4 py-4", colors.border, colors.bg)}>
      {/* Header row */}
      <div className="mb-2 flex items-center gap-2">
        <span className={cn("text-xs font-black tabular-nums opacity-25", colors.text)}>
          #{rank}
        </span>
        <span className={cn("flex-1 text-[10px] font-black uppercase tracking-[0.15em]", colors.text)}>
          {sit.label}
        </span>
        {/* Tier badge */}
        <span className={cn(
          "rounded px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider opacity-70",
          colors.text,
          colors.bg.replace("/8", "/20"),
        )}>
          {tierLabel}
        </span>
        {coachMode && (
          <button
            type="button"
            className="shrink-0 rounded p-2 -m-1 text-muted-foreground/40 hover:text-muted-foreground"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onKebab}
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Description */}
      <p className="text-[15px] leading-snug text-foreground/85">{sit.description}</p>

      {/* Frequency bar */}
      <div className="mt-3 space-y-1">
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted/40">
          <div
            className={cn("h-full rounded-full transition-all", colors.border.replace("border-l-", "bg-").replace("/60", ""))}
            style={{ width: `${barWidth}%` }}
          />
        </div>
        {coachMode && (
          <p className={cn("text-right text-[9px] font-bold tabular-nums opacity-40", colors.text)}>
            {barWidth}
          </p>
        )}
      </div>
    </div>
  );
}

const DEFENSE_ICON = {
  deny: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5}>
      <circle cx="12" cy="12" r="9" /><line x1="5" y1="5" x2="19" y2="19" />
    </svg>
  ),
  force: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
  allow: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
};

const DEFENSE_CLASSES_MAP = {
  deny:  DENY_CLASSES,
  force: FORCE_CLASSES,
  allow: ALLOW_CLASSES,
};

function DefenseCard({
  type,
  label,
  instruction,
  coachMode = false,
  onKebab,
}: {
  type: "deny" | "force" | "allow";
  label: string;
  instruction: string;
  coachMode?: boolean;
  onKebab: () => void;
}) {
  const cls = DEFENSE_CLASSES_MAP[type];
  return (
    <div className={cn(
      "rounded-2xl border border-border/50 border-l-[4px] px-4 py-4",
      cls.border, cls.bg,
    )}>
      {/* Label row */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={cn("opacity-80", cls.text)}>{DEFENSE_ICON[type]}</span>
          <span className={cn("text-[10px] font-black uppercase tracking-[0.25em]", cls.text)}>
            {label}
          </span>
        </div>
        {coachMode && (
          <button
            type="button"
            className="shrink-0 rounded p-2 -m-1 text-muted-foreground/40 hover:text-muted-foreground"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onKebab}
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {/* Instruction */}
      <p className="text-[16px] font-semibold leading-snug text-foreground/90">
        {instruction}
      </p>
    </div>
  );
}

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
