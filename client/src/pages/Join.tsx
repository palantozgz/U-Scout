import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/i18n";
import { useAuth } from "@/lib/useAuth";
import { fetchInvitationPublic, useAcceptInvitation } from "@/lib/player-home";

export default function JoinPage() {
  const { t } = useLocale();
  const [, params] = useRoute("/join/:token");
  const token = params?.token ?? "";
  const [, setLocation] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const acceptMutation = useAcceptInvitation();

  const preview = useQuery({
    queryKey: ["/api/invitations/preview", token],
    queryFn: () => fetchInvitationPublic(token),
    enabled: Boolean(token),
    networkMode: "offlineFirst",
  });

  const handleAccept = () => {
    if (!token) return;
    acceptMutation.mutate(token, {
      onSuccess: (body) => {
        setLocation(body.role === "player" ? "/player" : "/coach");
      },
    });
  };

  if (!token) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-6 text-center">
        <ShieldAlert className="w-12 h-12 text-muted-foreground mb-4" />
        <p className="text-destructive font-medium">{t("join_invalid")}</p>
      </div>
    );
  }

  if (preview.isLoading) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (preview.isError) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-6 text-center">
        <ShieldAlert className="w-12 h-12 text-muted-foreground mb-4" />
        <p className="text-destructive font-medium">{t("join_invalid")}</p>
      </div>
    );
  }

  const data = preview.data!;
  if (data.used) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-6 text-center gap-4">
        <ShieldAlert className="w-12 h-12 text-muted-foreground" />
        <p className="text-foreground font-medium">{t("join_used")}</p>
        <Button variant="outline" onClick={() => setLocation("/login")}>
          {t("join_go_home")}
        </Button>
      </div>
    );
  }

  if (data.expired) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-6 text-center gap-4">
        <ShieldAlert className="w-12 h-12 text-muted-foreground" />
        <p className="text-foreground font-medium">{t("join_expired")}</p>
        <Button variant="outline" onClick={() => setLocation("/login")}>
          {t("join_go_home")}
        </Button>
      </div>
    );
  }

  const roleLabel =
    data.role === "player" ? t("invite_role_player") : t("invite_role_staff");

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <main className="flex-1 p-6 flex flex-col justify-center max-w-md mx-auto w-full space-y-6">
        <div className="text-center space-y-2">
          <p className="text-4xl">{data.team.logo}</p>
          <h1 className="text-2xl font-black text-foreground">{t("join_title")}</h1>
        </div>

        <div className="bg-card rounded-2xl border border-border p-5 space-y-3 shadow-sm">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {t("join_team_label")}
            </p>
            <p className="text-lg font-bold text-foreground mt-1">{data.team.name}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {t("join_role_label")}
            </p>
            <p className="text-lg font-semibold text-primary mt-1">{roleLabel}</p>
          </div>
        </div>

        {authLoading ? (
          <div className="flex justify-center py-4">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !user ? (
          <div className="space-y-3">
            <p className="text-sm text-center text-muted-foreground">{t("join_sign_in_to_accept")}</p>
            <Button className="w-full font-bold" onClick={() => setLocation("/login")}>
              {t("sign_in")}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {acceptMutation.isError && (
              <p className="text-sm text-destructive text-center">
                {(acceptMutation.error as Error)?.message || t("join_accept_error")}
              </p>
            )}
            <Button
              className="w-full font-bold"
              disabled={acceptMutation.isPending}
              onClick={handleAccept}
              data-testid="join-accept-button"
            >
              {acceptMutation.isPending ? t("saving") : t("join_button")}
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
