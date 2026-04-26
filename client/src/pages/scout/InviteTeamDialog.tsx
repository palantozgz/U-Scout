import { useState, useEffect } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLocale } from "@/lib/i18n";
import { useCreateInvitation } from "@/lib/player-home";
import { cn } from "@/lib/utils";

type InviteRole = "coach" | "player";

export function InviteTeamDialog({
  teamId,
  teamName,
  open,
  onOpenChange,
}: {
  teamId: string | null;
  teamName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useLocale();
  const [role, setRole] = useState<InviteRole>("coach");
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const createInv = useCreateInvitation();

  useEffect(() => {
    if (!open) {
      setLink(null);
      setCopied(false);
      setRole("coach");
    }
  }, [open]);

  const handleGenerate = () => {
    if (!teamId) return;
    createInv.mutate(
      { teamId, role },
      {
        onSuccess: (data) => setLink(data.link),
      },
    );
  };

  const handleCopy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("invite_modal_title")}</DialogTitle>
          <DialogDescription>
            {teamName}
            <span className="block mt-2 text-xs">{t("invite_expires_note")}</span>
          </DialogDescription>
        </DialogHeader>

        {!link ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole("coach")}
                className={cn(
                  "rounded-xl border-2 p-3 text-sm font-bold transition-colors",
                  role === "coach"
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:border-primary/40",
                )}
              >
                {t("invite_role_staff")}
              </button>
              <button
                type="button"
                onClick={() => setRole("player")}
                className={cn(
                  "rounded-xl border-2 p-3 text-sm font-bold transition-colors",
                  role === "player"
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:border-primary/40",
                )}
              >
                {t("invite_role_player")}
              </button>
            </div>
            {createInv.isError && (
              <p className="text-sm text-destructive">
                {(createInv.error as Error)?.message || t("invite_create_error")}
              </p>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t("cancel")}
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={!teamId || createInv.isPending}
                className="font-bold"
                data-testid="invite-generate-button"
              >
                {createInv.isPending ? t("saving") : t("invite_generate")}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                {t("invite_link_label")}
              </p>
              <div className="rounded-lg border border-border bg-muted/40 p-3 break-all text-xs font-mono text-foreground">
                {link}
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="font-semibold">
                {t("close")}
              </Button>
              <Button onClick={handleCopy} className="font-bold gap-2" data-testid="invite-copy-button">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? t("invite_copied") : t("invite_copy")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
