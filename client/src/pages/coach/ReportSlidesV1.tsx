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
}

const TOTAL_SLIDES = 3;
const SWIPE_THRESHOLD = 50;
const DRAG_THRESHOLD = 40;

export default function ReportSlidesV1({
  playerId,
  onBack,
  coachMode = false,
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
  const [hovering, setHovering] = useState(false);

  const touchStartX = useRef<number | null>(null);
  const dragStartX = useRef<number | null>(null);
  const isDragging = useRef(false);

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
        {locale === "es"
          ? "No se pudo generar el informe."
          : locale === "zh"
            ? "无法生成报告。"
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

  return (
    <div
      className="relative flex min-h-[100dvh] flex-col bg-background select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
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
        {/* Track */}
        <div
          className="flex h-full transition-transform duration-300 ease-out"
          style={{
            width: `${TOTAL_SLIDES * 100}%`,
            transform: `translateX(-${(slide * 100) / TOTAL_SLIDES}%)`,
          }}
        >
          {/* ── SLIDE 1 — Quién es ───────────────────── */}
          <div
            className="flex flex-col items-center overflow-y-auto px-6 pb-20 pt-8"
            style={{ width: `${100 / TOTAL_SLIDES}%` }}
          >
            <SlideLabel label={t("slides_who_is")} />

            <div className="relative mb-5 mt-4 h-24 w-24">
              {photo ? (
                <>
                  <div className="absolute inset-0 scale-110 rounded-full bg-primary/25 blur-xl" aria-hidden />
                  <img
                    src={player.imageUrl!}
                    alt={player.name ?? ""}
                    className="relative h-24 w-24 rounded-full border-2 border-primary/20 object-cover shadow-lg ring-4 ring-primary/10"
                  />
                </>
              ) : (
                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-border bg-muted shadow-md">
                  <BasketballPlaceholderAvatar size={96} />
                </div>
              )}
            </div>

            <h1 className="mb-3 text-center text-xl font-black tracking-tight text-foreground">
              {player.name?.trim() || t("dashboard_unnamed_player")}
            </h1>

            <div className="mb-3 w-full rounded-2xl border border-primary/20 bg-primary/8 px-5 py-3 text-center">
              <p className="mb-0.5 text-[9px] font-black uppercase tracking-[0.18em] text-primary/70">
                {t("archetype")}
              </p>
              <p className="text-lg font-black italic leading-tight text-foreground">
                {report.identity.archetypeLabel}
              </p>
              {subAlt && (
                <p className="mt-1.5 text-[9px] font-bold uppercase tracking-widest text-primary/50">
                  {t("subarchetype")} {subAlt.label}
                </p>
              )}
            </div>

            <p className="mt-1 text-center text-xs italic leading-relaxed text-muted-foreground/80">
              {report.identity.tagline}
            </p>

            <div className="mt-4">
              <ThreatDots level={report.identity.dangerLevel ?? 1} />
            </div>
          </div>

          {/* ── SLIDE 2 — Qué hará ───────────────────── */}
          <div
            className="flex flex-col overflow-y-auto px-4 pb-20 pt-8"
            style={{ width: `${100 / TOTAL_SLIDES}%` }}
          >
            <SlideLabel label={t("slides_what_will_do")} />

            <div className="mt-3 space-y-2.5">
              {topSituations.map((sit) => {
                const colors = situationColors(sit.id);
                return (
                  <div
                    key={sit.id}
                    className={cn(
                      "rounded-2xl border border-border/60 bg-card px-4 py-3.5 shadow-sm border-l-[3px]",
                      colors.border,
                    )}
                  >
                    <div className="mb-1.5 flex items-center gap-2">
                      {coachMode && (
                        <button
                          type="button"
                          className="shrink-0 rounded p-0.5 text-muted-foreground/50 hover:text-muted-foreground"
                          onClick={() => { /* runners-up — próximo sprint */ }}
                        >
                          <MoreVertical className="h-3 w-3" />
                        </button>
                      )}
                      <TierBadge tier={sit.tier} />
                      <span className={cn("text-[9px] font-black uppercase tracking-[0.15em]", colors.text)}>
                        {sit.label}
                      </span>
                      <span className={cn("ml-auto text-xs font-black tabular-nums", colors.text)}>
                        {Math.round(sit.score * 100)}
                      </span>
                    </div>
                    <p className="text-sm leading-snug text-foreground/90">
                      {sit.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── SLIDE 3 — Qué hago yo ────────────────── */}
          <div
            className="flex flex-col overflow-y-auto px-4 pb-20 pt-8"
            style={{ width: `${100 / TOTAL_SLIDES}%` }}
          >
            <SlideLabel label={t("slides_what_do_i")} />

            <div className="mt-3 space-y-2.5">
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

            {topAlerts.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-[9px] font-black uppercase tracking-[0.15em] text-amber-600/80 dark:text-amber-400/80">
                  {t("report_aware")}
                </p>
                {topAlerts.map((alert, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 border-l-[3px] border-l-amber-500/60"
                  >
                    <p className="text-sm font-bold text-foreground/90">{alert.text}</p>
                    {alert.triggerCue && (
                      <p className="mt-0.5 text-xs italic text-amber-600/70 dark:text-amber-400/70">
                        {alert.triggerCue}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── FLECHAS — desktop, zona inferior, sin fondo ── */}
        {/* Aparecen al hover, posicionadas en la franja baja donde no hay texto denso */}
        <button
          type="button"
          onClick={() => goTo(slide - 1)}
          aria-label="Slide anterior"
          className={cn(
            "absolute bottom-6 left-4 z-10 hidden md:flex items-center justify-center",
            "transition-all duration-300",
            hasPrev && hovering
              ? "opacity-40 hover:opacity-80 pointer-events-auto"
              : "opacity-0 pointer-events-none",
          )}
        >
          <ChevronLeft
            className="h-8 w-8 text-foreground drop-shadow-sm"
            strokeWidth={1.5}
          />
        </button>

        <button
          type="button"
          onClick={() => goTo(slide + 1)}
          aria-label="Slide siguiente"
          className={cn(
            "absolute bottom-6 right-4 z-10 hidden md:flex items-center justify-center",
            "transition-all duration-300",
            hasNext && hovering
              ? "opacity-40 hover:opacity-80 pointer-events-auto"
              : "opacity-0 pointer-events-none",
          )}
        >
          <ChevronRight
            className="h-8 w-8 text-foreground drop-shadow-sm"
            strokeWidth={1.5}
          />
        </button>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────

function SlideLabel({ label }: { label: string }) {
  return (
    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground/60">
      {label}
    </p>
  );
}

function ThreatDots({ level }: { level: number }) {
  const safe = Math.min(Math.max(level, 1), 5);
  const labels = ["", "Low threat", "Moderate", "Dangerous", "High danger", "Elite threat"];
  const dotColors = ["", "bg-muted-foreground/30", "bg-yellow-500/70", "bg-orange-500/80", "bg-red-500/80", "bg-red-600"];
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex gap-1.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-2.5 w-2.5 rounded-full",
              i < safe ? dotColors[safe] : "bg-muted/40",
            )}
          />
        ))}
      </div>
      <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">
        {labels[safe]}
      </span>
    </div>
  );
}

const DEFENSE_CONFIG = {
  deny: {
    border: "border-l-red-500/70",
    text: "text-red-500",
    bg: "bg-red-500/5",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="9" />
        <line x1="5" y1="5" x2="19" y2="19" />
      </svg>
    ),
  },
  force: {
    border: "border-l-blue-500/70",
    text: "text-blue-500",
    bg: "bg-blue-500/5",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    ),
  },
  allow: {
    border: "border-l-emerald-500/70",
    text: "text-emerald-600",
    bg: "bg-emerald-500/5",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2}>
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
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl border border-border/60 px-4 py-3.5 shadow-sm border-l-[3px]",
        cfg.border,
        cfg.bg,
      )}
    >
      <div className={cn("mt-0.5 shrink-0 opacity-80", cfg.text)}>{cfg.icon}</div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className={cn("text-[9px] font-black uppercase tracking-[0.15em]", cfg.text)}>
            {label}
          </p>
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
        <p className="text-sm leading-snug text-foreground/90">{instruction}</p>
      </div>
    </div>
  );
}

function situationColors(id: string): { border: string; text: string } {
  if (id.startsWith("iso")) return { border: "border-l-orange-500/70", text: "text-orange-500 dark:text-orange-400" };
  if (id.startsWith("pnr")) return { border: "border-l-blue-500/70", text: "text-blue-500 dark:text-blue-400" };
  if (id.startsWith("post")) return { border: "border-l-purple-500/70", text: "text-purple-500 dark:text-purple-400" };
  if (id === "catch_shoot") return { border: "border-l-teal-500/70", text: "text-teal-600 dark:text-teal-400" };
  if (id === "transition") return { border: "border-l-emerald-500/70", text: "text-emerald-600 dark:text-emerald-400" };
  if (id === "off_ball") return { border: "border-l-violet-500/70", text: "text-violet-500 dark:text-violet-400" };
  if (id === "floater") return { border: "border-l-cyan-500/70", text: "text-cyan-600 dark:text-cyan-400" };
  if (id === "oreb") return { border: "border-l-rose-500/70", text: "text-rose-500 dark:text-rose-400" };
  return { border: "border-l-muted-foreground/40", text: "text-muted-foreground" };
}

function TierBadge({ tier }: { tier: "primary" | "secondary" | "situational" }) {
  const styles = {
    primary: "bg-red-500/10 text-red-500 dark:text-red-400",
    secondary: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-300",
    situational: "bg-muted/60 text-muted-foreground",
  };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-widest", styles[tier])}>
      {tier}
    </span>
  );
}
