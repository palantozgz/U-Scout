import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { generateMotorV4 } from "@/lib/motor-v4";
import { SITUATION_ICONS } from "@/lib/motor-icons";
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
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
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
  const subAlt = finalReport.identity.archetypeAlternatives?.[0];
  const topSituations = finalReport.situations.slice(0, 3);
  const topAlerts = finalReport.alerts.slice(0, 2);
  const hasPrev = slide > 0;
  const hasNext = slide < TOTAL_SLIDES - 1;
  const es = locale === "es";
  const zh = locale === "zh";

  const defensivePlan = {
    deny: finalReport.defense.deny?.instruction ? [finalReport.defense.deny.instruction] : [],
    force: finalReport.defense.force?.instruction ? [finalReport.defense.force.instruction] : [],
    allow:
      motorOutput.defense.allow.winner.key !== "none" && finalReport.defense.allow?.instruction
        ? [finalReport.defense.allow.instruction]
        : [],
  };

  const SLIDE_LABELS = [
    es ? "¿Quién es?" : zh ? "她是谁？" : "Who is she?",
    es ? "¿Qué hará?" : zh ? "她会做什么？" : "What will she do?",
    es ? "¿Qué hago yo?" : zh ? "我怎么防？" : "How do I defend?",
  ];

  return (
    <div
      className="flex flex-col bg-background"
      style={{ minHeight: "100svh" }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* ── Top bar ── */}
      <header className="sticky top-0 z-20 flex items-center gap-2 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 shrink-0">
        {onBack && (
          <button type="button" onClick={onBack} className="-ml-1 p-2 rounded-lg text-muted-foreground hover:text-foreground" aria-label="Back">
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-foreground truncate">{player.name}</p>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{SLIDE_LABELS[slide]}</p>
        </div>
        <div className="flex gap-1.5 shrink-0">
          {Array.from({ length: TOTAL_SLIDES }, (_, i) => (
            <button key={i} type="button" onClick={() => goTo(i)}
              className={cn("rounded-full transition-all", i === slide ? "w-4 h-2 bg-primary" : "w-2 h-2 bg-muted-foreground/30")}
              aria-label={`Slide ${i + 1}`} />
          ))}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">

        {/* SLIDE 0: ¿Quién es? */}
        {slide === 0 && (
          <div className="px-4 pt-6 pb-24 space-y-4 max-w-lg mx-auto">
            <div className="flex items-center gap-4">
              <Suspense fallback={<div className="w-16 h-16 rounded-full bg-muted/40" />}>
                {photo ? (
                  <img src={player.imageUrl} alt={player.name} className="w-16 h-16 rounded-full object-cover ring-2 ring-border shrink-0" />
                ) : (
                  <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-border shrink-0">
                    <BasketballPlaceholderAvatar size={64} />
                  </div>
                )}
              </Suspense>
              <div className="flex-1 min-w-0">
                <p className="text-xl font-black text-foreground leading-tight truncate">{player.name}</p>
                {player.number && <p className="text-xs text-muted-foreground font-semibold">#{player.number}</p>}
              </div>
            </div>

            <button type="button" onClick={() => openArchetypeSheet(finalReport.identity.archetypeLabel)}
              className="w-full text-left rounded-2xl border border-border bg-card p-4 space-y-1 active:bg-muted/40 transition-colors">
              <p className="text-[10px] font-black uppercase tracking-widest text-primary/80">
                {es ? "Arquetipo" : zh ? "类型" : "Archetype"}
              </p>
              <p className="text-2xl font-black text-foreground leading-tight">{finalReport.identity.archetypeLabel}</p>
              {subAlt && (
                <p className="text-xs text-muted-foreground font-semibold">
                  {es ? "También: " : zh ? "或: " : "Also: "}{subAlt.label}
                </p>
              )}
            </button>

            {finalReport.identity.tagline && (
              <div className="rounded-2xl border border-border bg-card px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">
                  {es ? "Perfil" : zh ? "简述" : "Profile"}
                </p>
                <p className="text-base font-semibold text-foreground leading-snug">{finalReport.identity.tagline}</p>
              </div>
            )}

            {finalReport.identity.threat && (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-destructive/70 mb-1">
                  {es ? "Amenaza principal" : zh ? "主要威胁" : "Main threat"}
                </p>
                <p className="text-sm font-semibold text-foreground leading-snug">{finalReport.identity.threat}</p>
              </div>
            )}

            {showSwipeHint && (
              <p className="text-center text-xs text-muted-foreground/50 font-medium pt-2">
                {es ? "Desliza para ver el informe completo →" : zh ? "左滑查看完整报告 →" : "Swipe to see full report →"}
              </p>
            )}
          </div>
        )}

        {/* SLIDE 1: ¿Qué hará? */}
        {slide === 1 && (
          <div className="px-4 pt-6 pb-24 space-y-3 max-w-lg mx-auto">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-4">
              {es ? "Situaciones primarias" : zh ? "主要进攻方式" : "Primary situations"}
            </p>
            {topSituations.map((sit, i) => {
              const SitIcon = SITUATION_ICONS[sit.id as keyof typeof SITUATION_ICONS];
              const desc = renderSituationDescription(
                motorOutput.situations.find((s) => s.id === sit.id) ?? motorOutput.situations[i],
                ctx,
                motorOutput.inputs,
              );
              const colors = situationColors(sit.id);
              return (
                <button key={sit.id} type="button" onClick={() => openSituationSheet(sit.id, desc)}
                  className={cn("w-full text-left rounded-2xl border border-border border-l-4 p-4 space-y-2 bg-card active:bg-muted/40 transition-colors", colors.border)}>
                  <div className="flex items-center gap-2">
                    {SitIcon && <SitIcon className="w-4 h-4 shrink-0 text-muted-foreground/60" />}
                    <p className={cn("text-xs font-black uppercase tracking-widest", colors.text)}>{sit.label}</p>
                    <span className="ml-auto text-[9px] font-black text-muted-foreground/40 tabular-nums">#{i + 1}</span>
                  </div>
                  <p className="text-sm leading-snug text-foreground/85 font-medium">{desc}</p>
                </button>
              );
            })}
            {topSituations.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border px-6 py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  {es ? "Sin situaciones detectadas" : zh ? "未检测到情况" : "No situations detected"}
                </p>
              </div>
            )}
          </div>
        )}

        {/* SLIDE 2: ¿Qué hago yo? */}
        {slide === 2 && (
          <div className="px-4 pt-6 pb-24 space-y-3 max-w-lg mx-auto">
            {defensivePlan.deny.length > 0 && (
              <button type="button" onClick={() => openDefenseSheet("deny", defensivePlan.deny[0], finalReport.defense.deny.alternatives ?? [])}
                className={cn("w-full text-left rounded-2xl border border-border border-l-4 p-4 bg-card active:bg-muted/40 transition-colors", DENY_CLASSES.border)}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn("w-2 h-2 rounded-full shrink-0", DENY_CLASSES.dot)} />
                  <p className={cn("text-[10px] font-black uppercase tracking-widest", DENY_CLASSES.text)}>
                    {es ? "Denegar" : zh ? "封堵" : "Deny"}
                  </p>
                </div>
                <p className="text-sm font-semibold text-foreground/90 leading-snug">{defensivePlan.deny[0]}</p>
              </button>
            )}
            {defensivePlan.force.length > 0 && (
              <button type="button" onClick={() => openDefenseSheet("force", defensivePlan.force[0], finalReport.defense.force.alternatives ?? [])}
                className={cn("w-full text-left rounded-2xl border border-border border-l-4 p-4 bg-card active:bg-muted/40 transition-colors", FORCE_CLASSES.border)}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn("w-2 h-2 rounded-full shrink-0", FORCE_CLASSES.dot)} />
                  <p className={cn("text-[10px] font-black uppercase tracking-widest", FORCE_CLASSES.text)}>
                    {es ? "Forzar" : zh ? "逼迫" : "Force"}
                  </p>
                </div>
                <p className="text-sm font-semibold text-foreground/90 leading-snug">{defensivePlan.force[0]}</p>
              </button>
            )}
            {defensivePlan.allow.length > 0 && (
              <button type="button" onClick={() => openDefenseSheet("allow", defensivePlan.allow[0], finalReport.defense.allow.alternatives ?? [])}
                className={cn("w-full text-left rounded-2xl border border-border border-l-4 p-4 bg-card active:bg-muted/40 transition-colors", ALLOW_CLASSES.border)}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn("w-2 h-2 rounded-full shrink-0", ALLOW_CLASSES.dot)} />
                  <p className={cn("text-[10px] font-black uppercase tracking-widest", ALLOW_CLASSES.text)}>
                    {es ? "Conceder" : zh ? "放开" : "Allow"}
                  </p>
                </div>
                <p className="text-sm font-semibold text-foreground/90 leading-snug">{defensivePlan.allow[0]}</p>
              </button>
            )}
            {topAlerts.length > 0 && (
              <div className="space-y-2 pt-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                  {es ? "Alerta" : zh ? "注意" : "Aware"}
                </p>
                {topAlerts.map((alert, i) => (
                  <div key={i} className={cn("rounded-2xl border border-border border-l-4 p-3 bg-card", AWARE_CLASSES.border)}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", AWARE_CLASSES.dot)} />
                      <p className={cn("text-[9px] font-black uppercase tracking-widest", AWARE_CLASSES.text)}>AWARE</p>
                    </div>
                    <p className="text-xs font-semibold text-foreground/80 leading-snug">{alert.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Nav arrows ── */}
      <div className={cn(
        "fixed bottom-6 left-0 right-0 flex justify-between px-4 pointer-events-none transition-opacity duration-300 z-20",
        arrowsVisible ? "opacity-100" : "opacity-0",
      )}>
        <button type="button" onClick={() => goTo(slide - 1)} disabled={!hasPrev}
          className={cn("pointer-events-auto w-10 h-10 rounded-full bg-card/90 border border-border flex items-center justify-center shadow-md transition-opacity", hasPrev ? "opacity-100" : "opacity-0")}
          aria-label="Previous">
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>
        <button type="button" onClick={() => goTo(slide + 1)} disabled={!hasNext}
          className={cn("pointer-events-auto w-10 h-10 rounded-full bg-card/90 border border-border flex items-center justify-center shadow-md transition-opacity", hasNext ? "opacity-100" : "opacity-0")}
          aria-label="Next">
          <ChevronRight className="w-5 h-5 text-foreground" />
        </button>
      </div>

      {bottomBar && (
        <div className="sticky bottom-0 z-10 bg-background border-t border-border">{bottomBar}</div>
      )}

      <Sheet open={!!activeSheet} onOpenChange={(o) => { if (!o) setActiveSheet(null); }}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[75dvh] overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-base font-black">{activeSheet?.title}</SheetTitle>
          </SheetHeader>
          <div className="mb-3">
            <p className="mb-1 text-[11px] font-black uppercase tracking-widest text-muted-foreground/60">
              {es ? "Actual" : zh ? "当前" : "Current"}
            </p>
            <p className="text-sm font-semibold text-foreground/80">{activeSheet?.current}</p>
          </div>
          {activeSheet && activeSheet.alternatives.length > 0 ? (
            <div className="space-y-2">
              <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-muted-foreground/50">
                {es ? "Alternativas del motor" : zh ? "引擎备选" : "Engine alternatives"}
              </p>
              {activeSheet.alternatives.map((alt, idx) => (
                <div key={idx} className="rounded-xl border border-border/60 bg-card px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="flex-1 text-sm leading-snug text-foreground/85">{alt.text}</p>
                    <span className="shrink-0 text-xs font-black tabular-nums text-muted-foreground/50">{Math.round(alt.score * 100)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground/50">
              {es ? "Sin alternativas disponibles" : zh ? "暂无备选" : "No alternatives available"}
            </p>
          )}
        </SheetContent>
      </Sheet>
    </div>
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
