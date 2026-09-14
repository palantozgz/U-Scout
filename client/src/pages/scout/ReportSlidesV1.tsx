import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Eye, CornerRightDown } from "lucide-react";
import { computeCloseoutThreatV1, type CloseoutThreatReport } from "@/lib/closeoutThreat";
import { usePlayerWcbaLink, useNivel2Context } from "@/lib/stats-api";
import { ensamblarReporteParaTexto } from "@/lib/motor-v1";
import { enriquecerReporteConNivel2 } from "@/lib/motor-v1-stats";
import type { ReporteModoCompletoV1, StatDestacado, QuietEdge } from "@/lib/motor-v1-types";
import type { EnrichedInputs } from "@/lib/motor-v2.1";
import { SITUATION_ICONS } from "@/lib/motor-icons";
import {
  renderReportV1,
  renderSituationDescriptionV1,
  type RenderedReportV1,
} from "@/lib/reportTextRendererV1";
import type { RenderContext } from "@/lib/reportTextRenderer";
import {
  usePlayer,
  clubRowToMotorContext,
  playerInputToMotorInputs,
} from "@/lib/mock-data";
import { useLocale } from "@/lib/i18n";
import { useAuth } from "@/lib/useAuth";
import { useClub } from "@/lib/club-api";
import { cn, isRealPhoto, localName } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { applyOverridesV1, type ReportOverride } from "@/lib/overrideEngine";
import { useSetReportOverride, useDeleteReportOverride, type ApprovalSlide } from "@/lib/approval-api";
import { useRecordPlayerSlideView } from "@/lib/player-home";

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

/** `RenderedReportV1` siempre se usa en su variante "completo" en esta
 *  pantalla (spec 23, PR-B) -- `simpleMode` es un toggle de presentación
 *  client-side, igual que ya lo era con motor-v4 (que tampoco distinguía
 *  modo a nivel de datos). Modo "sencillo" del contrato de motor-v1 es
 *  para OTROS consumidores (13.3, "sin acción adelantada" para la
 *  jugadora) -- aquí el entrenador ya ve capa1+capa2 juntas siempre,
 *  ordenadas por slide, ninguna se "adelanta" fuera de orden. */
type RenderedCompletoV1 = Extract<RenderedReportV1, { modo: "completo" }>;
function asCompleto(r: RenderedReportV1 | null): RenderedCompletoV1 | null {
  return r && r.modo === "completo" ? r : null;
}

interface ActiveSheet {
  title: string;
  current: string;
  // `key` añadido 2026-09-14 (Nivel B/decantador, spec 38/39) -- opcional,
  // ausente en los sheets de situaciones (que no traen OutputKey).
  alternatives: { text: string; score: number; key?: string }[];
  /**
   * Picker de alternativas (spec motor-1.0 sección 21.11) -- solo presente
   * en los sheets de deny/force/allow (los únicos con datos suficientes:
   * texto + score por candidato, ya renderizados por reportTextRendererV1.ts).
   * Ausente en los sheets de situaciones -- ese sigue siendo de solo
   * lectura, el picker no se extendió ahí en esta pasada. El sheet de
   * archetype se retiró (spec 22.2/23.4 -- "También: X" era el bug de P2
   * documentado en 21.7, no se migra).
   */
  itemKey?: string;
  originalScore?: number;
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
// Semáforo "estándar" (spec 21.9 bis) -- ámbar/neutro a propósito, nunca rojo:
// no es una amenaza, es la ausencia deliberada de una (KYP, "non-shooter").
const STANDARD_CLASSES = { border: "border-l-amber-400", bg: "bg-amber-400/8", text: "text-amber-600 dark:text-amber-400", dot: "bg-amber-400" };

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
  // Picker de alternativas (spec motor-1.0 sección 21.11) -- solo se usan
  // cuando coachMode. El servidor infiere coachId de la sesión autenticada,
  // no hace falta pasarlo aquí.
  const setOverride = useSetReportOverride(playerId);
  const deleteOverride = useDeleteReportOverride(playerId);
  const recordSlideView = useRecordPlayerSlideView();
  const [pickingIdx, setPickingIdx] = useState<number | null>(null);
  const displayName = player ? localName(player.name, (player as any).nameEn ?? (player as any).name_en, locale) : "";
  const clubQ = useClub({ enabled: Boolean(user) });
  const clubMotorCtx = useMemo(
    () => clubRowToMotorContext(clubQ.data?.club),
    [clubQ.data?.club],
  );
  const clubGender = clubQ.data?.club?.gender;
  const gender = clubGender === "F" ? "f" : clubGender === "M" ? "m" : "n";
  const [slide, setSlide] = useState(0);
  const [simpleMode, setSimpleMode] = useState(true);
  // Sincroniza el modo por defecto con la preferencia del club (clubs.report_mode) una
  // sola vez, cuando llegan los datos del club — después de eso el toggle manual del
  // usuario manda (no se vuelve a sobrescribir aunque clubQ refetchée).
  const clubDefaultAppliedRef = useRef(false);
  useEffect(() => {
    if (clubDefaultAppliedRef.current) return;
    if (!clubQ.data) return;
    clubDefaultAppliedRef.current = true;
    setSimpleMode(clubQ.data.club.reportMode === "simple");
  }, [clubQ.data]);
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

  // CORREGIDO 2026-09-14 (Bloque C, spec 26.3/28): era un `fetch` crudo que
  // duplicaba lo que ya hacía `useRecordPlayerSlideView` (player-home.ts) sin
  // su `onSuccess` -- que invalida las queries `player-teams`/`player-team`
  // de las que depende `unseenCount` en `PlayerTeamList.tsx`. Con el fetch
  // crudo, el badge de "pendientes" no se refrescaba en el momento tras ver
  // una diapositiva, solo en el siguiente refetch natural. Usando el hook ya
  // construido (antes solo vivía en el `Profile.tsx` retirado) se restaura
  // esa invalidación.
  useEffect(() => {
    if (coachMode) return;
    if (!user) return;
    if (!playerId) return;
    recordSlideView.mutate({ playerId, slideIndex: slide });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide, coachMode, playerId, user]);

