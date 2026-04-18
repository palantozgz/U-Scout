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
  const touchStartX = useRef<number | null>(null);

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

  return (
    <div
      className="relative flex min-h-[100dvh] flex-col bg-background select-none"
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

        {/* Pips — centered, clickable */}
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

        {/* Club logo */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-base">
          {clubEmoji}
        </div>
      </div>

      {/* ── SLIDE VIEWPORT ───────────────────────────── */}
      {/* overflow-hidden aquí, NO en el wrapper raíz */}
      <div className="relative flex-1 overflow-hidden">
        <div
          className="flex h-full transition-transform duration-300 ease-out"
          style={{
            width: `${TOTAL_SLIDES * 100}%`,
            transform: `translateX(-${(slide * 100) / TOTAL_SLIDES}%)`,
          }}
        >

          {/* ── SLIDE 1 — ¿Quién es? ─────────────────── */}
          <div
            className="flex flex-col items-center overflow-y-auto px-6 pb-10 pt-8"
            style={{ width: `${100 / TOTAL_SLIDES}%` }}
          >
            <SlideLabel label={t("slides_who_is")} />

            <div className="relative mb-6 mt-4 h-28 w-28">
              {photo ? (
                <>
                  <div className="absolute inset-0 scale-110 rounded-full bg-primary/30 blur-xl" aria-hidden />
                  <img
                    src={player.imageUrl!}
                    alt={player.name ?? ""}
                    className="relative h-28 w-28 rounded-full border-2 border-primary/30 object-cover shadow-lg ring-4 ring-primary/15"
                  />
                </>
              ) : (
                <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-2 border-border bg-muted shadow-lg">
                  <BasketballPlaceholderAvatar size={112} />
                </div>
              )}
            </div>

            <h1 className="mb-1 text-center text-2xl font-black text-foreground">
              {player.name?.trim() || t("dashboard_unnamed_player")}
            </h1>

            <div className="mb-2 w-full rounded-2xl border border-primary/25 bg-primary/10 px-5 py-3 text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-primary">
                {t("archetype")}
              </p>
              <p className="mt-0.5 text-xl font-black italic text-foreground">
                {report.identity.archetypeLabel}
              </p>
              {subAlt && (
                <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-primary/60">
                  {t("subarchetype")} {subAlt.label}
                </p>
              )}
            </div>

            <p className="mt-3 text-center text-sm italic leading-relaxed text-muted-foreground">
              {report.identity.tagline}
            </p>

            <div className="mt-4">
              <ThreatDots level={report.identity.dangerLevel ?? 1} />
            </div>

            {/* Desktop nav hint — solo slide 1 */}
            <SlideNavHint slide={slide} total={TOTAL_SLIDES} onGo={goTo} />
          </div>

          {/* ── SLIDE 2 — ¿Qué hará? ─────────────────── */}
          <div
            className="flex flex-col overflow-y-auto px-4 pb-10 pt-8"
            style={{ width: `${100 / TOTAL_SLIDES}%` }}
          >
            <SlideLabel label={t("slides_what_will_do")} />

            <div className="mt-4 space-y-3">
              {topSituations.map((sit) => {
                const colors = situationColors(sit.id);
                return (
                  <div
                    key={sit.id}
                    className={cn(
                      "rounded-2xl border border-border bg-card/95 px-4 py-4 shadow-sm border-l-4",
                      colors.border,
                    )}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      {coachMode && (
                        <button
                          type="button"
                          className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          onClick={() => { /* runners-up — próximo sprint */ }}
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <TierBadge tier={sit.tier} />
                      <span className={cn("text-[10px] font-black uppercase tracking-widest", colors.text)}>
                        {sit.label}
                      </span>
                      <span className={cn("ml-auto text-sm font-black tabular-nums", colors.text)}>
                        {Math.round(sit.score * 100)}
                      </span>
                    </div>
                    <p className="text-sm font-semibold leading-snug text-foreground">
                      {sit.description}
                    </p>
                  </div>
                );
              })}
            </div>

            <SlideNavHint slide={slide} total={TOTAL_SLIDES} onGo={goTo} />
          </div>

          {/* ── SLIDE 3 — ¿Qué hago yo? ──────────────── */}
          <div
            className="flex flex-col overflow-y-auto px-4 pb-10 pt-8"
            style={{ width: `${100 / TOTAL_SLIDES}%` }}
          >
            <SlideLabel label={t("slides_what_do_i")} />

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

            {topAlerts.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
                  {t("report_aware")}
                </p>
                {topAlerts.map((alert, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 border-l-4 border-l-amber-500"
                  >
                    <p className="text-sm font-black text-foreground">{alert.text}</p>
                    {alert.triggerCue && (
                      <p className="mt-1 text-xs italic text-amber-600 dark:text-amber-400">
                        {alert.triggerCue}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <SlideNavHint slide={slide} total={TOTAL_SLIDES} onGo={goTo} />
          </div>

        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────

function SlideLabel({ label }: { label: string }) {
  return (
    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
      {label}
    </p>
  );
}

/** Flechas de navegación visibles en desktop (md+), ocultas en móvil donde el swipe es suficiente */
function SlideNavHint({
  slide,
  total,
  onGo,
}: {
  slide: number;
  total: number;
  onGo: (i: number) => void;
}) {
  const hasPrev = slide > 0;
  const hasNext = slide < total - 1;
  if (!hasPrev && !hasNext) return null;
  return (
    <div className="mt-8 hidden items-center justify-center gap-4 md:flex">
      <button
        type="button"
        onClick={() => onGo(slide - 1)}
        disabled={!hasPrev}
        className={cn(
          "flex items-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-bold transition-colors",
          hasPrev
            ? "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
            : "invisible",
        )}
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Anterior
      </button>
      <button
        type="button"
        onClick={() => onGo(slide + 1)}
        disabled={!hasNext}
        className={cn(
          "flex items-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-bold transition-colors",
          hasNext
            ? "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
            : "invisible",
        )}
      >
        Siguiente
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function ThreatDots({ level }: { level: number }) {
  const safe = Math.min(Math.max(level, 1), 5);
  const labels = ["", "Low threat", "Moderate", "Dangerous", "High danger", "Elite threat"];
  const dotColors = ["", "bg-muted-foreground/40", "bg-yellow-500", "bg-orange-500", "bg-red-500", "bg-red-600"];
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex gap-1.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={cn("h-3 w-3 rounded-full", i < safe ? dotColors[safe] : "bg-muted/50")}
          />
        ))}
      </div>
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {labels[safe]}
      </span>
    </div>
  );
}

const DEFENSE_CONFIG = {
  deny: {
    border: "border-l-red-500",
    text: "text-red-500",
    bg: "bg-red-500/8",
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={2.5}>
        <circle cx="12" cy="12" r="9" />
        <line x1="5" y1="5" x2="19" y2="19" />
      </svg>
    ),
  },
  force: {
    border: "border-l-blue-500",
    text: "text-blue-500",
    bg: "bg-blue-500/8",
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={2.5}>
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    ),
  },
  allow: {
    border: "border-l-emerald-500",
    text: "text-emerald-500",
    bg: "bg-emerald-500/8",
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={2.5}>
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
        "flex items-start gap-3 rounded-2xl border border-border px-4 py-4 shadow-sm border-l-4",
        cfg.border,
        cfg.bg,
      )}
    >
      <div className={cn("mt-0.5 shrink-0", cfg.text)}>{cfg.icon}</div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className={cn("text-[10px] font-black uppercase tracking-widest", cfg.text)}>
            {label}
          </p>
          {coachMode && (
            <button
              type="button"
              className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => { /* runners-up — próximo sprint */ }}
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <p className="text-sm font-semibold leading-snug text-foreground">{instruction}</p>
      </div>
    </div>
  );
}

function situationColors(id: string): { border: string; text: string } {
  if (id.startsWith("iso")) return { border: "border-l-orange-500", text: "text-orange-600 dark:text-orange-400" };
  if (id.startsWith("pnr")) return { border: "border-l-blue-500", text: "text-blue-600 dark:text-blue-400" };
  if (id.startsWith("post")) return { border: "border-l-purple-500", text: "text-purple-600 dark:text-purple-400" };
  if (id === "catch_shoot") return { border: "border-l-teal-500", text: "text-teal-600 dark:text-teal-400" };
  if (id === "transition") return { border: "border-l-emerald-500", text: "text-emerald-600 dark:text-emerald-400" };
  if (id === "off_ball") return { border: "border-l-violet-500", text: "text-violet-600 dark:text-violet-400" };
  if (id === "floater") return { border: "border-l-cyan-500", text: "text-cyan-600 dark:text-cyan-400" };
  if (id === "oreb") return { border: "border-l-rose-500", text: "text-rose-600 dark:text-rose-400" };
  return { border: "border-l-muted-foreground", text: "text-muted-foreground" };
}

function TierBadge({ tier }: { tier: "primary" | "secondary" | "situational" }) {
  const styles = {
    primary: "bg-red-500/15 text-red-600 dark:text-red-400",
    secondary: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300",
    situational: "bg-muted text-muted-foreground",
  };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest", styles[tier])}>
      {tier}
    </span>
  );
}
