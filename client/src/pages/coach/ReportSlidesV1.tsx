import { useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, MoreVertical } from "lucide-react";
import { generateMotorV4 } from "@/lib/motor-v4";
import { renderReport, type RenderContext } from "@/lib/reportTextRenderer";
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

export interface ReportSlidesV1Props {
  playerId: string;
  onBack?: () => void;
  coachMode?: boolean;
  bottomBar?: React.ReactNode;
}

const TOTAL_SLIDES = 3;
const SWIPE_THRESHOLD = 50;
const DRAG_THRESHOLD = 40;
const ARROW_HIDE_DELAY = 1800;

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

  // Posición: tomar la primera de las / separadas
  const position = (player.inputs?.position ?? "").split("/")[0]?.trim() ?? "";
  const jerseyNumber = player.number?.trim() ?? "";

  return (
    <div
      className="flex min-h-[100dvh] flex-col bg-background select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── HEADER ───────────────────────────────────── */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm">
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

        <div className="flex flex-1 items-center justify-center gap-2">
          {Array.from({ length: TOTAL_SLIDES }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              className={cn(
                "rounded-full transition-all duration-200",
                i === slide
                  ? "h-2.5 w-7 bg-primary"
                  : "h-2.5 w-2.5 bg-muted-foreground/30 hover:bg-muted-foreground/60",
              )}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>

        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-base">
          {clubEmoji}
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

          {/* ════════════════════════════════════════════
              SLIDE 1 — Quién es
          ════════════════════════════════════════════ */}
          <div
            className="flex flex-col items-center overflow-y-auto px-6 pb-10 pt-6"
            style={{ width: `${100 / TOTAL_SLIDES}%` }}
          >
            <SlideLabel label={t("slides_who_is")} />

            {/* Avatar + número de dorsal superpuesto */}
            <div className="relative mb-4 mt-5">
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
                {/* Dorsal — badge superpuesto abajo-derecha */}
                {jerseyNumber && (
                  <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-primary shadow-md">
                    <span className="text-[11px] font-black leading-none text-primary-foreground">
                      {jerseyNumber}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Nombre + posición */}
            <div className="mb-4 flex flex-col items-center gap-0.5">
              <h1 className="text-center text-2xl font-black tracking-tight text-foreground">
                {player.name?.trim() || t("dashboard_unnamed_player")}
              </h1>
              {position && (
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70">
                  {position}
                </span>
              )}
            </div>

            {/* Archetype — bloque central */}
            <div className="mb-3 w-full rounded-2xl border border-primary/15 bg-primary/6 px-5 py-3.5 text-center">
              <p className="mb-1 text-[8px] font-black uppercase tracking-[0.2em] text-primary/60">
                {t("archetype")}
              </p>
              <p className="text-xl font-black italic leading-tight text-foreground">
                {report.identity.archetypeLabel}
              </p>
              {subAlt && (
                <p className="mt-1.5 text-[8px] font-bold uppercase tracking-[0.15em] text-primary/50">
                  {t("subarchetype")} {subAlt.label}
                </p>
              )}
            </div>

            {/* Tagline */}
            <p className="mb-4 text-center text-xs italic leading-relaxed text-muted-foreground/70">
              {report.identity.tagline}
            </p>

            {/* Nivel de amenaza — más prominente */}
            <ThreatLevel level={report.identity.dangerLevel ?? 1} />
          </div>

          {/* ════════════════════════════════════════════
              SLIDE 2 — Qué hará
          ════════════════════════════════════════════ */}
          <div
            className="flex flex-col overflow-y-auto px-4 pb-10 pt-6"
            style={{ width: `${100 / TOTAL_SLIDES}%` }}
          >
            <SlideLabel label={t("slides_what_will_do")} />

            <div className="mt-4 space-y-3">
              {topSituations.map((sit, idx) => {
                const colors = situationColors(sit.id);
                return (
                  <SituationCard
                    key={sit.id}
                    sit={sit}
                    colors={colors}
                    coachMode={coachMode}
                    rank={idx + 1}
                  />
                );
              })}
            </div>
          </div>

          {/* ════════════════════════════════════════════
              SLIDE 3 — Qué hago yo
          ════════════════════════════════════════════ */}
          <div
            className="flex flex-col overflow-y-auto px-4 pb-10 pt-6"
            style={{ width: `${100 / TOTAL_SLIDES}%` }}
          >
            <SlideLabel label={t("slides_what_do_i")} />

            {/* DENY / FORCE / ALLOW */}
            <div className="mt-4 space-y-3">
              {(["deny", "force", "allow"] as const).map((type) => {
                const instr = report.defense[type];
                if (!instr) return null;
                return (
                  <DefenseCard
                    key={type}
                    type={type}
                    label={instr.label}
                    instruction={instr.instruction}
                    coachMode={coachMode}
                  />
                );
              })}
            </div>

            {/* AWARE — zona separada, menos peso visual */}
            {topAlerts.length > 0 && (
              <div className="mt-5">
                <div className="mb-2 flex items-center gap-2">
                  <div className="h-px flex-1 bg-border/50" />
                  <p className="text-[8px] font-black uppercase tracking-[0.2em] text-amber-600/70 dark:text-amber-400/70">
                    {t("report_aware")}
                  </p>
                  <div className="h-px flex-1 bg-border/50" />
                </div>
                <div className="space-y-2">
                  {topAlerts.map((alert, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3.5 py-2.5"
                    >
                      <p className="text-xs font-bold leading-snug text-foreground/80">{alert.text}</p>
                      {alert.triggerCue && (
                        <p className="mt-0.5 text-[10px] italic text-amber-600/60 dark:text-amber-400/60">
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

        {/* ── FLECHAS ───────────────────────────────────── */}
        <button
          type="button"
          onClick={() => goTo(slide - 1)}
          aria-label="Slide anterior"
          className={cn(
            "absolute left-1 top-1/2 z-10 -translate-y-1/2 flex items-center justify-center p-2",
            "transition-opacity duration-500",
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
            "absolute right-1 top-1/2 z-10 -translate-y-1/2 flex items-center justify-center p-2",
            "transition-opacity duration-500",
            hasNext && arrowsVisible
              ? "opacity-35 hover:opacity-70 pointer-events-auto"
              : "opacity-0 pointer-events-none",
          )}
        >
          <ChevronRight className="h-7 w-7 text-foreground drop-shadow" strokeWidth={1.5} />
        </button>
      </div>

      {/* ── BOTTOM BAR ───────────────────────────────── */}
      {bottomBar && (
        <div className="sticky bottom-0 z-10 border-t border-border bg-background/95 backdrop-blur-sm">
          {bottomBar}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────

function SlideLabel({ label }: { label: string }) {
  return (
    <p className="w-full text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">
      {label}
    </p>
  );
}

/** Nivel de amenaza — 5 segmentos de barra + label */
function ThreatLevel({ level }: { level: number }) {
  const safe = Math.min(Math.max(level, 1), 5);
  const configs = [
    {},
    { label: "Low threat", color: "bg-slate-400/50", text: "text-slate-500 dark:text-slate-400" },
    { label: "Moderate",   color: "bg-yellow-500/70", text: "text-yellow-600 dark:text-yellow-400" },
    { label: "Dangerous",  color: "bg-orange-500/80", text: "text-orange-600 dark:text-orange-400" },
    { label: "High danger", color: "bg-red-500",       text: "text-red-600 dark:text-red-400" },
    { label: "Elite threat", color: "bg-red-600",      text: "text-red-700 dark:text-red-300" },
  ];
  const cfg = configs[safe]!;
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="flex w-full max-w-[160px] gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-all",
              i < safe ? cfg.color : "bg-muted/40",
            )}
          />
        ))}
      </div>
      <span className={cn("text-[10px] font-black uppercase tracking-widest", cfg.text)}>
        {cfg.label}
      </span>
    </div>
  );
}

/** Tarjeta de situación ofensiva */
function SituationCard({
  sit,
  colors,
  coachMode,
  rank,
}: {
  sit: { id: string; label: string; score: number; tier: "primary" | "secondary" | "situational"; description: string };
  colors: { border: string; text: string; bg: string };
  coachMode: boolean;
  rank: number;
}) {
  return (
    <div className={cn("rounded-2xl border border-border/50 px-4 py-3.5 border-l-[3px]", colors.border, colors.bg)}>
      {/* Header: tipo de situación (más prominente) + score solo en coachMode */}
      <div className="mb-2 flex items-center gap-2">
        {coachMode && (
          <button
            type="button"
            className="shrink-0 rounded p-0.5 text-muted-foreground/40 hover:text-muted-foreground"
            onClick={() => { /* runners-up — próximo sprint */ }}
          >
            <MoreVertical className="h-3 w-3" />
          </button>
        )}
        {/* Número de ranking — referencia rápida */}
        <span className={cn("text-xs font-black tabular-nums opacity-30", colors.text)}>
          #{rank}
        </span>
        <span className={cn("flex-1 text-[10px] font-black uppercase tracking-[0.15em]", colors.text)}>
          {sit.label}
        </span>
        {coachMode && (
          <span className={cn("text-xs font-black tabular-nums opacity-60", colors.text)}>
            {Math.round(sit.score * 100)}
          </span>
        )}
      </div>
      {/* Descripción — texto principal */}
      <p className="text-sm leading-snug text-foreground/85">
        {sit.description}
      </p>
    </div>
  );
}

/** Tarjeta DENY / FORCE / ALLOW */
const DEFENSE_CONFIG = {
  deny: {
    border: "border-l-red-500/60",
    bg: "bg-red-500/4",
    text: "text-red-500 dark:text-red-400",
    label_bg: "bg-red-500/8",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="9" /><line x1="5" y1="5" x2="19" y2="19" />
      </svg>
    ),
  },
  force: {
    border: "border-l-blue-500/60",
    bg: "bg-blue-500/4",
    text: "text-blue-500 dark:text-blue-400",
    label_bg: "bg-blue-500/8",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    ),
  },
  allow: {
    border: "border-l-emerald-500/60",
    bg: "bg-emerald-500/4",
    text: "text-emerald-600 dark:text-emerald-400",
    label_bg: "bg-emerald-500/8",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  },
};

function DefenseCard({
  type,
  label,
  instruction,
  coachMode = false,
}: {
  type: "deny" | "force" | "allow";
  label: string;
  instruction: string;
  coachMode?: boolean;
}) {
  const cfg = DEFENSE_CONFIG[type];
  return (
    <div className={cn("rounded-2xl border border-border/50 px-4 py-4 border-l-[3px]", cfg.border, cfg.bg)}>
      {/* Label row */}
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={cn("opacity-70", cfg.text)}>{cfg.icon}</span>
          <span className={cn("text-[9px] font-black uppercase tracking-[0.2em]", cfg.text)}>
            {label}
          </span>
        </div>
        {coachMode && (
          <button
            type="button"
            className="shrink-0 rounded p-0.5 text-muted-foreground/40 hover:text-muted-foreground"
            onClick={() => { /* runners-up — próximo sprint */ }}
          >
            <MoreVertical className="h-3 w-3" />
          </button>
        )}
      </div>
      {/* Instrucción — texto principal, más grande */}
      <p className="text-[15px] font-semibold leading-snug text-foreground/90">
        {instruction}
      </p>
    </div>
  );
}

function situationColors(id: string): { border: string; text: string; bg: string } {
  if (id.startsWith("iso"))   return { border: "border-l-orange-500/60", text: "text-orange-500 dark:text-orange-400", bg: "bg-orange-500/4" };
  if (id.startsWith("pnr"))   return { border: "border-l-blue-500/60",   text: "text-blue-500 dark:text-blue-400",   bg: "bg-blue-500/4" };
  if (id.startsWith("post"))  return { border: "border-l-purple-500/60", text: "text-purple-500 dark:text-purple-400", bg: "bg-purple-500/4" };
  if (id === "catch_shoot")   return { border: "border-l-teal-500/60",   text: "text-teal-600 dark:text-teal-400",   bg: "bg-teal-500/4" };
  if (id === "transition")    return { border: "border-l-emerald-500/60",text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/4" };
  if (id === "off_ball")      return { border: "border-l-violet-500/60", text: "text-violet-500 dark:text-violet-400", bg: "bg-violet-500/4" };
  if (id === "floater")       return { border: "border-l-cyan-500/60",   text: "text-cyan-600 dark:text-cyan-400",   bg: "bg-cyan-500/4" };
  if (id === "oreb")          return { border: "border-l-rose-500/60",   text: "text-rose-500 dark:text-rose-400",   bg: "bg-rose-500/4" };
  return { border: "border-l-muted-foreground/30", text: "text-muted-foreground", bg: "" };
}
