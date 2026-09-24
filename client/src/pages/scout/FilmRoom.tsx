import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight, Users2, AlertTriangle, CheckCircle2, Send, Lock, Check } from "lucide-react";
import { ModuleNav } from "@/pages/core/ModuleNav";
import { useLocale } from "@/lib/i18n";
import { useApprovalStatus, useSetReportOverride, type SetReportOverrideBody } from "@/lib/approval-api";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import type { PlayerProfile } from "@/lib/mock-data";
import { useAuth } from "@/lib/useAuth";
import { useClub, type ClubMemberDto } from "@/lib/club-api";
import { useCapabilities, type ClubMembership } from "@/lib/capabilities";
import { userDisplayLabel } from "@/lib/userDisplayLabel";

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
// AMPLIADO 2026-09-15 (spec 48). Antes solo listaba las opciones en conflicto
// como texto informativo -- sin ninguna forma de resolverlo salvo que los
// entrenadores hablaran fuera de la app y uno de ellos replicara a mano la
// opción acordada. Pregunta directa de Pablo: "antes del aprobado final,
// habria que dar una vez mas opcion de override a los supervisores no?" --
// sí. Ahora un supervisor (mismo permiso que ya controla el panel de
// Calibración/Nivel B, `canAccessCalibrationPanel`) puede adoptar, campo a
// campo, el pick de cualquier compañero -- se guarda como su PROPIO override
// (mismo endpoint que el picker de alternativas de siempre), así que el
// informe final puede combinar aciertos de varios entrenadores distintos
// antes de que alguien publique. No inventa ningún mecanismo nuevo: sigue
// siendo "quien publica, su estado actual es la versión final" (spec 47) --
// esto solo hace más fácil llegar a ese estado combinando picks ajenos.
type DiscrepancyOverrideRow = NonNullable<
  ReturnType<typeof useApprovalStatus>["data"]
>["overrides"][number];

function optionLabel(o: DiscrepancyOverrideRow, locale: string): string {
  if (o.action === "replace" && o.replacementValue) return o.replacementValue;
  if (o.action === "hide") return locale === "es" ? "Ocultar" : locale === "zh" ? "隐藏" : "Hide";
  if (o.action === "approve_as_is")
    return locale === "es" ? "Mantener la opción del motor" : locale === "zh" ? "保留系统建议" : "Keep the motor's pick";
  return o.action;
}

