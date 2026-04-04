import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { useLocale } from "@/lib/i18n";
import {
  useApprovalStatus,
  useApproveReport,
  useUnapproveReport,
  usePublishReport,
  useUnpublishReport,
} from "@/lib/approval-api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { toast } from "@/hooks/use-toast";
import { Check, HelpCircle } from "lucide-react";

/** localStorage key — shared with Profile onboarding banner */
export const APPROVAL_ONBOARDING_LS = "uscout_approval_onboarding_seen";

export function ApprovalBar({ playerId }: { playerId: string }) {
  const { t } = useLocale();
  const { user, profile } = useAuth();
  const [, setLocation] = useLocation();
  const [helpOpen, setHelpOpen] = useState(false);
  const helpWrapRef = useRef<HTMLDivElement>(null);

  const safePlayerId = typeof playerId === "string" ? playerId.trim() : "";
  const { data, isLoading } = useApprovalStatus(safePlayerId || undefined, {
    enabled: Boolean(safePlayerId),
  });
  const approve = useApproveReport(safePlayerId);
  const unapprove = useUnapproveReport(safePlayerId);
  const publish = usePublishReport(safePlayerId);
  const unpublish = useUnpublishReport(safePlayerId);

  const myId = profile?.id ?? user?.id ?? "";
  const iApproved = Boolean(data?.approvals.some((a) => a.coachId === myId));
  const count = data?.approvals.length ?? 0;
  const displayTotal = Math.max(data?.totalStaff ?? 0, 1);

  useEffect(() => {
    if (!helpOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const el = helpWrapRef.current;
      if (el && !el.contains(e.target as Node)) setHelpOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [helpOpen]);

  const onToggleApprove = () => {
    if (!safePlayerId) {
      toast({ variant: "destructive", title: t("approval_approve_error"), description: "Missing player id." });
      return;
    }
    if (!myId) {
      toast({ variant: "destructive", title: t("approval_approve_error"), description: t("approval_sign_in_required") });
      return;
    }
    const opts = {
      onError: (e: Error) => {
        toast({
          variant: "destructive",
          title: t("approval_approve_error"),
          description: e?.message ?? "",
        });
      },
    };
    if (iApproved) {
      unapprove.mutate(undefined, opts);
    } else {
      approve.mutate(undefined, opts);
    }
  };

  const onPublish = () => {
    if (!window.confirm(t("approval_publish_confirm"))) return;
    publish.mutate(undefined, {
      onSuccess: () => {
        toast({ title: t("approval_publish_success") });
        setLocation("/coach/editor");
      },
      onError: (e) => {
        toast({
          variant: "destructive",
          title: t("approval_publish_error"),
          description: (e as Error)?.message ?? "",
        });
      },
    });
  };

  const onUnpublish = () => {
    if (!window.confirm(t("approval_unpublish_confirm"))) return;
    unpublish.mutate(undefined, {
      onSuccess: () => {
        toast({ title: t("approval_unpublish_success") });
      },
      onError: (e) => {
        toast({
          variant: "destructive",
          title: t("approval_unpublish_error"),
          description: (e as Error)?.message ?? "",
        });
      },
    });
  };

  const isPublished = Boolean(data?.isPublished);

  const helpSteps = (
    <ul className="mt-2 space-y-2 text-xs text-muted-foreground">
      <li className="leading-snug">{t("onboarding_save_step")}</li>
      <li className="leading-snug">{t("onboarding_approve_step")}</li>
      <li className="leading-snug">{t("onboarding_publish_step")}</li>
    </ul>
  );

  if (!safePlayerId) {
    console.error("[ApprovalBar] missing playerId");
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] border-t border-border bg-card/95 backdrop-blur-md px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_24px_hsl(var(--background)/0.6)] max-w-md mx-auto">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1 min-w-0 flex-1">
            <p className="text-xs font-semibold text-muted-foreground min-w-0">
              <span className="text-foreground font-bold tabular-nums">
                {isLoading ? "—" : `${count}/${displayTotal}`}
              </span>{" "}
              {t("dashboard_player_coaches_label")}
            </p>
            <div className="relative shrink-0" ref={helpWrapRef}>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                aria-expanded={helpOpen}
                aria-label={t("onboarding_help_toggle")}
                onClick={() => setHelpOpen((v) => !v)}
              >
                <HelpCircle className="h-4 w-4" />
              </Button>
              {helpOpen && (
                <div
                  className="absolute bottom-full left-0 mb-2 w-[min(calc(100vw-2rem),18rem)] rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-md z-[110]"
                  role="dialog"
                  aria-label={t("onboarding_help_title")}
                >
                  <p className="text-xs font-bold text-foreground">{t("onboarding_help_title")}</p>
                  {helpSteps}
                </div>
              )}
            </div>
          </div>
          {data?.hasDiscrepancy && (
            <Badge variant="destructive" className="text-[10px] font-bold uppercase tracking-wide shrink-0">
              {t("approval_discrepancy")}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant={iApproved ? "default" : "outline"}
            size="sm"
            className={
              iApproved
                ? "font-bold shrink-0 border-0 bg-emerald-600 text-white hover:bg-emerald-700"
                : "font-bold shrink-0 border-border text-foreground hover:bg-muted"
            }
            disabled={approve.isPending || unapprove.isPending || !myId}
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
          {isPublished ? (
            <>
              <Badge
                variant="outline"
                className="text-[10px] font-bold h-8 px-2 gap-1 border-primary/40 bg-primary/10 text-primary"
              >
                <Check className="w-3.5 h-3.5" />
                {t("dashboard_player_published_badge")}
              </Badge>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-[10px] font-bold border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={unpublish.isPending}
                onClick={onUnpublish}
              >
                {unpublish.isPending ? t("saving") : t("approval_unpublish")}
              </Button>
            </>
          ) : (
            count >= 1 && (
              <Button
                type="button"
                size="sm"
                className="font-bold flex-1 min-w-0"
                disabled={publish.isPending}
                onClick={onPublish}
              >
                {publish.isPending ? t("saving") : t("approval_publish")}
              </Button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
