import { useLocation } from "wouter";
import { Settings, FileText, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/i18n";
import { useAuth } from "@/lib/useAuth";
import { usePlayerHome } from "@/lib/player-home";
import { BasketballPlaceholderAvatar } from "@/components/BasketballPlaceholderAvatar";
import { isRealPhoto } from "@/lib/utils";

function formatReportDate(iso: string, locale: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat(locale === "es" ? "es" : locale === "zh" ? "zh-CN" : "en", {
      dateStyle: "medium",
    }).format(d);
  } catch {
    return iso;
  }
}

export default function PlayerHome() {
  const { t, locale } = useLocale();
  const [, setLocation] = useLocation();
  const { profile } = useAuth();
  const { data, isLoading, isError } = usePlayerHome();

  const displayName =
    data?.membership?.displayName?.trim() ||
    profile?.username ||
    profile?.email ||
    "—";
  const jersey = data?.membership?.jerseyNumber?.trim() || "—";
  const position = data?.membership?.position?.trim() || "—";
  const avatarUrl = profile?.avatar_url ?? "";
  const real = isRealPhoto(avatarUrl);

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-20 bg-card/90 backdrop-blur-md border-b border-border px-4 py-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-foreground">{t("player_home_title")}</h1>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => setLocation("/player/home-settings")}
          aria-label={t("player_settings_aria")}
          data-testid="player-home-settings"
        >
          <Settings className="w-5 h-5" />
        </Button>
      </header>

      <main className="flex-1 p-4 space-y-6 pb-10">
        <section className="bg-card rounded-2xl border border-border p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              {real ? (
                <img
                  src={avatarUrl}
                  alt=""
                  className="w-20 h-20 rounded-full object-cover border-2 border-border"
                />
              ) : (
                <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-border">
                  <BasketballPlaceholderAvatar size={80} />
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-black border-2 border-card">
                <User className="w-4 h-4" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xl font-extrabold text-foreground truncate">{displayName}</p>
              <p className="text-sm text-muted-foreground mt-1">
                <span className="font-semibold text-foreground">#{jersey}</span>
                <span className="mx-2 text-border">·</span>
                <span>{position}</span>
              </p>
              {data?.membership?.team && (
                <p className="text-xs font-bold text-primary mt-2 truncate">
                  {data.membership.team.logo} {data.membership.team.name}
                </p>
              )}
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            {t("player_reports_section")}
          </h2>

          {isLoading && (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {isError && (
            <p className="text-sm text-destructive text-center py-8">{t("player_home_load_error")}</p>
          )}

          {!isLoading && !isError && data && data.reports.length === 0 && (
            <div className="bg-muted/40 rounded-2xl border border-dashed border-border px-6 py-12 text-center">
              <p className="text-sm font-medium text-muted-foreground">{t("player_no_reports")}</p>
            </div>
          )}

          {!isLoading && !isError && data && data.reports.length > 0 && (
            <ul className="space-y-3">
              {data.reports.map((r) => (
                <li
                  key={r.assignmentId}
                  className="bg-card rounded-xl border border-border p-4 flex flex-col gap-3 shadow-sm"
                >
                  <div>
                    <p className="font-bold text-foreground">{r.opponentName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{r.opponentTeamName}</p>
                    <p className="text-[11px] text-muted-foreground mt-2">
                      {formatReportDate(r.assignedAt, locale)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="w-full font-bold"
                    onClick={() => setLocation(`/player/${r.opponentPlayerId}`)}
                    data-testid={`player-report-open-${r.opponentPlayerId}`}
                  >
                    {t("player_view_report")}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
