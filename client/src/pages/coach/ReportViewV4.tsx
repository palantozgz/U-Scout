import { useMemo, useState } from "react";
import { ArrowLeft, MoreVertical, EyeOff, RotateCcw, AlertTriangle } from "lucide-react";
import { generateMotorV4 } from "@/lib/motor-v4";
import {
  renderReport,
  type RenderContext,
} from "@/lib/reportTextRenderer";
import {
  applyOverrides,
  buildOverrideRecord,
  type ReportOverride,
} from "@/lib/overrideEngine";
import {
  usePlayer,
  clubRowToMotorContext,
  playerInputToMotorInputs,
} from "@/lib/mock-data";
import { useLocale } from "@/lib/i18n";
import { useAuth } from "@/lib/useAuth";
import { useClub } from "@/lib/club-api";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn, isRealPhoto } from "@/lib/utils";
import { BasketballPlaceholderAvatar } from "@/components/BasketballPlaceholderAvatar";

export interface ReportViewV4Props {
  playerId: string;
  mode: "player" | "coach_review";
  onBack?: () => void;
}

export default function ReportViewV4({
  playerId,
  mode,
  onBack,
}: ReportViewV4Props) {
  const { t, locale } = useLocale();
  const { user } = useAuth();
  const { data: player, isLoading: playerLoading } = usePlayer(playerId);
  const clubQ = useClub({ enabled: Boolean(user) });
  const clubMotorCtx = useMemo(
    () => clubRowToMotorContext(clubQ.data?.club),
    [clubQ.data?.club],
  );
  const clubGender = clubQ.data?.club?.gender;
  const gender =
    clubGender === "F" ? "f" : clubGender === "M" ? "m" : "n";

  const [localOverrides, setLocalOverrides] = useState<ReportOverride[]>([]);
  const [activeSheet, setActiveSheet] = useState<{
    slide: string;
    itemKey: string;
    currentText: string;
    alternatives: { text: string; score: number }[];
  } | null>(null);
  const [isApproving, setIsApproving] = useState(false);

  const motorOutput = useMemo(() => {
    if (!player) return null;
    const inp = player.scoutingInputs ?? player.inputs;
    return generateMotorV4(playerInputToMotorInputs(inp), clubMotorCtx);
  }, [player, clubMotorCtx]);

  const ctx: RenderContext = {
    locale,
    gender,
  };

  const renderedBase = useMemo(() => {
    if (!motorOutput) return null;
    return renderReport(motorOutput, ctx);
  }, [motorOutput, locale, gender]);

  const renderedFinal = useMemo(() => {
    if (!renderedBase) return null;
    return applyOverrides(renderedBase, localOverrides);
  }, [renderedBase, localOverrides]);

  const isHidden = (itemKey: string) =>
    localOverrides.some((o) => o.itemKey === itemKey && o.action === "hide");

  const openSheet = (
    slide: string,
    itemKey: string,
    currentText: string,
    alternatives: { text: string; score: number }[],
  ) => {
    setActiveSheet({ slide, itemKey, currentText, alternatives });
  };

  const handleOverride = (
    slide: string,
    itemKey: string,
    action: "hide" | "replace",
    replacementValue?: string,
    _originalScore?: number,
    replacementScore?: number,
  ) => {
    const record = buildOverrideRecord({
      playerId,
      coachId: user?.id ?? "",
      slide,
      itemKey,
      action,
      replacementValue,
      originalScore: _originalScore,
      replacementScore,
      archetypeKey: motorOutput?.identity.archetypeKey,
      locale,
    });
    setLocalOverrides((prev) => {
      const filtered = prev.filter((o) => o.itemKey !== itemKey);
      return [...filtered, record as ReportOverride];
    });
    setActiveSheet(null);
  };

  const handleRestore = (itemKey: string) => {
    setLocalOverrides((prev) => prev.filter((o) => o.itemKey !== itemKey));
  };

  const handlePropose = async () => {
    setIsApproving(true);
    try {
      console.log("Proposing report with overrides:", localOverrides);
      if (onBack) onBack();
    } finally {
      setIsApproving(false);
    }
  };

  if (playerLoading || !player) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
        {t("saving")}
      </div>
    );
  }

  if (!renderedFinal || !motorOutput) {
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
  const subAlt = renderedFinal.identity.archetypeAlternatives[0];

  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="-ml-1 rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <div className="relative h-10 w-10 shrink-0">
          {photo ? (
            <>
              <div
                className="absolute inset-0 scale-110 rounded-full bg-primary/35 blur-md"
                aria-hidden
              />
              <img
                src={player.imageUrl!}
                alt=""
                className="relative h-10 w-10 rounded-full border border-primary/25 object-cover shadow-md ring-2 ring-primary/15"
              />
            </>
          ) : (
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
              <BasketballPlaceholderAvatar size={40} />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-extrabold text-foreground">
            {player.name?.trim() || t("dashboard_unnamed_player")}
          </h1>
          <p className="truncate text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {renderedFinal.identity.archetypeLabel}
          </p>
        </div>
        {mode === "coach_review" && (
          <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-1 text-xs font-black uppercase tracking-widest text-amber-500">
            {t("report_reviewing_badge")}
          </span>
        )}
      </div>

      {mode === "coach_review" && (
        <div className="mx-4 mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs font-medium text-amber-700 dark:text-amber-300">
          {t("report_review_banner")}
        </div>
      )}

      {/* CAPA 1 — Identidad */}
      <div className="px-4 pb-2 pt-5">
        {mode === "player" && isHidden("archetype") ? null : mode === "coach_review" &&
          isHidden("archetype") ? (
          <div className="mb-3 rounded-2xl border border-dashed border-muted-foreground/35 bg-muted/30 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground line-through">
                archetype
              </span>
              <button
                type="button"
                onClick={() => handleRestore("archetype")}
                className="flex items-center gap-1 text-xs font-bold text-primary"
              >
                <RotateCcw className="h-3 w-3" />
                {t("report_restore")}
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full rounded-2xl border border-primary/25 bg-primary/10 px-5 py-4">
            <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-primary">
              {t("archetype")}
            </p>
            <div className="flex items-start gap-2">
              {mode === "coach_review" && (
                <button
                  type="button"
                  onClick={() =>
                    openSheet(
                      "identity",
                      "archetype",
                      renderedFinal.identity.archetypeLabel,
                      renderedFinal.identity.archetypeAlternatives.map((a) => ({
                        text: a.label,
                        score: a.score,
                      })),
                    )
                  }
                  className="mt-1 shrink-0 rounded-md border border-transparent p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </button>
              )}
              <div
                className={cn(
                  "flex-1",
                  isHidden("archetype") && "opacity-45 line-through",
                )}
              >
                <p className="text-2xl font-black italic leading-tight text-foreground">
                  {renderedFinal.identity.archetypeLabel}
                </p>
                {subAlt && (
                  <p className="mt-1 text-xs font-bold uppercase tracking-widest text-primary/70">
                    {t("subarchetype")} {subAlt.label}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {mode === "player" && isHidden("tagline") ? null : (
          <div className="mt-3 flex items-start gap-2 px-1">
            {mode === "coach_review" && !isHidden("tagline") && (
              <button
                type="button"
                onClick={() =>
                  openSheet("identity", "tagline", renderedFinal.identity.tagline, [])
                }
                className="mt-0.5 shrink-0 rounded-md border border-transparent p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </button>
            )}
            {mode === "coach_review" && isHidden("tagline") ? (
              <div className="flex flex-1 items-center justify-between gap-2 rounded-lg border border-dashed border-muted-foreground/35 px-2 py-2">
                <span className="text-xs text-muted-foreground line-through">
                  tagline
                </span>
                <button
                  type="button"
                  onClick={() => handleRestore("tagline")}
                  className="flex items-center gap-1 text-xs font-bold text-primary"
                >
                  <RotateCcw className="h-3 w-3" />
                  {t("report_restore")}
                </button>
              </div>
            ) : (
              <p
                className={cn(
                  "flex-1 text-sm italic leading-relaxed text-muted-foreground",
                  isHidden("tagline") && "opacity-45 line-through",
                )}
              >
                {renderedFinal.identity.tagline}
              </p>
            )}
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <DangerBadge level={renderedFinal.identity.dangerLevel ?? 1} />
          <DifficultyBadge level={renderedFinal.identity.difficultyLevel ?? 1} />
        </div>
      </div>

      {/* CAPA 2 — Cómo ataca */}
      <div className="px-4 pb-1 pt-4">
        <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-teal-600 dark:text-teal-400">
          {t("report_how_attacks")}
        </p>
        <div className="space-y-2">
          {renderedFinal.situations.map((sit, idx) => {
            const key = `situations.${idx}`;
            const hidden = isHidden(key);
            if (mode === "player" && hidden) return null;
            const colors = situationColors(sit.id);
            return (
              <div
                key={`${sit.id}-${idx}`}
                className={cn(
                  "w-full overflow-hidden rounded-2xl border border-border bg-card/95 shadow-sm border-l-4",
                  colors.border,
                  hidden && "opacity-40",
                )}
              >
                <div className="px-4 py-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {mode === "coach_review" && (
                        <button
                          type="button"
                          onClick={() =>
                            openSheet("situations", key, sit.description, [])
                          }
                          className="rounded-md border border-transparent p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <TierBadge tier={sit.tier} />
                      <span
                        className={cn(
                          "text-[10px] font-black uppercase tracking-widest",
                          colors.text,
                        )}
                      >
                        {sit.label}
                      </span>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 text-sm font-black tabular-nums",
                        colors.text,
                      )}
                    >
                      {Math.round(sit.score * 100)}
                    </span>
                  </div>
                  <p
                    className={cn(
                      "text-sm font-semibold leading-snug text-foreground",
                      hidden && "line-through",
                    )}
                  >
                    {sit.description}
                  </p>
                  {mode === "coach_review" && hidden && (
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleRestore(key)}
                        className="flex items-center gap-1 text-xs font-bold text-primary"
                      >
                        <RotateCcw className="h-3 w-3" />
                        {t("report_restore")}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CAPA 3 — Defensa */}
      <div className="px-4 pb-1 pt-4">
        <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">
          {t("report_how_defend")}
        </p>
        <div className="space-y-2">
          {(["deny", "force", "allow"] as const).map((type) => {
            const instr = renderedFinal.defense[type];
            if (!instr) return null;
            const itemKey = `${type}.instruction`;
            const hidden = isHidden(itemKey);
            if (mode === "player" && hidden) return null;
            const defColors = {
              deny: {
                border: "border-l-red-500",
                text: "text-red-500",
              },
              force: {
                border: "border-l-blue-500",
                text: "text-blue-500",
              },
              allow: {
                border: "border-l-emerald-500",
                text: "text-emerald-500",
              },
            }[type];
            return (
              <div
                key={type}
                className={cn(
                  "w-full overflow-hidden rounded-2xl border border-border bg-card/95 shadow-sm border-l-4",
                  defColors.border,
                  hidden && "opacity-40",
                )}
              >
                <div className="px-4 py-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {mode === "coach_review" && (
                        <button
                          type="button"
                          onClick={() =>
                            openSheet(
                              "defense",
                              itemKey,
                              instr.instruction,
                              instr.alternatives.map((a) => ({
                                text: a.instruction,
                                score: a.score,
                              })),
                            )
                          }
                          className="rounded-md border border-transparent p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <span
                        className={cn(
                          "text-[10px] font-black uppercase tracking-widest",
                          defColors.text,
                        )}
                      >
                        {instr.label}
                      </span>
                    </div>
                  </div>
                  <p
                    className={cn(
                      "text-sm font-semibold leading-snug text-foreground",
                      hidden && "line-through",
                    )}
                  >
                    {instr.instruction}
                  </p>
                  {mode === "coach_review" && hidden && (
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleRestore(itemKey)}
                        className="flex items-center gap-1 text-xs font-bold text-primary"
                      >
                        <RotateCcw className="h-3 w-3" />
                        {t("report_restore")}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* AWARE */}
      {(renderedFinal.alerts.length ?? 0) > 0 && (
        <div className="px-4 pb-1 pt-4">
          <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
            {t("report_aware")}
          </p>
          <div className="space-y-2">
            {renderedFinal.alerts.map((alert, idx) => (
              <div
                key={idx}
                className="w-full overflow-hidden rounded-2xl border border-amber-500/30 bg-amber-500/5 shadow-sm border-l-4 border-l-amber-500"
              >
                <div className="flex items-start gap-3 px-4 py-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-black text-foreground">
                      {alert.text}
                    </p>
                    <p className="text-xs italic leading-snug text-amber-600 dark:text-amber-400">
                      {alert.triggerCue}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={mode === "coach_review" ? "h-28" : "h-10"} />

      <Sheet
        open={activeSheet !== null}
        onOpenChange={(open) => !open && setActiveSheet(null)}
      >
        <SheetContent
          side="bottom"
          className="max-h-[75vh] overflow-y-auto rounded-t-2xl px-4 pb-8"
        >
          <div className="mx-auto mb-4 mt-1 h-1 w-10 rounded-full bg-muted" />
          <SheetHeader className="pb-3 text-left">
            <SheetTitle className="text-base font-black">
              {t("report_modify_title")}
            </SheetTitle>
          </SheetHeader>

          <div className="mb-4 rounded-xl border border-border bg-muted/60 p-3">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {activeSheet?.currentText}
            </p>
          </div>

          {activeSheet && activeSheet.alternatives.length > 0 && (
            <div className="mb-4 space-y-2">
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {t("report_alternatives")}
              </p>
              {activeSheet.alternatives.map((alt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() =>
                    handleOverride(
                      activeSheet.slide,
                      activeSheet.itemKey,
                      "replace",
                      alt.text,
                      undefined,
                      alt.score,
                    )
                  }
                  className="w-full rounded-xl border border-border p-3 text-left transition-colors hover:border-primary hover:bg-primary/5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="flex-1 text-sm font-semibold leading-snug text-foreground">
                      {alt.text}
                    </p>
                    <span className="shrink-0 text-xs font-black tabular-nums text-muted-foreground">
                      {Math.round(alt.score * 100)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              if (!activeSheet) return;
              handleOverride(activeSheet.slide, activeSheet.itemKey, "hide");
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 p-3 text-sm font-bold text-red-500 hover:bg-red-500/5"
          >
            <EyeOff className="h-4 w-4" />
            {t("report_hide_element")}
          </button>
        </SheetContent>
      </Sheet>

      {mode === "coach_review" && (
        <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-background/95 px-4 py-3 backdrop-blur-sm">
          <Button
            className="h-11 w-full rounded-xl font-black"
            onClick={handlePropose}
            disabled={isApproving}
          >
            {isApproving ? t("report_sending") : t("report_propose_staff")}
          </Button>
        </div>
      )}
    </div>
  );
}

function situationColors(id: string): { border: string; text: string } {
  if (id.startsWith("iso"))
    return {
      border: "border-l-orange-500",
      text: "text-orange-600 dark:text-orange-400",
    };
  if (id.startsWith("pnr"))
    return {
      border: "border-l-blue-500",
      text: "text-blue-600 dark:text-blue-400",
    };
  if (id.startsWith("post"))
    return {
      border: "border-l-purple-500",
      text: "text-purple-600 dark:text-purple-400",
    };
  if (id === "catch_shoot")
    return {
      border: "border-l-teal-500",
      text: "text-teal-600 dark:text-teal-400",
    };
  if (id === "transition")
    return {
      border: "border-l-emerald-500",
      text: "text-emerald-600 dark:text-emerald-400",
    };
  if (id === "off_ball")
    return {
      border: "border-l-violet-500",
      text: "text-violet-600 dark:text-violet-400",
    };
  if (id === "floater")
    return {
      border: "border-l-cyan-500",
      text: "text-cyan-600 dark:text-cyan-400",
    };
  if (id === "oreb")
    return {
      border: "border-l-rose-500",
      text: "text-rose-600 dark:text-rose-400",
    };
  return {
    border: "border-l-muted-foreground",
    text: "text-muted-foreground",
  };
}

function DangerBadge({ level }: { level: number }) {
  const configs: { label: string; cls: string }[] = [
    { label: "", cls: "" },
    {
      label: "Low threat",
      cls: "text-muted-foreground bg-muted",
    },
    {
      label: "Moderate",
      cls: "text-yellow-700 dark:text-yellow-300 bg-yellow-500/10",
    },
    {
      label: "Dangerous",
      cls: "text-orange-700 dark:text-orange-300 bg-orange-500/10",
    },
    {
      label: "High danger",
      cls: "text-red-600 dark:text-red-400 bg-red-500/10",
    },
    {
      label: "Elite threat",
      cls: "text-red-700 dark:text-red-300 bg-red-500/20 font-black",
    },
  ];
  const safe = Math.min(Math.max(level, 1), 5);
  const c = configs[safe];
  return (
    <span
      className={cn(
        "rounded-full px-3 py-1 text-xs font-bold",
        c.cls || "text-muted-foreground bg-muted",
      )}
    >
      {"●".repeat(safe)} {c.label}
    </span>
  );
}

function DifficultyBadge({ level }: { level: number }) {
  const labels = ["", "Easy", "Moderate", "Challenging", "Hard", "Elite"];
  const safe = Math.min(Math.max(level, 1), 5);
  return (
    <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">
      {labels[safe] ?? labels[1]}
    </span>
  );
}

function TierBadge({ tier }: { tier: "primary" | "secondary" | "situational" }) {
  const styles = {
    primary: "bg-red-500/15 text-red-600 dark:text-red-400",
    secondary: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300",
    situational: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest",
        styles[tier],
      )}
    >
      {tier}
    </span>
  );
}