function DiscrepancyPanel({
  playerId,
  locale,
  members,
  canResolve,
  myCoachId,
}: {
  playerId: string;
  locale: string;
  members: ClubMemberDto[];
  canResolve: boolean;
  myCoachId: string | undefined;
}) {
  const { data: approvalData } = useApprovalStatus(playerId, { enabled: true });
  const setOverride = useSetReportOverride(playerId);

  const nameFor = (coachId: string) =>
    userDisplayLabel({
      userId: coachId,
      authFullName: members.find((m) => m.userId === coachId)?.authFullName,
      authEmail: members.find((m) => m.userId === coachId)?.authEmail,
      displayName: members.find((m) => m.userId === coachId)?.displayName,
      invitedEmail: members.find((m) => m.userId === coachId)?.invitedEmail,
    });

  if (!approvalData?.hasDiscrepancy) return null;

  const byKey = new Map<string, DiscrepancyOverrideRow[]>();
  for (const o of approvalData.overrides ?? []) {
    const k = `${o.slide}:${o.itemKey}`;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k)!.push(o);
  }
  const conflicts = Array.from(byKey.entries()).filter(([, rows]) => {
    const distinct = new Set(rows.map((r) => r.replacementKey ?? r.replacementValue ?? r.action));
    return distinct.size > 1;
  });

  if (conflicts.length === 0) return null;

  return (
    <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/8 px-3 py-2 space-y-2">
      <p className="text-[10px] md:text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
        ⚠ {locale === "es" ? "Discrepancias" : locale === "zh" ? "分歧" : "Discrepancies"}
      </p>
      {canResolve && (
        <p className="text-[10px] md:text-xs text-muted-foreground/70 leading-relaxed">
          {locale === "es"
            ? "Puedes adoptar la opción de un compañero campo a campo — se guarda en tu versión, la que se publica si publicas tú."
            : locale === "zh"
              ? "你可以逐项采用同事的选择——会保存到你的版本中，如果由你发布，这就是最终版本。"
              : "You can adopt a colleague's pick field by field — it's saved to your version, the one that gets published if you publish."}
        </p>
      )}
      {conflicts.map(([key, rows]) => {
        const [slideKey, itemLabel] = key.split(":");
        const byValue = new Map<string, DiscrepancyOverrideRow[]>();
        for (const r of rows) {
          const vk = r.replacementKey ?? r.replacementValue ?? r.action;
          if (!byValue.has(vk)) byValue.set(vk, []);
          byValue.get(vk)!.push(r);
        }
        const myRow = myCoachId ? rows.find((r) => r.coachId === myCoachId) : undefined;
        const myValueKey = myRow ? (myRow.replacementKey ?? myRow.replacementValue ?? myRow.action) : undefined;

        return (
          <div key={key} className="rounded-md bg-background/50 px-2 py-1.5 space-y-1.5">
            <p className="text-[11px] md:text-sm font-bold text-foreground">{itemLabel}</p>
            <div className="space-y-1">
              {Array.from(byValue.entries()).map(([valueKey, valueRows]) => {
                const sample = valueRows[0];
                const isMine = valueKey === myValueKey;
                const names = valueRows.map((r) => nameFor(r.coachId)).join(", ");
                return (
                  <div
                    key={valueKey}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-md px-2 py-1.5",
                      isMine ? "bg-primary/10 border border-primary/30" : "bg-muted/30",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] md:text-sm font-semibold text-foreground truncate flex items-center gap-1">
                        {isMine && <Check className="w-3 h-3 text-primary shrink-0" />}
                        {optionLabel(sample, locale)}
                      </p>
                      <p className="text-[10px] md:text-xs text-muted-foreground/70 truncate">{names}</p>
                    </div>
                    {canResolve && !isMine && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-[10px] md:text-xs shrink-0"
                        disabled={setOverride.isPending}
                        data-testid={`filmroom-override-use-${key}-${valueKey}`}
                        onClick={() =>
                          setOverride.mutate({
                            slide: slideKey as SetReportOverrideBody["slide"],
                            itemKey: itemLabel,
                            action: sample.action as SetReportOverrideBody["action"],
                            replacementValue: sample.replacementValue,
                            replacementKey: sample.replacementKey,
                            originalScore: sample.originalScore,
                            replacementScore: sample.replacementScore,
                            archetypeKey: sample.archetypeKey,
                            locale: (sample.locale as SetReportOverrideBody["locale"]) ?? (locale as SetReportOverrideBody["locale"]),
                          })
                        }
                      >
                        {locale === "es" ? "Usar esta" : locale === "zh" ? "采用" : "Use this"}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Player card ───────────────────────────────────────────────────────────────
function FilmRoomCard({
  entry,
  locale,
  onViewReport,
  onPublish,
  isPublishing,
  members,
  canResolve,
  myCoachId,
}: {
  entry: FilmRoomEntry;
  locale: string;
  onViewReport: (id: string) => void;
  onPublish: (id: string) => void;
  isPublishing: boolean;
  members: ClubMemberDto[];
  canResolve: boolean;
  myCoachId: string | undefined;
}) {
  const [expanded, setExpanded] = useState(false);
  const { player, submittedCount, hasDiscrepancy, isPublished, approvalCount, hasSubmittedMine } = entry;

  const { data: approvalStatus } = useApprovalStatus(player.id, {
    enabled: expanded && hasSubmittedMine,
  });
  const totalStaff = approvalStatus?.totalStaff ?? entry.submittedCount;

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
        data-testid={`filmroom-card-toggle-${player.id}`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-extrabold text-foreground truncate">
              {player.name || "—"}
            </p>
            <span className={cn("inline-flex items-center gap-1 text-[10px] md:text-xs font-black uppercase tracking-wider", statusColor)}>
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
              <p className="text-[11px] md:text-sm font-semibold text-muted-foreground">
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
            <DiscrepancyPanel
              playerId={player.id}
              locale={locale}
              members={members}
              canResolve={canResolve}
              myCoachId={myCoachId}
            />
          )}

          {/* Staff submissions summary */}
          {hasSubmittedMine && (
            <div className="flex items-center justify-between text-[11px] md:text-sm">
              <span className="text-muted-foreground font-semibold">
                {es ? "Staff aprobado:" : zh ? "已批准员工:" : "Staff approved:"}
              </span>
              <span className="font-black text-foreground">
                {approvalCount}/{totalStaff}
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-11 rounded-lg text-xs font-bold"
              onClick={() => onViewReport(player.id)}
              data-testid={`filmroom-view-report-${player.id}`}
            >
              {es ? "Ver informe" : zh ? "查看报告" : "View report"}
            </Button>
            {!isPublished && hasSubmittedMine && (
              <Button
                size="sm"
                variant="default"
                className="flex-1 h-11 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 border-emerald-600"
                disabled={isPublishing}
                onClick={() => onPublish(player.id)}
                data-testid={`filmroom-publish-${player.id}`}
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
  const qc = useQueryClient();
  const { profile } = useAuth();

  const [publishingId, setPublishingId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<{ players: FilmRoomEntry[] }>({
    queryKey: ["/api/film-room"],
    queryFn: async () => (await apiRequest("GET", "/api/film-room")).json(),
    refetchInterval: 30_000,
  });

  // AÑADIDO 2026-09-15 (spec 48): necesario para resolver nombres de
  // compañeros en DiscrepancyPanel y para saber si el usuario actual es
  // "supervisor" (mismo permiso que ya controla el panel de Calibración).
  const clubQ = useClub({ enabled: Boolean(profile) });
  const membership: ClubMembership | null = useMemo(() => {
    if (!profile?.id || !clubQ.data?.club) return null;
    const me = clubQ.data.members?.find((m) => m.userId === profile.id);
    if (!me) return null;
    return {
      clubId: clubQ.data.club.id,
      userId: profile.id,
      role: me.role as ClubMembership["role"],
      status: me.status as ClubMembership["status"],
      isOwner: clubQ.data.club.ownerId === profile.id,
      operationsAccess: Boolean(me.operationsAccess),
      reportPublishAccess: Boolean(me.reportPublishAccess),
    };
  }, [profile?.id, clubQ.data]);
  const caps = useCapabilities({ membership });
  const members = clubQ.data?.members ?? [];

  const es = locale === "es";
  const zh = locale === "zh";

  const handlePublish = async (playerId: string) => {
    setPublishingId(playerId);
    // Optimistic: mark as published immediately in film-room cache
    qc.setQueryData<{ players: FilmRoomEntry[] }>(["/api/film-room"], (old) => {
      if (!old) return old;
      return {
        players: old.players.map((e) =>
          e.player.id === playerId ? { ...e, isPublished: true } : e
        ),
      };
    });
    try {
      await apiRequest("POST", `/api/players/${playerId}/game-plan`);
    } catch (err) {
      // Rollback on error
      qc.invalidateQueries({ queryKey: ["/api/film-room"] });
      console.error("publish failed", err);
      // CORREGIDO 2026-09-14 (spec motor-1.0 sección 25.1/26): el servidor
      // ahora puede rechazar la publicación por falta de aprobación (≥1
      // entrenador) o por falta de permiso de club -- antes fallaba en
      // silencio, solo con el rollback optimista. Mensaje específico en vez
      // de un fallo mudo.
      const raw = err instanceof Error ? err.message : String(err);
      const noApproval = raw.includes("coach approval is required");
      const noPermission = raw.includes("don't have permission to publish");
      toast({
        description: noApproval
          ? (es
              ? "Hace falta al menos una aprobación de un entrenador antes de publicar."
              : zh
                ? "发布前需要至少一位教练的批准。"
                : "At least one coach approval is required before publishing.")
          : noPermission
            ? (es
                ? "No tienes permiso para publicar informes -- pídeselo al head coach en Mi Club."
                : zh
                  ? "你没有发布报告的权限 -- 请在“我的俱乐部”中向主教练申请。"
                  : "You don't have permission to publish reports -- ask your head coach in My Club.")
            : (es ? "No se pudo publicar el informe." : zh ? "无法发布报告。" : "Could not publish the report."),
        variant: "destructive" as any,
      });
    } finally {
      setPublishingId(null);
      // Background refresh to sync real state
      qc.invalidateQueries({ queryKey: ["/api/film-room"] });
      qc.invalidateQueries({ queryKey: ["/api/players"] });
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-background pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
      <header className="sticky top-0 z-10 bg-background border-b border-border px-4 py-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setLocation("/coach")}
          data-testid="filmroom-header-back"
          className="-ml-1 p-3 rounded-lg text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-black text-foreground tracking-tight">
            {zh ? "集体分析" : es ? "Sala de análisis" : "Film Room"}
          </h1>
          <p className="text-[10px] md:text-sm text-muted-foreground font-medium">
            {zh ? "集体审核 · 解决分歧" : es ? "Revisión colectiva · resolver discrepancias" : "Collective review · resolve discrepancies"}
          </p>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 landscape:py-2 space-y-3 max-w-5xl mx-auto w-full overflow-y-auto min-h-0">
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
            {/* AÑADIDO 2026-09-15 (pasada de fricción/cosmética): el texto ya decía
                a dónde ir, pero no había ningún botón -- el usuario tenía que
                volver atrás y encontrar Mi Scout por su cuenta. Mismo patrón
                aplicado en GamePlan.tsx y MyScout.tsx. */}
            <Button size="sm" variant="outline" className="mt-1 rounded-lg" onClick={() => setLocation("/coach/my-scout")} data-testid="filmroom-go-myscout">
              {es ? "Ir a Mi Scout" : zh ? "前往我的报告" : "Go to My Scout"}
            </Button>
          </div>
        )}

        {(data?.players ?? []).map((entry) => (
          <FilmRoomCard
            key={entry.player.id}
            entry={entry}
            locale={locale}
            onViewReport={(id) => setLocation(`/coach/scout/${id}/review`)}
            onPublish={handlePublish}
            isPublishing={publishingId === entry.player.id}
            members={members}
            canResolve={caps.canAccessCalibrationPanel}
            myCoachId={profile?.id}
          />
        ))}
      </main>
      <ModuleNav />
    </div>
  );
}

