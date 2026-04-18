import { useMemo, useState, type ReactNode } from "react";
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
import { Badge } from "@/components/ui/badge";
import type { Locale } from "@/lib/i18n";

export interface ReportViewV4Props {
  playerId: string;
  mode: "player" | "coach_review";
  onBack?: () => void;
}

function sectionCopy(locale: Locale) {
  return {
    howAttacks:
      locale === "es"
        ? "Cómo ataca"
        : locale === "zh"
          ? "进攻特点"
          : "How they attack",
    howDefend:
      locale === "es"
        ? "Cómo defenderla"
        : locale === "zh"
          ? "防守要点"
          : "How to defend them",
    aware: "AWARE",
    reviewBanner:
      locale === "es"
        ? "Estás revisando este report. Toca ⋮ en cualquier bloque para modificarlo."
        : locale === "zh"
          ? "你正在审阅此报告。点 ⋮ 可修改任意区块。"
          : "You're reviewing this report. Tap ⋮ on any block to edit it.",
    reviewingBadge:
      locale === "es" ? "Revisando" : locale === "zh" ? "审阅中" : "Reviewing",
    modifyTitle:
      locale === "es" ? "Modificar" : locale === "zh" ? "修改" : "Modify",
    alternatives:
      locale === "es"
        ? "Alternativas"
        : locale === "zh"
          ? "备选"
          : "Alternatives",
    hide:
      locale === "es"
        ? "Ocultar este elemento"
        : locale === "zh"
          ? "隐藏此项"
          : "Hide this item",
    restore:
      locale === "es"
        ? "Restaurar"
        : locale === "zh"
          ? "恢复"
          : "Restore",
    propose:
      locale === "es"
        ? "Proponer esta versión al staff"
        : locale === "zh"
          ? "向团队提交此版本"
          : "Propose this version to staff",
    sending:
      locale === "es" ? "Enviando..." : locale === "zh" ? "提交中…" : "Sending...",
  };
}