  function showArrows() {
    setArrowsVisible(true);
    if (arrowTimer.current) clearTimeout(arrowTimer.current);
    arrowTimer.current = setTimeout(() => setArrowsVisible(false), ARROW_HIDE_DELAY);
  }

  // Motor 1.0 (spec 23, PR-B) -- reemplaza generateMotorV4(). Siempre modo
  // "completo": ver el comentario de `asCompleto` arriba sobre por qué esta
  // pantalla no necesita pedir modo "sencillo" aparte.
  const assembled = useMemo(() => {
    if (!player) return null;
    const inp = player.scoutingInputs ?? player.inputs;
    return ensamblarReporteParaTexto(playerInputToMotorInputs(inp), clubMotorCtx, {
      jugadoraId: playerId,
      modo: "completo",
    });
  }, [player, clubMotorCtx, playerId]);

  const completoBase: { reporte: ReporteModoCompletoV1; enrichedInputs: EnrichedInputs } | null = useMemo(() => {
    if (!assembled) return null;
    if (assembled.reporte.modo !== "completo") return null; // no debería pasar, ver arriba
    return { reporte: assembled.reporte, enrichedInputs: assembled.enrichedInputs };
  }, [assembled]);

  // Motor 1.0, Fase 2 (spec 24) -- vínculo a U Stats real de la jugadora.
  // Sigue resolviéndose por nombre en caliente (5.2, sin wcbaExternalId
  // guardado todavía) -- solo la fuente de contexto cambió: antes
  // `usePlayerDetail` alimentaba un `StatsStrip` crudo por fuera de
  // motor-v1 (hallazgo de 24.1); ahora `useNivel2Context` alimenta
  // `enriquecerReporteConNivel2()`, que rellena `capa3`/`statsDestacados`/
  // `quietEdge` dentro del propio reporte -- un solo sistema de Nivel 2,
  // decisión directa de Pablo (spec 24, "cablear capa3 y retirar StatsStrip").
  const wcbaLinkQ = usePlayerWcbaLink(player?.name);
  const nivel2Q = useNivel2Context(wcbaLinkQ.data?.externalId ?? null);

  const completo: { reporte: ReporteModoCompletoV1; enrichedInputs: EnrichedInputs } | null = useMemo(() => {
    if (!completoBase) return null;
    // Sin vínculo a WCBA (jugadora no encontrada, o WCBA todavía sin
    // terminar de cargar): el reporte vuelve tal cual, sin Nivel 2 --
    // `enriquecerReporteConNivel2` ya maneja `undefined` como "sin cambios"
    // (spec 24, contexto opcional, nunca obligatorio).
    const reporte = enriquecerReporteConNivel2(completoBase.reporte, nivel2Q.data, 3);
    return { reporte, enrichedInputs: completoBase.enrichedInputs };
  }, [completoBase, nivel2Q.data]);

  const ctx: RenderContext = { locale, gender };

  const report: RenderedCompletoV1 | null = useMemo(() => {
    if (!completo) return null;
    return asCompleto(renderReportV1(completo.reporte, completo.enrichedInputs, ctx));
  }, [completo, locale, gender]);

  const finalReport: RenderedCompletoV1 | null = useMemo(() => {
    if (!report) return null;
    if (!overrides || overrides.length === 0) return report;
    return asCompleto(applyOverridesV1(report, overrides));
  }, [report, overrides]);

  // ── Slide sencillo: semaforo de cierre ─────────────────────────────────────
  const closeoutReport: CloseoutThreatReport | null = useMemo(() => {
    if (!completo) return null;
    return computeCloseoutThreatV1(completo.enrichedInputs, completo.reporte.capa1.situaciones);
  }, [completo]);

  const situationRunnersUp = useMemo(() => {
    if (!completo || !report) return [];
    const shown = new Set(report.situations.slice(0, 3).map((s) => s.situacion));
    return completo.reporte.capa1.situaciones
      .filter((s) => s.score > 0 && !shown.has(s.situacion))
      .sort((a, b) => b.score - a.score)
      .map((s) => ({
        text: renderSituationDescriptionV1(s.situacion, completo.enrichedInputs, locale),
        score: s.score,
        situacion: s.situacion,
      }));
  }, [completo, report, locale, gender]);

  function openSituationSheet(current: string) {
    setActiveSheet({
      title: locale === "es" ? "Alternativas" : locale === "zh" ? "其他选项" : "Alternatives",
      current,
      alternatives: situationRunnersUp.map((r) => ({ text: r.text, score: r.score })),
    });
  }

