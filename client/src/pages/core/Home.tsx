import { useEffect, useMemo, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useLocale } from "@/lib/i18n";
import { useAuth, type AppUserRole } from "@/lib/useAuth";
import { cn } from "@/lib/utils";
import { Settings, ChevronRight, CalendarDays, BarChart3, Users, ClipboardList, BellDot, Activity } from "lucide-react";
import { useClub } from "@/lib/club-api";
import { getStoredRosterSignature, rosterSignature, setStoredRosterSignature } from "@/lib/clubRosterSeen";
import { usePlayerTeams } from "@/lib/player-home";
import { UCoreLogoSvgLockup } from "@/components/branding/UScoutBrand";

type HomeMode = "staff" | "player";

function useHomeMode(): HomeMode {
  const { profile } = useAuth();
  return profile?.role === "player" ? "player" : "staff";
}

const ROLE_LABEL_KEY: Record<AppUserRole, "role_master" | "role_head_coach" | "role_coach" | "role_player"> = {
  master: "role_master",
  head_coach: "role_head_coach",
  coach: "role_coach",
  player: "role_player",
};

function HomeCard(props: {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  onClick: () => void;
  showDot?: boolean;
  testId?: string;
  className?: string;
}) {
  const { title, subtitle, icon, onClick, showDot, testId, className } = props;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        // Match legacy U Scout card material (beige card, crisp border, primary accent on hover)
        "group w-full text-left rounded-lg border border-border bg-card p-4 flex items-stretch gap-4",
        "transition-all duration-200 hover:border-primary hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.35)]",
        "active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/10",
        className,
      )}
      data-testid={testId}
    >
      <div className="relative flex items-center justify-center w-14 shrink-0 text-primary">
        {icon}
        {showDot ? (
          <span
            className="absolute top-0 right-0 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-card"
            aria-hidden
          />
        ) : null}
      </div>
      <div className="flex-1 min-w-0 py-0.5">
        <p className="text-lg font-black text-foreground tracking-tight uppercase">{title}</p>
        {subtitle ? (
          <p className="text-xs text-muted-foreground mt-1 font-medium">{subtitle}</p>
        ) : null}
      </div>
      <div className="flex items-center pr-1 text-muted-foreground group-hover:text-primary transition-transform duration-200 group-hover:translate-x-1">
        <ChevronRight className="w-6 h-6" />
      </div>
    </button>
  );
}

type SmartSlot = {
  key: string;
  title: string;
  subtitle?: string;
  icon: ReactNode;
  href: string;
  tone: "neutral" | "amber" | "blue" | "emerald";
};

