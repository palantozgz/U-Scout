import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/i18n";
import { useAuth } from "@/lib/useAuth";
import { fetchInvitationPublic, useAcceptInvitation } from "@/lib/player-home";
import { useEffect } from "react";

export default function JoinPage() {
  const { t, locale } = useLocale();
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
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-8 text-center gap-5">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
          <ShieldAlert className="w-8 h-8 text-destructive/70" />
        </div>
        <div className="space-y-1">
          <p className="text-base font-bold text-foreground">{t("join_invalid")}</p>
          <p className="text-sm text-muted-foreground">{locale === "es" ? "El enlace no es válido o ha caducado." : locale === "zh" ? "链接无效或已过期。" : "This link is not valid or has expired."}</p>
        </div>
        <Button variant="outline" onClick={() => setLocation("/login")}>{t("join_go_home")}</Button>
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
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-8 text-center gap-5">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
          <ShieldAlert className="w-8 h-8 text-destructive/70" />
        </div>
        <div className="space-y-1">
          <p className="text-base font-bold text-foreground">{t("join_invalid")}</p>
          <p className="text-sm text-muted-foreground">{locale === "es" ? "El enlace no es válido o ha caducado." : locale === "zh" ? "链接无效或已过期。" : "This link is not valid or has expired."}</p>
        </div>
        <Button variant="outline" onClick={() => setLocation("/login")}>{t("join_go_home")}</Button>
      </div>
    );
  }

  const data = preview.data!;

  useEffect(() => {
    if (user && token && !data?.used && !data?.expired && !acceptMutation.isPending && !acceptMutation.isSuccess) {
      handleAccept();
    }
  }, [user, token, data]);
  if (data.used) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-8 text-center gap-5">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
          <ShieldAlert className="w-8 h-8 text-destructive/70" />
        </div>
        <div className="space-y-1">
          <p className="text-base font-bold text-foreground">{t("join_used")}</p>
          <p className="text-sm text-muted-foreground">{locale === "es" ? "Esta invitación ya ha sido utilizada." : locale === "zh" ? "该邀请已被使用。" : "This invitation has already been used."}</p>
        </div>
        <Button variant="outline" onClick={() => setLocation("/login")}>{t("join_go_home")}</Button>
      </div>
    );
  }

  if (data.expired) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-8 text-center gap-5">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
          <ShieldAlert className="w-8 h-8 text-destructive/70" />
        </div>
        <div className="space-y-1">
          <p className="text-base font-bold text-foreground">{t("join_expired")}</p>
          <p className="text-sm text-muted-foreground">{locale === "es" ? "Este enlace ha caducado." : locale === "zh" ? "该链接已过期。" : "This link has expired."}</p>
        </div>
        <Button variant="outline" onClick={() => setLocation("/login")}>{t("join_go_home")}</Button>
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
            <Button className="w-full font-bold" onClick={() => {
              localStorage.setItem("pending_team_invite", token);
              setLocation("/login");
            }}>
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