  function openDefenseSheet(
    type: "deny" | "force" | "allow",
    current: string,
    alternatives: { instruction: string; score: number; key?: string }[],
    originalScore: number,
  ) {
    const labels = {
      deny:  { en: "DENY alternatives",  es: "Alternativas DENY",  zh: "封堵备选" },
      force: { en: "FORCE alternatives", es: "Alternativas FORCE", zh: "逼迫备选" },
      allow: { en: "ALLOW alternatives", es: "Alternativas ALLOW", zh: "放开备选" },
    };
    setActiveSheet({
      title: labels[type][locale],
      current,
      alternatives: alternatives.map((a) => ({ text: a.instruction, score: a.score, key: a.key })),
      // itemKey sigue la misma convención que OverridePanel.tsx
      // (toServerSlideAndItemKey) -- "deny.instruction" etc.
      itemKey: `${type}.instruction`,
      originalScore,
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
  if (!finalReport || !completo) {
    return (
      <div className="p-4 text-muted-foreground">
        {locale === "es" ? "No se pudo generar el informe."
          : locale === "zh" ? "无法生成报告。"
          : "Could not generate report."}
      </div>
    );
  }

  const photo = isRealPhoto(player.imageUrl);
  const topSituations = finalReport.situations.slice(0, 3);
  const topAlerts = finalReport.alerts.slice(0, 2);
  const hasPrev = slide > 0;
  const hasNext = slide < TOTAL_SLIDES - 1;
  const es = locale === "es";
  const zh = locale === "zh";
  const esEstandar = finalReport.identity.nivelAmenaza === "estandar";

  const defensivePlan = {
    deny: finalReport.defense.deny?.instruction ? [finalReport.defense.deny.instruction] : [],
    force: finalReport.defense.force?.instruction ? [finalReport.defense.force.instruction] : [],
    allow: finalReport.defense.allow?.instruction ? [finalReport.defense.allow.instruction] : [],
  };
  // AÑADIDO 2026-09-14 (spec 26.3/33): las tarjetas deny/force/allow solo son
  // interactivas (abren el picker de alternativas) en coachMode -- en modo
  // jugadora son de solo lectura, sin afordancia de tap.
  const CardTag = coachMode ? "button" : "div";

  // Motor 1.0, Fase 2 (spec 24.6, pendiente cerrado 2026-09-14) -- `porque`
  // (15.5) ya se calcula desde que capa3 llegó a producción, pero no se
  // mostraba en ningún sitio. Se muestra bajo la tarjeta del campo, SOLO
  // cuando no hay un "replace" activo de un entrenador para ese campo -- el
  // "porque" pertenece a la recomendación original del motor, no a la
  // alternativa elegida a mano (para esa no hay `porque` calculado; mejor
  // omitirlo que mostrar uno que ya no corresponde al texto en pantalla).
  function porqueDelGanador(campo: "deny" | "force" | "allow"): string | undefined {
    const porque = completo!.reporte.capa2[campo]?.ganador.porque;
    if (!porque) return undefined;
    const reemplazado = overrides?.some(
      (o) => o.slide === "defense" && o.itemKey === `${campo}.instruction` && o.action === "replace",
    );
    return reemplazado ? undefined : porque;
  }

  // Picker de alternativas (spec motor-1.0 sección 21.11) -- ¿hay ya un
  // "replace" guardado para el campo que el sheet abierto representa?
  const activeReplaceOverride = activeSheet?.itemKey
    ? overrides?.find(
        (o) => o.slide === "defense" && o.itemKey === activeSheet.itemKey && o.action === "replace",
      )
    : undefined;

  async function pickAlternative(alt: { text: string; score: number }, idx: number) {
    if (!activeSheet?.itemKey) return;
    setPickingIdx(idx);
    try {
      await setOverride.mutateAsync({
        slide: "defense" as ApprovalSlide,
        itemKey: activeSheet.itemKey,
        action: "replace",
        replacementValue: alt.text,
        originalScore: activeSheet.originalScore,
        replacementScore: alt.score,
        archetypeKey: completo!.reporte.identidad.archetypeKey,
        locale: locale as "en" | "es" | "zh",
      });
    } catch (e) {
      console.error("[ReportSlidesV1] pickAlternative failed", e);
    } finally {
      setPickingIdx(null);
    }
  }

  async function restoreOriginal() {
    if (!activeSheet?.itemKey) return;
    setPickingIdx(-1);
    try {
      await deleteOverride.mutateAsync(activeSheet.itemKey);
    } catch (e) {
      console.error("[ReportSlidesV1] restoreOriginal failed", e);
    } finally {
      setPickingIdx(null);
    }
  }

  const SLIDE_LABELS = [
    es ? "¿Quién es?" : zh ? "她是谁？" : "Who is she?",
    es ? "¿Qué hará?" : zh ? "她会做什么？" : "What will she do?",
    es ? "¿Qué hago yo?" : zh ? "我怎么防？" : "How do I defend?",
  ];

  return (
    <div
      // CORREGIDO 2026-09-14 (hallazgo B.1 de la auditoría, spec 28): era
      // `minHeight: "100svh"` sin altura acotada -- dentro del wrapper fijo
      // `h-[100dvh] overflow-hidden` de App.tsx (sin overflow-y-auto en
      // ningún ancestro intermedio), un contenedor flex sin altura definida
      // no fuerza a <main> a un tamaño acotado: si una diapositiva +
      // bottomBar (aprobación/OverridePanel en coachMode) supera el
      // viewport, el excedente queda recortado e invisible, no scrolleable
      // -- justo donde vive el botón de aprobar de la sección 27. Mismo
      // patrón ya correcto en Profile.tsx (h-[100dvh] + overflow-hidden).
      className="flex flex-col h-[100dvh] bg-background overflow-hidden"
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
          <p className="text-sm font-black text-foreground truncate">{displayName}</p>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            {simpleMode ? (es ? "Resumen rápido" : zh ? "快速简报" : "Quick brief") : SLIDE_LABELS[slide]}
          </p>
        </div>
        <div className="flex gap-1.5 shrink-0 items-center">
          {simpleMode ? (
            <button
              type="button"
              onClick={() => setSimpleMode(false)}
              className="text-[11px] font-bold text-primary underline underline-offset-2"
            >
              {es ? "Ver informe completo" : zh ? "查看完整报告" : "View full report"}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setSimpleMode(true)}
                className="mr-1 text-[11px] font-bold text-muted-foreground underline underline-offset-2"
              >
                {es ? "Resumen" : zh ? "简报" : "Brief"}
              </button>
              {Array.from({ length: TOTAL_SLIDES }, (_, i) => (
                <button key={i} type="button" onClick={() => goTo(i)}
                  className={cn("rounded-full transition-all", i === slide ? "w-4 h-2 bg-primary" : "w-2 h-2 bg-muted-foreground/30")}
                  aria-label={`Slide ${i + 1}`} />
              ))}
            </>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto min-h-0">
        {simpleMode ? (
          <SimpleReportSlide
            player={player}
            photo={photo}
            finalReport={finalReport}
            closeoutReport={closeoutReport}
            statsDestacados={completo.reporte.identidad.statsDestacados.slice(0, 1)}
            quietEdge={completo.reporte.identidad.quietEdge}
            denyPorque={porqueDelGanador("deny")}
            locale={locale}
            es={es}
            zh={zh}
          />
        ) : (
        <>

        {/* SLIDE 0: ¿Quién es? */}
        {slide === 0 && (
          <div className="px-4 pt-6 pb-24 space-y-4 max-w-lg mx-auto">
            <div className="flex items-center gap-4">
              <Suspense fallback={<div className="w-16 h-16 rounded-full bg-muted/40" />}>
                {photo ? (
                  <img src={player.imageUrl} alt={displayName} className="w-16 h-16 rounded-full object-cover ring-2 ring-border shrink-0" />
                ) : (
                  <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-border shrink-0">
                    <BasketballPlaceholderAvatar size={64} />
                  </div>
                )}
              </Suspense>
              <div className="flex-1 min-w-0">
                <p className="text-xl font-black text-foreground leading-tight truncate">{displayName}</p>
                {player.number && <p className="text-xs text-muted-foreground font-semibold">#{player.number}</p>}
              </div>
            </div>

            {/* Arquetipo -- CORREGIDO 2026-09-13 (spec 22.2/23.4): ya no es un
                botón que abre un sheet de "También: X". Ese sub-label
                repetía la situación #2 con otro nombre sin añadir
                información (bug de P2 documentado en 21.7) -- se retira,
                no se migra. La tarjeta es solo lectura. */}
            <div className="w-full rounded-2xl border border-border bg-card p-4 space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-primary/80">
                {es ? "Arquetipo" : zh ? "类型" : "Archetype"}
              </p>
              <p className="text-2xl font-black text-foreground leading-tight">{finalReport.identity.archetypeLabel}</p>
            </div>

            {finalReport.identity.tagline && (
              <div className="rounded-2xl border border-border bg-card px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">
                  {es ? "Perfil" : zh ? "简述" : "Profile"}
                </p>
                <p className="text-base font-semibold text-foreground leading-snug">{finalReport.identity.tagline}</p>
              </div>
            )}

            {/* CORREGIDO 2026-09-13 (spec 21.9 bis/23.4#4): antes esta tarjeta
                era siempre roja/"amenaza". Cuando nivelAmenaza es "estandar"
                (KYP, non-shooter) el texto ya es el copy activo de "defensa
                estándar" -- pintarlo de rojo contradiría el propio mensaje.
                Ámbar/neutro en ese caso, rojo solo cuando hay amenaza real. */}
            {finalReport.identity.threat && (
              <div className={cn(
                "rounded-2xl border px-4 py-3",
                esEstandar ? "border-amber-400/30 bg-amber-400/5" : "border-destructive/30 bg-destructive/5",
              )}>
                <p className={cn(
                  "text-[10px] font-black uppercase tracking-widest mb-1",
                  esEstandar ? "text-amber-600 dark:text-amber-400" : "text-destructive/70",
                )}>
                  {esEstandar
                    ? (es ? "Sin amenaza clara" : zh ? "无明确威胁" : "No clear threat")
                    : (es ? "Amenaza principal" : zh ? "主要威胁" : "Main threat")}
                </p>
                <p className="text-sm font-semibold text-foreground leading-snug">{finalReport.identity.threat}</p>
              </div>
            )}

            <StatsDestacadosRow statsDestacados={completo.reporte.identidad.statsDestacados} locale={locale} />
            <QuietEdgeCallout quietEdge={completo.reporte.identidad.quietEdge} locale={locale} />

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
              const SitIcon = SITUATION_ICONS[sit.situacion];
              const colors = situationColors(sit.situacion);
              return (
                <button key={sit.situacion} type="button" onClick={() => openSituationSheet(sit.description)}
                  className={cn("w-full text-left rounded-2xl border border-border border-l-4 p-4 space-y-2 bg-card active:bg-muted/40 transition-colors", colors.border)}>
                  <div className="flex items-center gap-2">
                    {SitIcon && <SitIcon className="w-4 h-4 shrink-0 text-muted-foreground/60" />}
                    <p className={cn("text-xs font-black uppercase tracking-widest", colors.text)}>{sit.label}</p>
                    <span className="ml-auto text-[9px] font-black text-muted-foreground/40 tabular-nums">#{i + 1}</span>
                  </div>
                  <p className="text-sm leading-snug text-foreground/85 font-medium">{sit.description}</p>
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
            {/* CORREGIDO 2026-09-14 (spec 26.3/33, decisión directa de Pablo):
                "la jugadora solo ve la opción que hemos aprobado. debe ser un
                report categórico, sencillo, sintetizado y que dé confianza
                absoluta" -- las tarjetas deny/force/allow abrían el picker de
                alternativas del motor (con puntuaciones) para cualquiera,
                jugadora incluida, aunque no pudiera elegir ninguna. Ahora solo
                se abre en coachMode; en modo jugadora la tarjeta es de solo
                lectura (sin onClick, sin CardTag interactivo) -- lo que ve es
                lo que ya está en la propia tarjeta, nada más detrás. */}
            {defensivePlan.deny.length > 0 ? (
              <CardTag type={coachMode ? "button" : undefined}
                onClick={coachMode ? () => openDefenseSheet("deny", defensivePlan.deny[0], finalReport.defense.deny?.alternatives ?? [], completo.reporte.capa2.deny?.ganador.score ?? 0) : undefined}
                className={cn("w-full text-left rounded-2xl border border-border border-l-4 p-4 bg-card transition-colors", coachMode && "active:bg-muted/40", DENY_CLASSES.border)}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn("w-2 h-2 rounded-full shrink-0", DENY_CLASSES.dot)} />
                  <p className={cn("text-[10px] font-black uppercase tracking-widest", DENY_CLASSES.text)}>
                    {es ? "Denegar" : zh ? "封堵" : "Deny"}
                  </p>
                </div>
                <p className="text-sm font-semibold text-foreground/90 leading-snug">{defensivePlan.deny[0]}</p>
                {porqueDelGanador("deny") && (
                  <p className="mt-1.5 text-xs text-muted-foreground/70 italic">{porqueDelGanador("deny")}</p>
                )}
              </CardTag>
            ) : (
              // CORREGIDO 2026-09-13 (spec 21.9 bis/23.4#4): antes, sin deny,
              // esta sección desaparecía en silencio. El semáforo "estandar"
              // exige una instrucción activa (KYP), nunca un hueco vacío.
              <div className={cn("w-full rounded-2xl border border-border border-l-4 p-4 bg-card", STANDARD_CLASSES.border)}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn("w-2 h-2 rounded-full shrink-0", STANDARD_CLASSES.dot)} />
                  <p className={cn("text-[10px] font-black uppercase tracking-widest", STANDARD_CLASSES.text)}>
                    {es ? "Defensa estándar" : zh ? "标准防守" : "Standard defense"}
                  </p>
                </div>
                <p className="text-sm font-semibold text-foreground/90 leading-snug">{finalReport.identity.threat}</p>
              </div>
            )}
            {defensivePlan.force.length > 0 && (
              <CardTag type={coachMode ? "button" : undefined}
                onClick={coachMode ? () => openDefenseSheet("force", defensivePlan.force[0], finalReport.defense.force?.alternatives ?? [], completo.reporte.capa2.force?.ganador.score ?? 0) : undefined}
                className={cn("w-full text-left rounded-2xl border border-border border-l-4 p-4 bg-card transition-colors", coachMode && "active:bg-muted/40", FORCE_CLASSES.border)}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn("w-2 h-2 rounded-full shrink-0", FORCE_CLASSES.dot)} />
                  <p className={cn("text-[10px] font-black uppercase tracking-widest", FORCE_CLASSES.text)}>
                    {es ? "Forzar" : zh ? "逼迫" : "Force"}
                  </p>
                </div>
                <p className="text-sm font-semibold text-foreground/90 leading-snug">{defensivePlan.force[0]}</p>
                {porqueDelGanador("force") && (
                  <p className="mt-1.5 text-xs text-muted-foreground/70 italic">{porqueDelGanador("force")}</p>
                )}
              </CardTag>
            )}
            {defensivePlan.allow.length > 0 && (
              <CardTag type={coachMode ? "button" : undefined}
                onClick={coachMode ? () => openDefenseSheet("allow", defensivePlan.allow[0], finalReport.defense.allow?.alternatives ?? [], completo.reporte.capa2.allow?.ganador.score ?? 0) : undefined}
                className={cn("w-full text-left rounded-2xl border border-border border-l-4 p-4 bg-card transition-colors", coachMode && "active:bg-muted/40", ALLOW_CLASSES.border)}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn("w-2 h-2 rounded-full shrink-0", ALLOW_CLASSES.dot)} />
                  <p className={cn("text-[10px] font-black uppercase tracking-widest", ALLOW_CLASSES.text)}>
                    {es ? "Conceder" : zh ? "放开" : "Allow"}
                  </p>
                </div>
                <p className="text-sm font-semibold text-foreground/90 leading-snug">{defensivePlan.allow[0]}</p>
                {porqueDelGanador("allow") && (
                  <p className="mt-1.5 text-xs text-muted-foreground/70 italic">{porqueDelGanador("allow")}</p>
                )}
              </CardTag>
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
        </>
        )}
      </main>

      {/* ── Nav arrows ── */}
      {!simpleMode && (
      <div className={cn(
        "fixed bottom-6 left-0 right-0 flex justify-between px-4 pointer-events-none transition-opacity duration-300 z-20",
        arrowsVisible ? "opacity-100" : "opacity-0",
      )}>
        <button type="button" onClick={() => goTo(slide - 1)} disabled={!hasPrev}
          className={cn("pointer-events-auto w-11 h-11 rounded-full bg-card/90 border border-border flex items-center justify-center shadow-md transition-opacity", hasPrev ? "opacity-100" : "opacity-0")}
          aria-label="Previous">
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>
        <button type="button" onClick={() => goTo(slide + 1)} disabled={!hasNext}
          className={cn("pointer-events-auto w-11 h-11 rounded-full bg-card/90 border border-border flex items-center justify-center shadow-md transition-opacity", hasNext ? "opacity-100" : "opacity-0")}
          aria-label="Next">
          <ChevronRight className="w-5 h-5 text-foreground" />
        </button>
      </div>
      )}

      {bottomBar && (
        <div className="sticky bottom-0 z-10 bg-background border-t border-border">{bottomBar}</div>
      )}

      <Sheet open={!!activeSheet} onOpenChange={(o) => { if (!o) setActiveSheet(null); }}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[75dvh] overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-base font-black">{activeSheet?.title}</SheetTitle>
          </SheetHeader>
          <div className="mb-3">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/60">
                {es ? "Actual" : zh ? "当前" : "Current"}
              </p>
              {coachMode && activeSheet?.itemKey && activeReplaceOverride && (
                <button
                  type="button"
                  onClick={() => void restoreOriginal()}
                  disabled={pickingIdx !== null}
                  className="text-[10px] font-bold text-primary/80 underline disabled:opacity-40"
                >
                  {pickingIdx === -1
                    ? (es ? "Restaurando…" : zh ? "恢复中…" : "Restoring…")
                    : (es ? "Restaurar recomendación original" : zh ? "恢复引擎原始建议" : "Restore original recommendation")}
                </button>
              )}
            </div>
            <p className="text-sm font-semibold text-foreground/80">{activeSheet?.current}</p>
          </div>
          {activeSheet && activeSheet.alternatives.length > 0 ? (
            <div className="space-y-2">
              <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-muted-foreground/50">
                {es ? "Alternativas del motor" : zh ? "引擎备选" : "Engine alternatives"}
              </p>
              {activeSheet.alternatives.map((alt, idx) => {
                // Picker interactivo (spec 21.11): solo para deny/force/allow
                // (activeSheet.itemKey presente) y solo en modo entrenador --
                // la jugadora nunca puede reescribir su propio informe.
                const puedeElegir = coachMode && Boolean(activeSheet.itemKey);
                const yaElegida = activeReplaceOverride?.replacementValue === alt.text;
                const eligiendoEsta = pickingIdx === idx;
                const row = (
                  <div
                    className={cn(
                      "flex items-start justify-between gap-3 rounded-xl border px-4 py-3 transition-colors",
                      yaElegida
                        ? "border-primary bg-primary/5"
                        : "border-border/60 bg-card",
                      puedeElegir && !yaElegida && "active:bg-muted/40",
                    )}
                  >
                    <p className="flex-1 text-sm leading-snug text-foreground/85">{alt.text}</p>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs font-black tabular-nums text-muted-foreground/50">
                        {Math.round(alt.score * 100)}
                      </span>
                      {puedeElegir && (
                        <span
                          className={cn(
                            "text-[10px] font-bold uppercase tracking-wide",
                            yaElegida ? "text-primary" : "text-muted-foreground/50",
                          )}
                        >
                          {eligiendoEsta
                            ? "…"
                            : yaElegida
                              ? (es ? "Elegida ✓" : zh ? "已选 ✓" : "Chosen ✓")
                              : (es ? "Elegir esta" : zh ? "选择此项" : "Choose this")}
                        </span>
                      )}
                    </div>
                  </div>
                );
                if (!puedeElegir || yaElegida) {
                  return <div key={idx}>{row}</div>;
                }
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => void pickAlternative(alt, idx)}
                    disabled={pickingIdx !== null}
                    className="block w-full text-left disabled:opacity-60"
                  >
                    {row}
                  </button>
                );
              })}
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
// CORREGIDO 2026-09-13 (spec 23, PR-B): los 11 buckets Synergy de motor-v1 en
// vez de los 16 SituationId granulares de motor-v4. `pnrHandler`/`pnrRollMan`
// comparten el prefijo "pnr" a propósito -- mismo criterio que antes con
// `pnr_ball`/`pnr_screener` (mismo color para toda la familia PnR).
function situationColors(situacion: string): { border: string; text: string; bg: string } {
  if (situacion === "iso")        return { border: "border-l-orange-500", text: "text-orange-500 dark:text-orange-400", bg: "bg-orange-500/8" };
  if (situacion.startsWith("pnr"))return { border: "border-l-blue-500",   text: "text-blue-500 dark:text-blue-400",    bg: "bg-blue-500/8"   };
  if (situacion === "post")       return { border: "border-l-purple-500", text: "text-purple-500 dark:text-purple-400",bg: "bg-purple-500/8" };
  if (situacion === "spotUp")     return { border: "border-l-teal-500",   text: "text-teal-600 dark:text-teal-400",   bg: "bg-teal-500/8"   };
  if (situacion === "transition") return { border: "border-l-emerald-500",text: "text-emerald-600 dark:text-emerald-400",bg:"bg-emerald-500/8"};
  if (situacion === "offScreen")  return { border: "border-l-violet-500", text: "text-violet-500 dark:text-violet-400",bg: "bg-violet-500/8" };
  if (situacion === "handoff")    return { border: "border-l-cyan-500",   text: "text-cyan-600 dark:text-cyan-400",   bg: "bg-cyan-500/8"   };
  if (situacion === "putback")    return { border: "border-l-rose-500",   text: "text-rose-500 dark:text-rose-400",   bg: "bg-rose-500/8"   };
  return { border: "border-l-muted-foreground/30", text: "text-muted-foreground", bg: "" };
}

// ── Modo sencillo (punto 6, sesión 2026-09-07) ─────────────────────────────────────────
function CloseoutBadge(props: { report: CloseoutThreatReport; es: boolean; zh: boolean }) {
  const { report, es, zh } = props;

  if (report.light === "insufficient_data") {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70 mb-1">
          {es ? "Semáforo de cierre" : zh ? "补防信号灯" : "Closeout light"}
        </p>
        <p className="text-xs text-muted-foreground">
          {es
            ? "Sin datos de scouting suficientes todavía para el cierre."
            : zh
              ? "暂无足够的补防相关侦察数据。"
              : "Not enough scouting data yet for the closeout read."}
        </p>
      </div>
    );
  }

  const COLOR_MAP: Record<
    "red" | "yellow" | "green",
    { border: string; text: string; dot: string; label: string; desc: string }
  > = {
    red: {
      border: "border-l-red-500",
      text: "text-red-600 dark:text-red-400",
      dot: "bg-red-500",
      label: es ? "Cierra fuerte" : zh ? "全力补防" : "Close out hard",
      desc: es
        ? "Tira en el catch-and-shoot — contesta cada toque."
        : zh
          ? "接球即投——每次都要干扰出手。"
          : "Shoots on the catch — contest every touch.",
    },
    yellow: {
      border: "border-l-amber-500",
      text: "text-amber-600 dark:text-amber-400",
      dot: "bg-amber-500",
      label: es ? "Normal" : zh ? "正常" : "Normal",
      desc: es
        ? "Lectura mixta o frecuencia baja — cierre estándar."
        : zh
          ? "数据混合或频率较低——正常补防即可。"
          : "Mixed read or low frequency — standard closeout.",
    },
    green: {
      border: "border-l-emerald-500",
      text: "text-emerald-600 dark:text-emerald-400",
      dot: "bg-emerald-500",
      label: es ? "Puedes ayudar" : zh ? "可协防" : "Safe to help off",
      desc: es
        ? "No suele tirar en el catch — puedes dar un paso atrás."
        : zh
          ? "接球后很少出手——可以适当收缩协防。"
          : "Rarely shoots on the catch — you can sag off a step.",
    },
  };
  const c = COLOR_MAP[report.light];

  const handlerText = (() => {
    if (!report.handlerNote) return null;
    if (report.handlerNote.contradictsCloseout) {
      return es
        ? 'Tira bien en el catch, pero como manejadora prefiere penetrar — el "under" no la saca de su tiro porque no suele parar a lanzar de bote.'
        : zh
          ? "接球投篮不错，但作为挡拆持球人更倾向突破——防守走下线（under）无法限制她，因为她运球后很少选择跳投。"
          : 'Shoots well on the catch, but as a PnR handler she prefers to drive — going under the screen won\'t take her out of her shot, because she rarely pulls up off the dribble.';
    }
    if (report.handlerNote.lean === "drives") {
      return es
        ? "Como manejadora en el bloqueo, prefiere penetrar antes que tirar de bote."
        : zh
          ? "作为挡拆持球人，她更倾向于突破而不是运球跳投。"
          : "As a PnR handler, she prefers to drive rather than pull up off the dribble.";
    }
    if (report.handlerNote.lean === "shoots") {
      return es
        ? "Como manejadora, también lanza bien de bote — el \"under\" es arriesgado."
        : zh
          ? "作为挡拆持球人，她运球后跳投也很稳——防守走下线有风险。"
          : 'As a PnR handler, she also shoots well off the dribble — going under is risky.';
    }
    return es
      ? "Como manejadora, su reacción al bloqueo es variable."
      : zh
        ? "作为挡拆持球人，她的反应比较多变。"
        : "As a PnR handler, her reaction off the screen is mixed.";
  })();

  return (
    <div className={cn("rounded-2xl border border-border border-l-4 p-4 bg-card", c.border)}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", c.dot)} />
        <p className={cn("text-[10px] font-black uppercase tracking-widest", c.text)}>
          {es ? "Semáforo de cierre" : zh ? "补防信号灯" : "Closeout light"} — {c.label}
        </p>
      </div>
      <p className="text-sm font-semibold text-foreground/85 leading-snug">{c.desc}</p>
      {report.watchDrive && (
        <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-background/50 px-2.5 py-2">
          <Eye className="w-3.5 h-3.5 shrink-0 mt-0.5 text-muted-foreground" aria-hidden />
          <CornerRightDown className="w-3.5 h-3.5 shrink-0 mt-0.5 text-muted-foreground" aria-hidden />
          <p className="text-xs font-semibold text-muted-foreground">
            {es
              ? "Ojo: ataca el aro tras el cierre."
              : zh
                ? "注意：补防后她会攻击篮筐。"
                : "Watch: attacks the rim off the closeout."}
          </p>
        </div>
      )}
      {handlerText && (
        <div
          className={cn(
            "mt-2 rounded-lg px-2.5 py-2",
            report.handlerNote?.contradictsCloseout ? "bg-amber-500/10 border border-amber-500/25" : "bg-background/50",
          )}
        >
          <p className="text-xs font-semibold text-muted-foreground">{handlerText}</p>
        </div>
      )}
    </div>
  );
}

// CORREGIDO 2026-09-14 (spec 24, decisión directa de Pablo): reemplaza
// StatsStrip (PPG/3P%/FT Rate/TS% crudos, sin percentil, por fuera de
// motor-v1). Formato de chip según 10.3 ter -- 1-3 palabras, solo
// métrica+valor; la comparación contra la liga ("P85 en su posición") va en
// texto secundario visible siempre debajo, no oculta tras un tap (más simple
// que un sheet propio, y 10.3 ter no exige que esté oculta, solo que no
// compita visualmente con el valor principal).
const STAT_LABELS: Record<string, { en: string; es: string; zh: string }> = {
  ppg: { en: "PPG", es: "PPG", zh: "场均得分" },
  rpg: { en: "RPG", es: "RPG", zh: "场均篮板" },
  apg: { en: "APG", es: "APG", zh: "场均助攻" },
  spg: { en: "SPG", es: "SPG", zh: "场均抢断" },
  bpg: { en: "BPG", es: "BPG", zh: "场均盖帽" },
  fg3Pct: { en: "3P%", es: "3P%", zh: "三分命中率" },
  efgPct: { en: "eFG%", es: "eFG%", zh: "有效命中率" },
  tsPct: { en: "TS%", es: "TS%", zh: "真实命中率" },
  usgPct: { en: "USG%", es: "USG%", zh: "使用率" },
};

function statValueText(campo: string, valor: number): string {
  if (campo === "ppg" || campo === "rpg" || campo === "apg" || campo === "spg" || campo === "bpg") {
    return valor.toFixed(1);
  }
  return `${valor.toFixed(0)}%`;
}

function StatChip(props: { stat: StatDestacado; locale: "en" | "es" | "zh" }) {
  const { stat, locale } = props;
  const label = STAT_LABELS[stat.campo as string]?.[locale] ?? String(stat.campo);
  const es = locale === "es";
  const zh = locale === "zh";
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2 min-w-[76px]",
        stat.nivel === "elite" ? "border-primary/40 bg-primary/5" : "border-border bg-card",
      )}
    >
      <p className="text-sm font-black text-foreground tabular-nums leading-tight">
        {label} {statValueText(stat.campo as string, stat.stat.valor)}
      </p>
      <p className="text-[9px] font-semibold text-muted-foreground/70 leading-tight mt-0.5">
        {stat.nivel === "elite"
          ? (es ? "Élite" : zh ? "顶尖" : "Elite")
          : (es ? "Destacado" : zh ? "突出" : "Standout")}
        {" · "}
        {es ? `top ${Math.max(1, Math.round(100 - stat.stat.percentilAjustadoPorMuestra))}%` : zh ? `前${Math.max(1, Math.round(100 - stat.stat.percentilAjustadoPorMuestra))}%` : `top ${Math.max(1, Math.round(100 - stat.stat.percentilAjustadoPorMuestra))}%`}
      </p>
    </div>
  );
}

function StatsDestacadosRow(props: { statsDestacados: StatDestacado[]; locale: "en" | "es" | "zh" }) {
  if (props.statsDestacados.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {props.statsDestacados.map((s) => (
        <StatChip key={String(s.campo)} stat={s} locale={props.locale} />
      ))}
    </div>
  );
}

function QuietEdgeCallout(props: { quietEdge: QuietEdge | undefined; locale: "en" | "es" | "zh" }) {
  const { quietEdge, locale } = props;
  if (!quietEdge || quietEdge.seleccion.tipo !== "estadistico") return null; // solo tipo estadistico existe hoy (spec 24.3)
  const { campo, stat } = quietEdge.seleccion;
  const label = STAT_LABELS[campo as string]?.[locale] ?? String(campo);
  const es = locale === "es";
  const zh = locale === "zh";
  return (
    <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-primary/70 mb-1">
        {es ? "Dato inesperado" : zh ? "反常数据" : "Unexpected for her position"}
      </p>
      <p className="text-sm font-semibold text-foreground leading-snug">
        {label} {statValueText(campo as string, stat.valor)}
        {" — "}
        {es
          ? "poco común para su posición."
          : zh
            ? "对她的位置来说并不常见。"
            : "uncommon for her position."}
      </p>
    </div>
  );
}

function SimpleReportSlide(props: {
  player: { name: string; number?: string | number | null; imageUrl?: string | null };
  photo: boolean;
  finalReport: RenderedCompletoV1 | null;
  closeoutReport: CloseoutThreatReport | null;
  statsDestacados: StatDestacado[];
  quietEdge: QuietEdge | undefined;
  denyPorque: string | undefined;
  locale: "en" | "es" | "zh";
  es: boolean;
  zh: boolean;
}) {
  const { player, photo, finalReport, closeoutReport, statsDestacados, quietEdge, denyPorque, locale, es, zh } = props;
  const displayName = localName(player.name, (player as any).nameEn ?? (player as any).name_en, zh ? "zh" : es ? "es" : "en");
  if (!finalReport) return null;
  const topSituation = finalReport.situations[0];
  const denyInstruction = finalReport.defense.deny?.instruction;
  const esEstandar = finalReport.identity.nivelAmenaza === "estandar";

  return (
    <div className="px-4 pt-6 pb-24 space-y-3 max-w-lg mx-auto">
      <div className="flex items-center gap-4">
        <Suspense fallback={<div className="w-14 h-14 rounded-full bg-muted/40" />}>
          {photo ? (
            <img src={player.imageUrl ?? undefined} alt={displayName} className="w-14 h-14 rounded-full object-cover ring-2 ring-border shrink-0" />
          ) : (
            <div className="w-14 h-14 rounded-full overflow-hidden ring-2 ring-border shrink-0">
              <BasketballPlaceholderAvatar size={56} />
            </div>
          )}
        </Suspense>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-black text-foreground leading-tight truncate">{displayName}</p>
          <p className="text-xs font-bold text-primary/80 uppercase tracking-widest">{finalReport.identity.archetypeLabel}</p>
        </div>
      </div>

      {finalReport.identity.threat && (
        <div className={cn(
          "rounded-2xl border px-4 py-3",
          esEstandar ? "border-amber-400/30 bg-amber-400/5" : "border-destructive/30 bg-destructive/5",
        )}>
          <p className={cn(
            "text-[10px] font-black uppercase tracking-widest mb-1",
            esEstandar ? "text-amber-600 dark:text-amber-400" : "text-destructive/70",
          )}>
            {esEstandar
              ? (es ? "Sin amenaza clara" : zh ? "无明确威胁" : "No clear threat")
              : (es ? "Amenaza principal" : zh ? "主要威胁" : "Main threat")}
          </p>
          <p className="text-sm font-semibold text-foreground leading-snug">{finalReport.identity.threat}</p>
        </div>
      )}

      {topSituation && (
        <div className="rounded-2xl border border-border bg-card px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">
            {es ? "Lo que más hace" : zh ? "最常见进攻方式" : "What she does most"}
          </p>
          <p className="text-sm font-semibold text-foreground leading-snug">{topSituation.description}</p>
        </div>
      )}

      {denyInstruction && (
        <div className="rounded-2xl border border-border border-l-4 border-l-red-500 bg-red-500/8 px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-red-600 dark:text-red-400 mb-1">
            {es ? "Prioridad defensiva" : zh ? "防守重点" : "Defensive priority"}
          </p>
          <p className="text-sm font-semibold text-foreground/90 leading-snug">{denyInstruction}</p>
          {denyPorque && <p className="mt-1.5 text-xs text-red-600/70 dark:text-red-400/70 italic">{denyPorque}</p>}
        </div>
      )}

      {closeoutReport && <CloseoutBadge report={closeoutReport} es={es} zh={zh} />}

      <StatsDestacadosRow statsDestacados={statsDestacados} locale={locale} />
      <QuietEdgeCallout quietEdge={quietEdge} locale={locale} />
    </div>
  );
}
