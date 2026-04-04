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
import { Check } from "lucide-react";

export function ApprovalBar({ playerId }: { playerId: string }) {
  const { t } = useLocale();
  const { profile } = useAuth();
  const [, setLocation] = useLocation();
  const { data, isLoading } = useApprovalStatus(playerId);
  const approve = useApproveReport(playerId);
  const unapprove = useUnapproveReport(playerId);
  const publish = usePublishReport(playerId);
  const unpublish = useUnpublishReport(playerId);

  const myId = profile?.id ?? "";
  const iApproved = Boolean(data?.approvals.some((a) => a.coachId === myId));
  const count = data?.approvals.length ?? 0;
  const displayTotal = Math.max(data?.totalStaff ?? 0, 1);

  const onToggleApprove = () => {
    if (iApproved) {
      unapprove.mutate();
    } else {
      approve.mutate();
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

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] border-t border-border bg-card/95 backdrop-blur-md px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_24px_hsl(var(--background)/0.6)] max-w-md mx-auto">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs font-semibold text-muted-foreground">
            <span className="text-foreground font-bold tabular-nums">
              {isLoading ? "—" : `${count}/${displayTotal}`}
            </span>{" "}
            {t("dashboard_player_coaches_label")}
          </p>
          {data?.hasDiscrepancy && (
            <Badge variant="destructive" className="text-[10px] font-bold uppercase tracking-wide shrink-0">
              {t("approval_discrepancy")}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="default"
            size="sm"
            className={
              iApproved
                ? "font-bold shrink-0 bg-emerald-600 text-white hover:bg-emerald-700 border-0 shadow-sm"
                : "font-bold shrink-0"
            }
            disabled={approve.isPending || unapprove.isPending || !myId}
            onClick={onToggleApprove}
          >
            {iApproved ? (
              <>
                <Check className="w-4 h-4 mr-1 shrink-0" />
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
                className="text-[10px] font-bold h-8 px-2 gap-1 border-emerald-500/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
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