function SmartSlots(props: { slots: SmartSlot[]; onNavigate: (href: string) => void }) {
  const toneClass = (tone: SmartSlot["tone"]) => {
    // Home should share the same neutral "card" material as U Scout.
    // Keep the slot semantics via icons/text, not via colored backgrounds.
    if (tone === "amber") return "border-border bg-card hover:border-primary/40";
    if (tone === "blue") return "border-border bg-card hover:border-primary/40";
    if (tone === "emerald") return "border-border bg-card hover:border-primary/40";
    return "border-border bg-card hover:border-primary/40";
  };

  const iconTone = (tone: SmartSlot["tone"]) => {
    // Use primary accent similar to U Scout icon style.
    if (tone === "neutral") return "text-muted-foreground";
    return "text-primary";
  };

  return (
    <div className="grid grid-cols-3 gap-2 min-h-[4.25rem]">
      {props.slots.map((s) => (
        <button
          key={s.key}
          type="button"
          onClick={() => props.onNavigate(s.href)}
          className={cn(
            "rounded-xl border px-2.5 py-2 text-left transition-colors select-none",
            "active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/10",
            toneClass(s.tone),
          )}
          data-testid={`ucore-slot-${s.key}`}
        >
          <div className="flex items-start gap-2">
            <span
              className={cn(
                "mt-0.5 shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-background/40",
                iconTone(s.tone),
              )}
            >
              {s.icon}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-black leading-snug tracking-tight text-foreground line-clamp-2">{s.title}</p>
              {s.subtitle ? (
                <p className="mt-0.5 text-[10px] font-semibold leading-snug text-muted-foreground line-clamp-2">{s.subtitle}</p>
              ) : null}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

export default function Home() {
  const { t } = useLocale();
  const [, setLocation] = useLocation();
  const mode = useHomeMode();
  const { profile } = useAuth();
  const displayName = profile?.username?.trim() || profile?.email || t("coach_home_name_fallback");
  const roleLabel = profile?.role ? t(ROLE_LABEL_KEY[profile.role]) : "";

  // Staff: show Mi Club activity dot (same logic as previous CoachHome)
  const watchesClubActivity = mode === "staff" && profile?.role === "head_coach";
  const clubQuery = useClub({ enabled: watchesClubActivity });
  const clubData = clubQuery.data;

  const showClubActivityDot = useMemo(() => {
    if (!clubData || clubQuery.isError || !profile?.id) return false;
    if (profile.role !== "head_coach") return false;
    const prev = getStoredRosterSignature(profile.id, clubData.club.id);
    if (prev === null) return false;
    return prev !== rosterSignature(clubData.members);
  }, [clubData, clubQuery.isError, profile?.id, profile?.role]);

  // Keep roster signature initialized once, same as previous CoachHome.
  useEffect(() => {
    if (!clubData || clubQuery.isError || !profile?.id) return;
    const clubId = clubData.club.id;
    const sig = rosterSignature(clubData.members);
    const prev = getStoredRosterSignature(profile.id, clubId);
    if (prev === null) setStoredRosterSignature(profile.id, clubId, sig);
  }, [clubData, clubQuery.isError, profile?.id]);

  // Player chips: compute "new reports" aggregate if available.
  const playerTeamsQ = usePlayerTeams();
  const playerPending = useMemo(() => {
    if (mode !== "player") return null;
    const teams = playerTeamsQ.data?.teams ?? [];
    if (!teams.length) return 0;
    return teams.reduce((sum, r) => {
      const pending = typeof r.reportsPending === "number" ? r.reportsPending : r.unseenCount;
      return sum + pending;
    }, 0);
  }, [mode, playerTeamsQ.data?.teams]);

  const newReportsCount = useMemo(() => {
    if (mode !== "player") return null;
    const teams = playerTeamsQ.data?.teams ?? [];
    if (!teams.length) return 0;
    return teams.reduce((sum, r) => sum + (r.unseenCount ?? 0), 0);
  }, [mode, playerTeamsQ.data?.teams]);

  const smartSlots = useMemo((): SmartSlot[] => {
    // Slot 1: schedule (truthful neutral until schedule data exists)
    const scheduleSlot: SmartSlot = {
      key: "schedule",
      title: t("ucore_slot_practice_neutral"),
      subtitle: t("ucore_slot_practice_neutral_sub"),
      icon: <CalendarDays className="h-3.5 w-3.5" />,
      href: "/schedule",
      tone: "neutral",
    };

    if (mode === "player") {
      const pendingCount = playerPending ?? 0;
      const reportsCount = newReportsCount ?? 0;

      const pendingSlot: SmartSlot =
        pendingCount > 0
          ? {
              key: "pending",
              title: t("ucore_slot_pending_count").replace("{count}", String(pendingCount)),
              subtitle: undefined,
              icon: <Activity className="h-3.5 w-3.5" />,
              href: "/scout",
              tone: "amber",
            }
          : {
              key: "pending",
              title: t("ucore_slot_pending_none"),
              subtitle: undefined,
              icon: <Activity className="h-3.5 w-3.5" />,
              href: "/scout",
              tone: "emerald",
            };

      const distinctNewReports = reportsCount > 0 && reportsCount !== pendingCount;

      const reportsSlot: SmartSlot = distinctNewReports
        ? {
            key: "reports",
            title: t("ucore_slot_reports_count").replace("{count}", String(reportsCount)),
            subtitle: undefined,
            icon: <BellDot className="h-3.5 w-3.5" />,
            href: "/scout",
            tone: "blue",
          }
        : pendingCount > 0
          ? {
              key: "scout",
              title: t("ucore_card_scout_title"),
              subtitle: t("ucore_card_scout_sub_player"),
              icon: <ClipboardList className="h-3.5 w-3.5" />,
              href: "/scout",
              tone: "neutral",
            }
          : {
              key: "updates",
              title: t("ucore_slot_no_updates"),
              subtitle: undefined,
              icon: <BellDot className="h-3.5 w-3.5" />,
              href: "/scout",
              tone: "emerald",
            };

      return [scheduleSlot, pendingSlot, reportsSlot];
    }

    // Staff / coaches: avoid fabricated counts; use real club activity signal for head coaches when available.
    const pendingSlot: SmartSlot =
      watchesClubActivity && showClubActivityDot
        ? {
            key: "club",
            title: t("ucore_slot_club_activity"),
            subtitle: t("ucore_slot_club_activity_sub"),
            icon: <Users className="h-3.5 w-3.5" />,
            href: "/coach/club",
            tone: "amber",
          }
        : {
            key: "ready",
            title: t("ucore_slot_ready"),
            subtitle: undefined,
            icon: <Activity className="h-3.5 w-3.5" />,
            href: "/scout",
            tone: "emerald",
          };

    const reportsSlot: SmartSlot = {
      key: "scout",
      title: t("ucore_card_scout_title"),
      subtitle: t("ucore_card_scout_sub_staff"),
      icon: <ClipboardList className="h-3.5 w-3.5" />,
      href: "/scout",
      tone: "neutral",
    };

    return [scheduleSlot, pendingSlot, reportsSlot];
  }, [mode, newReportsCount, playerPending, showClubActivityDot, t, watchesClubActivity]);

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background text-foreground overflow-hidden">
      <main className="relative z-10 flex flex-col flex-1 px-4 pt-6 pb-4 max-w-md mx-auto w-full">
        <header className="flex items-start justify-between gap-3 pb-2">
          <div className="pt-0.5">
            <UCoreLogoSvgLockup size={104} className="opacity-95" />
          </div>
          <button
            type="button"
            onClick={() => setLocation("/settings")}
            className={cn(
              "mt-1 p-2 rounded-lg text-muted-foreground transition-colors",
              "hover:text-primary hover:bg-muted/40",
              "active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/10",
            )}
            title={t("settings_title")}
            aria-label={t("settings_title")}
            data-testid="ucore-home-settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </header>

        <div className="mt-3.5">
          <SmartSlots slots={smartSlots} onNavigate={setLocation} />
        </div>

        <div
          className={cn(
            "mt-4 h-px w-full max-w-[280px] mx-auto bg-border",
            // Player mode felt top-heavy: give a touch more air before cards.
            mode === "player" ? "mb-5" : "mb-3.5",
          )}
        />

        <div className="flex flex-col gap-3 flex-1">
          {mode === "staff" ? (
            <>
              <HomeCard
                title={t("ucore_card_scout_title")}
                subtitle={t("ucore_card_scout_sub_staff")}
                icon={<ClipboardList className="w-9 h-9" strokeWidth={2} />}
                onClick={() => setLocation("/scout")}
                testId="ucore-home-card-scout"
              />
              <HomeCard
                title={t("ucore_card_schedule_title")}
                subtitle={t("ucore_card_schedule_sub")}
                icon={<CalendarDays className="w-9 h-9" strokeWidth={2} />}
                onClick={() => setLocation("/schedule")}
                testId="ucore-home-card-schedule"
              />
              <HomeCard
                title={t("ucore_card_stats_title")}
                subtitle={t("ucore_card_stats_sub")}
                icon={<BarChart3 className="w-9 h-9" strokeWidth={2} />}
                onClick={() => setLocation("/stats")}
                testId="ucore-home-card-stats"
              />
              <HomeCard
                title={t("menu_team")}
                subtitle={t("menu_team_sub")}
                icon={<Users className="w-9 h-9" strokeWidth={2} />}
                onClick={() => setLocation("/coach/club")}
                showDot={showClubActivityDot}
                testId="ucore-home-card-club"
              />
            </>
          ) : (
            <>
              <HomeCard
                title={t("ucore_card_schedule_title")}
                subtitle={t("ucore_card_schedule_sub")}
                icon={<CalendarDays className="w-9 h-9" strokeWidth={2} />}
                onClick={() => setLocation("/schedule")}
                testId="ucore-home-card-schedule"
                className="py-5"
              />
              <HomeCard
                title={t("ucore_card_scout_title")}
                subtitle={t("ucore_card_scout_sub_player")}
                icon={<ClipboardList className="w-9 h-9" strokeWidth={2} />}
                onClick={() => setLocation("/scout")}
                testId="ucore-home-card-scout"
                className="py-5"
              />
              <HomeCard
                title={t("ucore_card_stats_title")}
                subtitle={t("ucore_card_stats_sub")}
                icon={<BarChart3 className="w-9 h-9" strokeWidth={2} />}
                onClick={() => setLocation("/stats")}
                testId="ucore-home-card-stats"
                className="py-5"
              />
            </>
          )}
        </div>

        <div
          className={cn(
            "mt-auto text-center border-t border-border/70",
            mode === "player" ? "pt-7 pb-3" : "pt-6 pb-2",
          )}
        >
          <p className="text-sm font-semibold text-foreground">{displayName}</p>
          {roleLabel ? <p className="text-[11px] text-muted-foreground mt-0.5 tracking-wide">{roleLabel}</p> : null}
        </div>
      </main>
    </div>
  );
}

