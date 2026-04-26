import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale } from "@/lib/i18n";
import {
  useApprovalStatus,
  invalidatePlayerApprovalQueries,
} from "@/lib/approval-api";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import ReportSlidesV1 from "@/pages/scout/ReportSlidesV1";
import { usePlayer } from "@/lib/mock-data";

export interface ReportViewV4Props {
  playerId: string;
  mode: "player" | "coach_review";
  onBack?: () => void;
}

async function authedFetch(url: string, init: RequestInit) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers as Record<string, string>),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${init.method ?? "GET"} ${url} → ${res.status}: ${text}`);
  }
  return res;
}

export default function ReportViewV4({
  playerId,
  mode,
  onBack,
}: ReportViewV4Props) {
  const { t, locale } = useLocale();
  const queryClient = useQueryClient();
  const { data: player, isLoading: playerLoading } = usePlayer(playerId);
  const [isApproving, setIsApproving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const { data: approvalData } = useApprovalStatus(playerId, {
    enabled: Boolean(playerId),
    coachReviewMode: mode === "coach_review",
  });

  const handlePropose = async () => {
    setIsApproving(true);
    try {
      await authedFetch(`/api/players/${encodeURIComponent(playerId)}/approve`, {
        method: "POST",
      });
      await invalidatePlayerApprovalQueries(queryClient, playerId);
      if (onBack) onBack();
    } catch (e) {
      console.error("[ReportViewV4] approve failed", e);
    } finally {
      setIsApproving(false);
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      await authedFetch(`/api/players/${encodeURIComponent(playerId)}/publish`, {
        method: "POST",
      });
      await invalidatePlayerApprovalQueries(queryClient, playerId);
    } catch (e) {
      console.error("[ReportViewV4] publish failed", e);
    } finally {
      setIsPublishing(false);
    }
  };

  if (playerLoading || !player) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
        {t("saving")}
      </div>
    );
  }

  const approvalCount = approvalData?.approvals.length ?? 0;
  const totalStaff = Math.max(approvalData?.totalStaff ?? 0, 1);
  const canPublish = approvalCount >= 1;

  const isPublished = approvalData?.isPublished ?? false;
  const stage: 1 | 2 | 3 = isPublished ? 3 : approvalCount >= 1 ? 2 : 1;

  const es = locale === "es";

  const approvalBar = mode === "coach_review" ? (
    <div className="px-4 py-3 space-y-2">
      {/* Status strip */}
      <div className={`flex items-center gap-2 rounded-xl px-3 py-2 ${
        stage === 3
          ? "bg-emerald-500/10 border border-emerald-500/20"
          : stage === 2
          ? "bg-blue-500/10 border border-blue-500/20"
          : "bg-slate-500/10 border border-slate-500/20"
      }`}>
        <span className="text-base leading-none">
          {stage === 3 ? "✅" : stage === 2 ? "👥" : "📋"}
        </span>
        <div className="flex-1 min-w-0">
          <p className={`text-[11px] font-black uppercase tracking-wider leading-tight ${
            stage === 3 ? "text-emerald-600 dark:text-emerald-400"
            : stage === 2 ? "text-blue-600 dark:text-blue-400"
            : "text-slate-500 dark:text-slate-400"
          }`}>
            {stage === 3
              ? (es ? "Publicado a jugadora" : "Published to player")
              : stage === 2
              ? (es ? `Aprobado · ${approvalCount}/${totalStaff} staff` : `Approved · ${approvalCount}/${totalStaff} staff`)
              : (es ? "Borrador privado" : "Private draft")}
          </p>
          <p className="text-[10px] text-muted-foreground/60 leading-tight mt-0.5">
            {stage === 3
              ? (es ? "La jugadora puede ver este informe" : "Player can view this report")
              : stage === 2
              ? (es ? "Listo para publicar" : "Ready to publish")
              : (es ? "Solo visible para el staff" : "Only visible to coaching staff")}
          </p>
        </div>
        <span className="shrink-0 text-[10px] font-bold tabular-nums text-muted-foreground/50">
          {approvalCount}/{totalStaff}
        </span>
      </div>

      {/* Discrepancy warning */}
      {approvalData?.hasDiscrepancy && (() => {
        // Find conflicting items: same slide+itemKey, different actions across coaches
        const byKey = new Map<string, { coaches: string[]; actions: string[] }>();
        for (const o of (approvalData.overrides ?? [])) {
          const k = `${o.slide}:${o.itemKey}`;
          if (!byKey.has(k)) byKey.set(k, { coaches: [], actions: [] });
          byKey.get(k)!.coaches.push(o.coachId);
          byKey.get(k)!.actions.push(o.action);
        }
        const conflicts = Array.from(byKey.entries())
          .filter(([, v]) => new Set(v.actions).size > 1)
          .map(([k]) => k.split(":")[1]);

        return (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 space-y-1">
            <p className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
              ⚠ {t("report_discrepancy_banner")}
            </p>
            {conflicts.length > 0 && (
              <p className="text-[10px] text-amber-700/80 dark:text-amber-400/80 leading-snug">
                {(locale === "es" ? "En conflicto: " : "Conflicting: ")}
                {conflicts.join(", ")}
              </p>
            )}
          </div>
        );
      })()}

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-2">
        {stage === 3 ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 rounded-lg px-4 font-bold text-xs border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400"
            onClick={() => {
              void authedFetch(`/api/players/${encodeURIComponent(playerId)}/unpublish`, { method: "POST" })
                .then(() => invalidatePlayerApprovalQueries(queryClient, playerId))
                .catch(console.error);
            }}
          >
            {es ? "Despublicar" : "Unpublish"}
          </Button>
        ) : (
          <>
            {stage === 2 && (
              <Button
                type="button"
                size="sm"
                variant="default"
                className="h-8 rounded-lg px-4 font-bold text-xs bg-emerald-600 hover:bg-emerald-700 border-emerald-600"
                onClick={() => void handlePublish()}
                disabled={isPublishing}
              >
                {isPublishing ? t("saving") : (es ? "📤 Publicar a jugadora" : "📤 Publish to player")}
              </Button>
            )}
            <Button
              size="sm"
              variant={stage === 1 ? "default" : "outline"}
              className="h-8 rounded-lg px-4 font-bold text-xs"
              onClick={() => void handlePropose()}
              disabled={isApproving}
            >
              {isApproving
                ? t("report_sending")
                : stage === 1
                ? (es ? "✓ Aprobar informe" : "✓ Approve report")
                : (es ? "Mi aprobación ✓" : "My approval ✓")}
            </Button>
          </>
        )}
      </div>
    </div>
  ) : undefined;

  return (
    <ReportSlidesV1
      playerId={playerId}
      onBack={onBack}
      coachMode={mode === "coach_review"}
      bottomBar={approvalBar}
    />
  );
}
