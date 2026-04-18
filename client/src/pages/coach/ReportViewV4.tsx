import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale } from "@/lib/i18n";
import {
  useApprovalStatus,
  invalidatePlayerApprovalQueries,
} from "@/lib/approval-api";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import ReportSlidesV1 from "@/pages/coach/ReportSlidesV1";
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
  const { t } = useLocale();
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

  return (
    <div className="relative min-h-[100dvh] bg-background">
      <ReportSlidesV1
        playerId={playerId}
        onBack={onBack}
        coachMode={mode === "coach_review"}
      />

      {/* Barra de aprobación compacta — solo coach_review */}
      {mode === "coach_review" && (
        <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-background/95 px-4 py-2.5 backdrop-blur-sm">
          {approvalData?.hasDiscrepancy && (
            <p className="mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-center text-[11px] font-medium text-amber-800 dark:text-amber-200">
              {t("report_discrepancy_banner")}
            </p>
          )}
          <div className="flex items-center gap-2">
            {/* Contador propuestas */}
            <span className="shrink-0 text-[11px] font-bold text-muted-foreground">
              {(approvalData?.approvals.length ?? 0)}/{Math.max(approvalData?.totalStaff ?? 0, 1)}
            </span>
            {/* Proponer */}
            <Button
              size="sm"
              className="h-8 flex-1 rounded-lg font-bold text-xs"
              onClick={() => void handlePropose()}
              disabled={isApproving}
            >
              {isApproving ? t("report_sending") : t("report_propose_staff")}
            </Button>
            {/* Publicar — solo si hay ≥1 aprobación */}
            {(approvalData?.approvals.length ?? 0) >= 1 && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8 flex-1 rounded-lg font-bold text-xs"
                onClick={() => void handlePublish()}
                disabled={isPublishing}
              >
                {isPublishing ? t("saving") : t("dashboard_player_publish")}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
