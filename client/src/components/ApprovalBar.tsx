import { useAuth } from "@/lib/useAuth";
import { useLocale } from "@/lib/i18n";
import {
  useApprovalStatus,
  useApproveReport,
  useUnapproveReport,
  usePublishReport,
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

  const myId = profile?.id ?? "";
  const iApproved = Boolean(data?.approvals.some((a) => a.coachId === myId));
  const count = data?.approvals.length ?? 0;
  const total = data?.totalStaff ?? 0;

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

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] border-t border-border bg-card/95 backdrop-blur-md px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_24px_hsl(var(--background)/0.6)] max-w-md mx-auto">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs font-semibold text-muted-foreground">
            <span className="text-foreground font-bold tabular-nums">
              {isLoading
                ? "—"
                : total > 0
                  ? `${count}/${total}`
                  : String(count)}
            </span>{" "}
            {t(total > 0 ? "approval_coaches_approved_suffix" : "approval_coaches_no_staff_suffix")}
          </p>
          {data?.hasDiscrepancy && (
            <Badge variant="destructive" className="text-[10px] font-bold uppercase tracking-wide shrink-0">
              {t("approval_discrepancy")}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={iApproved ? "secondary" : "default"}
            size="sm"
            className={
              iApproved
                ? "font-bold border border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
                : "font-bold"
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
          {count >= 1 && (
            <Button
              type="button"
              size="sm"
              className="font-bold flex-1"
              disabled={publish.isPending}
              onClick={onPublish}
            >
              {publish.isPending ? t("saving") : t("approval_publish")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