export default function ReportViewV4({
  playerId,
  mode,
  onBack,
}: ReportViewV4Props) {
  const { t, locale } = useLocale();
  const copy = sectionCopy(locale);
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

  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background px-4 py-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-medium">
            {player.name?.trim() || t("dashboard_unnamed_player")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {renderedFinal.identity.archetypeLabel}
          </p>
        </div>
        {mode === "coach_review" && (
          <Badge className="text-xs">{copy.reviewingBadge}</Badge>
        )}
      </div>

      {mode === "coach_review" && (
        <div className="mx-4 mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          {copy.reviewBanner}
        </div>
      )}

      <ReportBlock
        slide="identity"
        itemKey="archetype"
        restoreLabel={copy.restore}
        mode={mode}
        isHidden={localOverrides.some(
          (o) => o.itemKey === "archetype" && o.action === "hide",
        )}
        isModified={localOverrides.some(
          (o) => o.itemKey === "archetype" && o.action === "replace",
        )}
        onKebabTap={() =>
          setActiveSheet({
            slide: "identity",
            itemKey: "archetype",
            currentText: renderedFinal.identity.archetypeLabel,
            alternatives: renderedFinal.identity.archetypeAlternatives.map(
              (a) => ({
                text: a.label,
                score: a.score,
              }),
            ),
          })
        }
        onRestore={() => handleRestore("archetype")}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-base font-medium">
              {renderedFinal.identity.archetypeLabel}
            </span>
            <DangerBadge level={renderedFinal.identity.dangerLevel} />
          </div>
          <p className="text-sm italic text-muted-foreground">
            {renderedFinal.identity.tagline}
          </p>
        </div>
      </ReportBlock>

      <SectionHeader label={copy.howAttacks} color="teal" />
      {renderedFinal.situations.map((sit, idx) => (
        <ReportBlock
          key={`${sit.id}-${idx}`}
          slide="situations"
          itemKey={`situations.${idx}`}
          restoreLabel={copy.restore}
          mode={mode}
          isHidden={localOverrides.some(
            (o) => o.itemKey === `situations.${idx}` && o.action === "hide",
          )}
          isModified={localOverrides.some(
            (o) => o.itemKey === `situations.${idx}` && o.action === "replace",
          )}
          onKebabTap={() =>
            setActiveSheet({
              slide: "situations",
              itemKey: `situations.${idx}`,
              currentText: sit.description,
              alternatives: [],
            })
          }
          onRestore={() => handleRestore(`situations.${idx}`)}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <TierBadge tier={sit.tier} />
              <span className="text-sm font-medium">{sit.label}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {Math.round(sit.score * 100)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{sit.description}</p>
          </div>
        </ReportBlock>
      ))}

      <SectionHeader label={copy.howDefend} color="blue" />
      {(["deny", "force", "allow"] as const).map((type) => {
        const instr = renderedFinal.defense[type];
        if (!instr) return null;
        return (
          <ReportBlock
            key={type}
            slide="defense"
            itemKey={`${type}.instruction`}
            restoreLabel={copy.restore}
            mode={mode}
            isHidden={localOverrides.some(
              (o) =>
                o.itemKey === `${type}.instruction` && o.action === "hide",
            )}
            isModified={localOverrides.some(
              (o) =>
                o.itemKey === `${type}.instruction` && o.action === "replace",
            )}
            onKebabTap={() =>
              setActiveSheet({
                slide: "defense",
                itemKey: `${type}.instruction`,
                currentText: instr.instruction,
                alternatives: instr.alternatives.map((a) => ({
                  text: a.instruction,
                  score: a.score,
                })),
              })
            }
            onRestore={() => handleRestore(`${type}.instruction`)}
          >
            <div className="space-y-1">
              <span
                className={`text-xs font-bold tracking-wider ${
                  type === "deny"
                    ? "text-blue-600 dark:text-blue-400"
                    : type === "force"
                      ? "text-blue-500 dark:text-blue-300"
                      : "text-blue-400 dark:text-blue-200"
                }`}
              >
                {instr.label}
              </span>
              <p className="text-sm font-medium">{instr.instruction}</p>
            </div>
          </ReportBlock>
        );
      })}

      {(renderedFinal.alerts?.length ?? 0) > 0 && (
        <div className="mx-4 my-2 space-y-2">
          <SectionHeader label={copy.aware} color="red" />
          {renderedFinal.alerts.map((alert, idx) => (
            <div
              key={idx}
              className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">
                    {alert.text}
                  </p>
                  <p className="text-xs italic text-red-600 dark:text-red-300">
                    {alert.triggerCue}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={mode === "coach_review" ? "h-32" : "h-8"} />

      <Sheet
        open={activeSheet !== null}
        onOpenChange={(open) => !open && setActiveSheet(null)}
      >
        <SheetContent
          side="bottom"
          className="max-h-[70vh] overflow-y-auto rounded-t-xl"
        >
          <SheetHeader className="pb-2">
            <SheetTitle className="text-base">{copy.modifyTitle}</SheetTitle>
          </SheetHeader>

          <div className="mb-3 rounded-lg bg-muted px-1 py-2">
            <p className="text-sm text-muted-foreground">
              {activeSheet?.currentText}
            </p>
          </div>

          {activeSheet && activeSheet.alternatives.length > 0 && (
            <div className="mb-4 space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {copy.alternatives}
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
                  className="w-full rounded-lg border border-border p-3 text-left transition-colors hover:border-primary hover:bg-primary/5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm">{alt.text}</p>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {Math.round(alt.score * 100)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            disabled={!activeSheet}
            onClick={() => {
              if (!activeSheet) return;
              handleOverride(activeSheet.slide, activeSheet.itemKey, "hide");
            }}
            className="flex w-full items-center gap-2 rounded-lg border border-red-200 p-3 text-sm text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
          >
            <EyeOff className="h-4 w-4" />
            {copy.hide}
          </button>
        </SheetContent>
      </Sheet>

      {mode === "coach_review" && (
        <div className="fixed bottom-0 left-0 right-0 z-20 space-y-2 border-t bg-background px-4 py-3">
          <Button
            className="w-full"
            onClick={handlePropose}
            disabled={isApproving}
          >
            {isApproving ? copy.sending : copy.propose}
          </Button>
        </div>
      )}
    </div>
  );
}

function ReportBlock({
  children,
  slide: _slide,
  itemKey,
  restoreLabel,
  mode,
  isHidden,
  isModified,
  onKebabTap,
  onRestore,
}: {
  children: ReactNode;
  slide: string;
  itemKey: string;
  restoreLabel: string;
  mode: "player" | "coach_review";
  isHidden: boolean;
  isModified: boolean;
  onKebabTap: () => void;
  onRestore: () => void;
}) {
  if (isHidden) {
    if (mode === "coach_review") {
      return (
        <div className="mx-4 my-1 rounded-lg border border-dashed border-muted-foreground/30 p-3 opacity-40">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground line-through">
              {itemKey}
            </span>
            <button
              type="button"
              onClick={onRestore}
              className="flex items-center gap-1 text-xs text-primary"
            >
              <RotateCcw className="h-3 w-3" />
              {restoreLabel}
            </button>
          </div>
        </div>
      );
    }
    return null;
  }

  return (
    <div
      className={`mx-4 my-2 rounded-lg border bg-card p-3 ${
        isModified ? "border-primary/50" : "border-border"
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1">{children}</div>
        {mode === "coach_review" && (
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={onKebabTap}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            {isModified && (
              <div className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionHeader({
  label,
  color,
}: {
  label: string;
  color: "teal" | "blue" | "red" | "purple";
}) {
  const colors = {
    teal: "text-teal-600 dark:text-teal-400",
    blue: "text-blue-600 dark:text-blue-400",
    red: "text-red-600 dark:text-red-400",
    purple: "text-purple-600 dark:text-purple-400",
  };
  return (
    <div
      className={`px-4 pb-1 pt-4 text-xs font-bold uppercase tracking-widest ${colors[color]}`}
    >
      {label}
    </div>
  );
}

function DangerBadge({ level }: { level: number }) {
  const colors = [
    "",
    "bg-gray-100 text-gray-600",
    "bg-yellow-100 text-yellow-700",
    "bg-orange-100 text-orange-700",
    "bg-red-100 text-red-700",
    "bg-red-200 text-red-800",
  ];
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-xs font-medium ${colors[level] ?? colors[1]}`}
    >
      {"●".repeat(level)}
    </span>
  );
}

function TierBadge({ tier }: { tier: "primary" | "secondary" | "situational" }) {
  const styles = {
    primary:
      "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
    secondary:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
    situational:
      "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  };
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-xs font-medium ${styles[tier]}`}
    >
      {tier}
    </span>
  );
}
