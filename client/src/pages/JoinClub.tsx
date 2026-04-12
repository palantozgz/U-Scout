import { useEffect, useRef, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Shield, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocale } from "@/lib/i18n";
import { useAuth } from "@/lib/useAuth";
import { supabase } from "@/lib/supabase";
import { fetchClubInvitationPublic, useAcceptClubInvitation } from "@/lib/club-api";

type Mode = "login" | "register";

function ClubLogoPreview({ logo }: { logo: string }) {
  const isImg = logo.startsWith("data:image/") || /^https:\/\//i.test(logo);
  if (isImg) {
    return (
      <img
        src={logo}
        alt=""
        className="mx-auto h-20 w-20 object-contain rounded-xl border border-border bg-muted/20"
      />
    );
  }
  return <p className="text-4xl">{logo}</p>;
}

export default function JoinClub() {
  const { t, locale } = useLocale();
  const [, params] = useRoute("/join-club/:token");
  const token = params?.token ?? "";
  const [, setLocation] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const acceptMutation = useAcceptClubInvitation();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState(false);

  const preview = useQuery({
    queryKey: ["/api/club/invitations/preview", token],
    queryFn: () => fetchClubInvitationPublic(token),
    enabled: Boolean(token),
    networkMode: "offlineFirst",
  });

  const autoAcceptTried = useRef(false);
  useEffect(() => {
    if (autoAcceptTried.current || !token || !user || !preview.isSuccess || !preview.data) return;
    const d = preview.data;
    if (d.used || d.expired) return;
    autoAcceptTried.current = true;
    acceptMutation.mutate(token, {
      onSuccess: (body) => {
        setLocation(body.role === "player" ? "/player" : "/coach");
      },
      onError: () => {
        autoAcceptTried.current = false;
      },
    });
  }, [token, user, preview.isSuccess, preview.data, acceptMutation, setLocation]);

  const roleLabel = (role: string) => {
    if (role === "head_coach") return t("invite_role_head_coach");
    if (role === "coach") return t("team_mgmt_badge_coach");
    if (role === "player") return t("team_mgmt_badge_player");
    return role;
  };

  const formatExp = (iso: string) => {
    try {
      return new Intl.DateTimeFormat(
        locale === "es" ? "es" : locale === "zh" ? "zh-CN" : "en",
        { dateStyle: "medium", timeStyle: "short" },
      ).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  const handleAuth = async () => {
    setError(null);
    setLoading(true);
    if (mode === "login") {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) setError(err.message);
    } else {
      if (!preview.data) {
        setError("Invalid invitation");
        setLoading(false);
        return;
      }
      const { error: err } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: preview.data.role,
            club_invitation_token: token,
          },
        },
      });
      if (err) setError(err.message);
      else setRegisterSuccess(true);
    }
    setLoading(false);
  };

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

  if (registerSuccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[100dvh] px-6 gap-6 bg-background">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Shield className="w-8 h-8 text-primary" />
        </div>
        <div className="text-center max-w-sm">
          <h2 className="text-xl font-bold mb-2 text-foreground">{t("join_club_verify_title")}</h2>
          <p className="text-muted-foreground text-sm">{t("join_club_verify_body")}</p>
        </div>
        <Button variant="outline" onClick={() => setMode("login")}>
          {t("sign_in")}
        </Button>
      </div>
    );
  }

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

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <main className="flex-1 p-6 flex flex-col justify-center max-w-md mx-auto w-full space-y-6">
        <div className="text-center space-y-2">
          <ClubLogoPreview logo={data.club.logo} />
          <h1 className="text-2xl font-black text-foreground">{t("join_club_title")}</h1>
        </div>

        <div className="bg-card rounded-2xl border border-border p-5 space-y-3 shadow-sm">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("join_club_name_label")}</p>
            <p className="text-lg font-bold text-foreground mt-1">{data.club.name}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("join_role_label")}</p>
            <p className="text-lg font-semibold text-primary mt-1">{roleLabel(data.role)}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("join_club_expires")}</p>
            <p className="text-sm text-muted-foreground mt-1">{formatExp(data.expiresAt)}</p>
          </div>
        </div>

        {authLoading ? (
          <div className="flex justify-center py-4">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !user ? (
          <div className="space-y-4">
            <p className="text-sm text-center text-muted-foreground">{t("join_club_sign_in_prompt")}</p>
            <div className="w-full space-y-3">
              {mode === "register" && (
                <>
                  <p className="text-xs text-center text-muted-foreground">
                    {t("join_role_label")}: <span className="font-semibold text-foreground">{roleLabel(data.role)}</span>
                  </p>
                  <Input
                    placeholder={t("full_name")}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="h-12 rounded-xl bg-background"
                  />
                </>
              )}
              <Input
                type="email"
                placeholder={t("email")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 rounded-xl bg-background"
                autoCapitalize="none"
              />
              <Input
                type="password"
                placeholder={t("password")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 rounded-xl bg-background"
                onKeyDown={(e) => e.key === "Enter" && handleAuth()}
              />
              {error && <p className="text-sm text-destructive text-center">{error}</p>}
              <Button className="w-full font-bold h-12 rounded-xl" onClick={handleAuth} disabled={loading}>
                {loading ? t("saving") : mode === "login" ? t("sign_in") : t("sign_up")}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              {mode === "login" ? t("no_account") : t("already_have_account")}{" "}
              <button
                type="button"
                className="text-primary font-semibold underline underline-offset-2"
                onClick={() => {
                  setMode(mode === "login" ? "register" : "login");
                  setError(null);
                }}
              >
                {mode === "login" ? t("sign_up") : t("sign_in")}
              </button>
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {acceptMutation.isError && (
              <p className="text-sm text-destructive text-center">
                {(acceptMutation.error as Error)?.message || t("join_club_accept_error")}
              </p>
            )}
            <Button
              className="w-full font-bold"
              disabled={acceptMutation.isPending}
              onClick={handleAccept}
              data-testid="join-club-accept"
            >
              {acceptMutation.isPending ? (
                t("saving")
              ) : (
                <>
                  {t("join_club_join_verb")} {data.club.name}
                </>
              )}
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
