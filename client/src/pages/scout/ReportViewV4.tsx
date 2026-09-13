import { useState, useMemo, useEffect, useRef } from "react";
import { Send } from "lucide-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useLocale } from "@/lib/i18n";
import {
  useApprovalStatus,
  useApproveReport,
  useUnapproveReport,
  invalidatePlayerApprovalQueries,
  serverOverridesToReportOverrides,
} from "@/lib/approval-api";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Check } from "lucide-react";
import { OverridePanel } from "@/components/scout/OverridePanel";
import ReportSlidesV1 from "@/pages/scout/ReportSlidesV1";
import { usePlayer } from "@/lib/mock-data";
import { type ReportOverride } from "@/lib/overrideEngine";
import { apiRequest } from "@/lib/queryClient";

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

function scoutVersionMeQueryKey(playerId: string) {
  return ["scout-version-me", playerId] as const;
}

export default function ReportViewV4({
  playerId,
  mode,
  onBack,
}: ReportViewV4Props) {
  const { t, locale } = useLocale();
  const [, setLocation] = useLocation();
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();
  const { data: player, isLoading: playerLoading } = usePlayer(playerId);

  const { data: approvalData } = useApprovalStatus(playerId, {
    enabled: Boolean(playerId),
    coachReviewMode: mode === "coach_review",
  });
  const approveReport = useApproveReport(playerId);
  const unapproveReport = useUnapproveReport(playerId);

  const { data: scoutMeData } = useQuery({
    queryKey: scoutVersionMeQueryKey(playerId),
    queryFn: async (): Promise<{ submitted: boolean }> =>
      (await apiRequest("GET", `/api/players/${encodeURIComponent(playerId)}/scout-version/me`)).json(),
    enabled: Boolean(playerId) && mode === "coach_review",
    refetchInterval: mode === "coach_review" ? 30_000 : false,
  });

  const coachId = profile?.id ?? user?.id ?? "";

  // CORREGIDO 2026-09-12 (picker de alternativas, spec 21.11): usaba un
  // mapeo propio que colapsaba cualquier action distinta de "hide" a
  // "approve_as_is" -- un "replace" real elegido en el picker se perdía
  // aquí y nunca llegaba a aplicarse. serverOverridesToReportOverrides ya
  // tiene el mapeo correcto (compartido, no duplicado).
  const myOverrides: ReportOverride[] = useMemo(() => {
    return serverOverridesToReportOverrides(approvalData?.overrides ?? [], playerId, coachId);
  }, [approvalData?.overrides, coachId, playerId]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sentFlash, setSentFlash] = useState(false);
  const navigateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (navigateTimerRef.current) clearTimeout(navigateTimerRef.current);
    };
  }, []);

  const handleSubmitToFilmRoom = async () => {
    setIsSubmitting(true);
    try {
      await authedFetch(
        `/api/players/${encodeURIComponent(playerId)}/scout-version/submit`,
        { method: "POST" },
      );
      setSentFlash(true);
      queryClient.invalidateQueries({ queryKey: scoutVersionMeQueryKey(playerId) });
      queryClient.invalidateQueries({ queryKey: ["/api/film-room"] });
      void invalidatePlayerApprovalQueries(queryClient, playerId);
      if (navigateTimerRef.current) clearTimeout(navigateTimerRef.current);
      navigateTimerRef.current = setTimeout(() => {
        navigateTimerRef.current = null;
        setSentFlash(false);
        setLocation("/coach/film-room");
      }, 900);
    } catch (e) {
      console.error("[ReportViewV4] submit to film room failed", e);
      setSentFlash(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (playerLoading || !player) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
        {t("saving")}
      </div>
    );
  }

  const es = locale === "es";
  const zh = locale === "zh";
  const isCanonicalProfile =
    (player as any).is_canonical === true ||
    (player as any).isCanonical === true;

  const serverSaysSubmitted = scoutMeData?.submitted === true;
  const submittedToFilmRoom = sentFlash || serverSaysSubmitted;

  const myId = profile?.id ?? user?.id ?? "";
  const iApproved = Boolean(approvalData?.approvals.some((a) => a.coachId === myId));
  const approvalCount = approvalData?.approvals.length ?? 0;
  const approvalTotal = Math.max(approvalData?.totalStaff ?? 0, 1);

  const onToggleApprove = () => {
    if (!myId) {
      toast({
        variant: "destructive",
        title: t("approval_approve_error"),
        description: t("approval_sign_in_required"),
      });
      return;
    }
    const opts = {
      onError: (e: Error) => {
        toast({ variant: "destructive", title: t("approval_approve_error"), description: e?.message ?? "" });
      },
    };
    if (iApproved) unapproveReport.mutate(undefined, opts);
    else approveReport.mutate(undefined, opts);
  };

  const approvalBar =
    mode === "coach_review" ? (
      <div className="px-4 py-3 space-y-2">
        {/* CORREGIDO 2026-09-14 (hallazgo real, spec 27): esta pantalla ya leía
            approvalData pero nunca exponía el botón para aprobar -- la única
            UI que lo hacía (ApprovalBar) vivía en una ruta muerta sin enlaces
            reales (/coach/player/:id/profile). Resultado: 0 aprobaciones en
            producción, nunca. Con el gate de >=1 aprobación de la sección 26
            ya en producción, esto bloqueaba publicar para cualquiera. */}
        <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2">
          <p className="text-xs font-semibold text-muted-foreground min-w-0">
            <span className="text-foreground font-bold tabular-nums">
              {`${approvalCount}/${approvalTotal}`}
            </span>{" "}
            {t("dashboard_player_coaches_label")}
            {approvalData?.hasDiscrepancy && (
              <Badge variant="destructive" className="ml-2 text-[10px] font-bold uppercase tracking-wide align-middle">
                {t("approval_discrepancy")}
              </Badge>
            )}
          </p>
          <Button
            type="button"
            variant={iApproved ? "default" : "outline"}
            size="sm"
            className={
              iApproved
                ? "font-bold shrink-0 border-0 bg-emerald-600 text-white hover:bg-emerald-700"
                : "font-bold shrink-0 border-border text-foreground hover:bg-muted"
            }
            disabled={approveReport.isPending || unapproveReport.isPending || !myId}
            onClick={onToggleApprove}
          >
            {iApproved ? (
              <>
                <Check className="w-4 h-4 mr-1 shrink-0" aria-hidden />
                {t("approval_btn_approved")}
              </>
            ) : (
              t("approval_btn_approve")
            )}
          </Button>
        </div>

        {/* Submission status */}
        <div
          className={`flex items-center gap-2 rounded-xl px-3 py-2 border ${
            submittedToFilmRoom
              ? "bg-emerald-500/10 border-emerald-500/20"
              : "bg-slate-500/10 border-slate-500/20"
          }`}
        >
          <span className="text-base leading-none">{submittedToFilmRoom ? "✅" : "📋"}</span>
          <div className="flex-1 min-w-0">
            <p
              className={`text-[11px] font-black uppercase tracking-wider leading-tight ${
                submittedToFilmRoom
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {submittedToFilmRoom
                ? es
                  ? "Enviado a la sala ✓"
                  : zh
                    ? "已发送至集体分析 ✓"
                    : "Sent to Film Room ✓"
                : es
                  ? "Borrador — solo visible para ti"
                  : zh
                    ? "草稿 — 仅你可见"
                    : "Draft — only visible to you"}
            </p>
            {!submittedToFilmRoom && (
              <p className="text-[10px] text-muted-foreground/60 leading-tight mt-0.5">
                {es
                  ? "Solo tú la ves. Envíala a la sala cuando estés listo."
                  : zh
                    ? "只有你能看到。完成后发送到集体分析。"
                    : "Only you can see this. Send to Film Room when ready."}
              </p>
            )}
          </div>
        </div>

        <OverridePanel
          playerId={playerId}
          coachId={profile?.id ?? user?.id ?? ""}
          locale={locale as "en" | "es" | "zh"}
          onOverrideChange={() => void invalidatePlayerApprovalQueries(queryClient, playerId)}
        />

        {isCanonicalProfile && (
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              variant="default"
              className="h-10 min-w-[8rem] rounded-xl px-4 font-bold text-sm bg-primary text-primary-foreground"
              onClick={() => void handleSubmitToFilmRoom()}
              disabled={isSubmitting || submittedToFilmRoom}
            >
              <Send className="w-4 h-4 mr-2 shrink-0" />
              {isSubmitting
                ? es
                  ? "Enviando..."
                  : zh
                    ? "发送中..."
                    : "Sending..."
                : submittedToFilmRoom || sentFlash
                  ? es
                    ? "Enviado ✓"
                    : zh
                      ? "已发送 ✓"
                      : "Sent ✓"
                  : es
                    ? "→ Sala de análisis"
                    : "→ Film Room"}
            </Button>
          </div>
        )}
      </div>
    ) : undefined;

  return (
    <ReportSlidesV1
      playerId={playerId}
      onBack={onBack}
      coachMode={mode === "coach_review"}
      bottomBar={approvalBar}
      overrides={mode === "coach_review" ? myOverrides : undefined}
    />
  );
}
