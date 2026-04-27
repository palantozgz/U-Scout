import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight, Users2, AlertTriangle, CheckCircle2, Send, Lock } from "lucide-react";
import { ModuleNav } from "@/pages/core/ModuleNav";
import { useLocale } from "@/lib/i18n";
import { useAuth } from "@/lib/useAuth";
import { useApprovalStatus } from "@/lib/approval-api";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { PlayerProfile } from "@/lib/mock-data";

// ── Types ─────────────────────────────────────────────────────────────────────
interface FilmRoomEntry {
  player: PlayerProfile & { is_canonical?: boolean };
  submittedCount: number;
  totalVersions: number;
  hasSubmittedMine: boolean;
  isPublished: boolean;
  hasDiscrepancy: boolean;
  approvalCount: number;
}

// ── Discrepancy panel ─────────────────────────────────────────────────────────
function DiscrepancyPanel({
  playerId,
  locale,
}: {
  playerId: string;
  locale: string;
}) {
  const { data: approvalData } = useApprovalStatus(playerId, { enabled: true });

  if (!approvalData?.hasDiscrepancy) return null;

  const byKey = new Map<string, { coaches: string[]; actions: string[] }>();
  for (const o of approvalData.overrides ?? []) {
    const k = `${o.slide}:${o.itemKey}`;
    if (!byKey.has(k)) byKey.set(k, { coaches: [], actions: [] });
    byKey.get(k)!.coaches.push(o.coachId);
    byKey.get(k)!.actions.push(o.action);
  }
  const conflicts = Array.from(byKey.entries()).filter(
    ([, v]) => new Set(v.actions).size > 1,
  );

  if (conflicts.length === 0) return null;

  return (
    <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/8 px-3 py-2 space-y-2">
      <p className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
        ⚠ {locale === "es" ? "Discrepancias" : locale === "zh" ? "分歧" : "Discrepancies"}
      </p>
      {conflicts.map(([key, v]) => {
        const itemLabel = key.split(":")[1];
        const uniqueActions = Array.from(new Set(v.actions));
        return (
          <div key={key} className="rounded-md bg-background/50 px-2 py-1.5 space-y-0.5">
            <p className="text-[11px] font-bold text-foreground">{itemLabel}</p>
            <div className="flex flex-wrap gap-1">
              {uniqueActions.map((action) => (
                <span
                  key={action}
                  className="text-[10px] px-1.5 py-0.5 rounded-full border border-border font-semibold text-muted-foreground"
                >
                  {action}
                </span>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground/60">
              {v.coaches.length}{" "}
              {locale === "es" ? "coaches en conflicto" : locale === "zh" ? "教练有分歧" : "coaches disagree"}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ── Player card ───────────────────────────────────────────────────────────────
function FilmRoomCard({
  entry,
  isHeadCoach,
  locale,
  onViewReport,
  onPublish,
  isPublishing,
}: {
  entry: FilmRoomEntry;
  isHeadCoach: boolean;
  locale: string;
  onViewReport: (id: string) => void;
  onPublish: (id: string) => void;
  isPublishing: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const { player, submittedCount, hasDiscrepancy, isPublished, approvalCount, hasSubmittedMine } = entry;

  const es = locale === "es";
  const zh = locale === "zh";

  const statusColor = isPublished
    ? "text-emerald-600 dark:text-emerald-400"
    : hasDiscrepancy
    ? "text-amber-600 dark:text-amber-400"
    : "text-blue-600 dark:text-blue-400";

  const statusLabel = isPublished
    ? (es ? "Publicado" : zh ? "已发布" : "Published")
    : hasDiscrepancy
    ? (es ? "Con discrepancias" : zh ? "有分歧" : "Has discrepancies")
    : (es ? "En revisión" : zh ? "审核中" : "Under review");

  const statusIcon = isPublished
    ? <CheckCircle2 className="w-3.5 h-3.5" />
    : hasDiscrepancy
    ? <AlertTriangle className="w-3.5 h-3.5" />
    : <Users2 className="w-3.5 h-3.5" />;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Main row */}
      <button
        type="button"
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-extrabold text-foreground truncate">
              {player.name || "—"}
            </p>
            <span className={cn("inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider", statusColor)}>
              {statusIcon}
              {statusLabel}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            #{player.number || "—"} · {" "}
            {submittedCount}{" "}
            {es ? "informes entregados" : zh ? "份报告已提交" : "reports submitted"}
            {hasDiscrepancy && (
              <span className="ml-2 text-amber-600 dark:text-amber-400 font-bold">
                ⚠ {es ? "conflicto" : zh ? "冲突" : "conflict"}
              </span>
            )}
          </p>
        </div>
        <ChevronRight
          className={cn(
            "w-4 h-4 text-muted-foreground transition-transform shrink-0",
            expanded && "rotate-90",
          )}
        />
      </button>

      {/* Expanded */}
      {expanded && (
        <div className="border-t border-border px-4 py-3 space-y-3 bg-background/40">

          {/* Anti-bias notice */}
          {!hasSubmittedMine && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
              <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <p className="text-[11px] font-semibold text-muted-foreground">
                {es
                  ? "Entrega tu informe para ver los detalles del equipo"
                  : zh
                  ? "提交您的报告以查看团队详细信息"
                  : "Submit your report to see team details"}
              </p>
            </div>
          )}

          {/* Discrepancy panel — only visible after submitting own report */}
          {hasSubmittedMine && hasDiscrepancy && (
            <DiscrepancyPanel playerId={player.id} locale={locale} />
          )}

          {/* Staff submissions summary */}
          {hasSubmittedMine && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground font-semibold">
                {es ? "Staff aprobado:" : zh ? "已批准员工:" : "Staff approved:"}
              </span>
              <span className="font-black text-foreground">
                {approvalCount}/{entry.submittedCount}
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 rounded-lg text-xs font-bold"
              onClick={() => onViewReport(player.id)}
            >
              {es ? "Ver informe" : zh ? "查看报告" : "View report"}
            </Button>
            {isHeadCoach && !isPublished && hasSubmittedMine && (
              <Button
                size="sm"
                variant="default"
                className="flex-1 h-8 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 border-emerald-600"
                disabled={isPublishing}
                onClick={() => onPublish(player.id)}
              >
                <Send className="w-3 h-3 mr-1" />
                {isPublishing
                  ? (es ? "Publicando..." : zh ? "发布中..." : "Publishing...")
                  : (es ? "→ Game Plan" : zh ? "→ 比赛方案" : "→ Game Plan")}
              </Button>
            )}
            {isPublished && (
              <span className="flex-1 text-center text-[11px] font-black text-emerald-600 dark:text-emerald-400">
                ✅ {es ? "En Game Plan" : zh ? "已在比赛方案" : "In Game Plan"}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function FilmRoom() {
  const [, setLocation] = useLocation();
  const { locale } = useLocale();
  const { profile } = useAuth();
  const qc = useQueryClient();

  const isHeadCoach = profile?.role === "head_coach" || profile?.role === "master";
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<{ players: FilmRoomEntry[] }>({
    queryKey: ["/api/film-room"],
    queryFn: async () => (await apiRequest("GET", "/api/film-room")).json(),
    refetchInterval: 30_000,
  });

  const es = locale === "es";
  const zh = locale === "zh";

  const handlePublish = async (playerId: string) => {
    setPublishingId(playerId);
    try {
      await apiRequest("POST", `/api/players/${playerId}/game-plan`);
      await qc.invalidateQueries({ queryKey: ["/api/film-room"] });
      await qc.invalidateQueries({ queryKey: ["/api/players"] });
    } finally {
      setPublishingId(null);
    }
  };

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background pb-16">
      <header className="sticky top-0 z-10 bg-background border-b border-border px-4 py-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setLocation("/coach")}
          className="-ml-1 p-1 rounded-lg text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-black text-foreground tracking-tight">
            {zh ? "集体分析" : es ? "Sala de análisis" : "Film Room"}
          </h1>
          <p className="text-[10px] text-muted-foreground font-medium">
            {zh ? "集体审核 · 解决分歧" : es ? "Revisión colectiva · resolver discrepancias" : "Collective review · resolve discrepancies"}
          </p>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 space-y-3 max-w-md mx-auto w-full">
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive text-center py-8">
            {es ? "Error al cargar la sala de análisis" : "Failed to load Film Room"}
          </p>
        )}

        {!isLoading && !error && (data?.players.length ?? 0) === 0 && (
          <div className="text-center py-16 space-y-2">
            <Users2 className="w-10 h-10 text-muted-foreground/30 mx-auto" />
            <p className="text-sm text-muted-foreground font-semibold">
              {es
                ? "Sin informes entregados al equipo todavía"
                : zh
                ? "暂无提交给团队的报告"
                : "No reports submitted to the team yet"}
            </p>
            <p className="text-xs text-muted-foreground/60">
              {es
                ? "Entrega tus informes desde Mi Scout para que aparezcan aquí"
                : zh
                ? "从我的报告中提交，报告将显示在此处"
                : "Submit reports from My Scout to see them here"}
            </p>
          </div>
        )}

        {(data?.players ?? []).map((entry) => (
          <FilmRoomCard
            key={entry.player.id}
            entry={entry}
            isHeadCoach={isHeadCoach}
            locale={locale}
            onViewReport={(id) => setLocation(`/coach/scout/${id}/review`)}
            onPublish={handlePublish}
            isPublishing={publishingId === entry.player.id}
          />
        ))}
      </main>
      <ModuleNav />
    </div>
  );
}

