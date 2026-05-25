import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CalendarDays, BarChart3, Target, Heart, Building2, BookOpen } from "lucide-react";
import { useHomeData } from "@/lib/useHomeData";
import { ModuleNav } from "./ModuleNav";
import { ModuleHeader } from "@/components/branding/ModuleHeader";

// ── Sub-components ────────────────────────────────────────────

function KpiCell({
  value,
  label,
  color,
}: {
  value: string | number;
  label: string;
  color?: "primary" | "green" | "default";
}) {
  const colorClass =
    color === "primary" ? "text-primary" :
    color === "green"   ? "text-emerald-500" :
    "text-foreground";
  return (
    <div
      className="flex flex-col items-center justify-center px-2"
      style={{ minHeight: 64, paddingTop: 12, paddingBottom: 12 }}
    >
      <span className={cn("text-2xl font-black leading-none tabular-nums", colorClass)}>{value}</span>
      <span className="text-[9px] font-bold tracking-[1.5px] text-muted-foreground/80 uppercase mt-1.5">{label}</span>
    </div>
  );
}

function AlertChip({
  icon,
  label,
  sub,
  tone,
  onClick,
}: {
  icon: string;
  label: string;
  sub?: string;
  tone: "amber" | "emerald" | "blue" | "neutral";
  onClick?: () => void;
}) {
  const toneClass = {
    amber:   "border-amber-500/30 bg-amber-500/8",
    emerald: "border-emerald-500/30 bg-emerald-500/8",
    blue:    "border-blue-500/30 bg-blue-500/8",
    neutral: "border-border bg-card",
  }[tone];
  const textClass = {
    amber:   "text-amber-700 dark:text-amber-300",
    emerald: "text-emerald-700 dark:text-emerald-300",
    blue:    "text-blue-700 dark:text-blue-300",
    neutral: "text-foreground",
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "flex-1 min-w-[200px] rounded-xl border px-3 py-2.5 text-left transition-colors",
        toneClass,
        onClick ? "active:scale-[0.99] hover:brightness-95" : "cursor-default",
      )}
    >
      <div className="flex items-start gap-2">
        <span className="text-base leading-none mt-0.5 shrink-0">{icon}</span>
        <div className="min-w-0">
          <p className={cn("text-[11px] font-black leading-snug tracking-tight", textClass)}>{label}</p>
          {sub && <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground leading-snug">{sub}</p>}
        </div>
      </div>
    </button>
  );
}

function ModCard(props: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  badge?: string;
  dot?: boolean;
  comingSoon?: boolean;
  onClick: () => void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={props.comingSoon ? undefined : props.onClick}
      disabled={props.comingSoon}
      data-testid={props.testId}
      className={cn(
        "group relative text-left rounded-xl border border-border bg-card p-3 flex flex-col gap-1 h-full",
        "transition-all duration-200",
        props.comingSoon
          ? "opacity-50 cursor-default"
          : "active:scale-[0.97] hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
      )}
    >
      {props.dot && (
        <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-destructive ring-2 ring-card" />
      )}
      {props.badge && !props.comingSoon && (
        <span className="absolute top-3 right-3 text-[8px] font-black tracking-wide bg-primary text-primary-foreground rounded px-1.5 py-0.5">
          {props.badge}
        </span>
      )}
      {props.comingSoon && (
        <span className="absolute top-3 right-3 text-[8px] font-black tracking-wide bg-muted text-muted-foreground rounded px-1.5 py-0.5">
          SOON
        </span>
      )}
      <span className={cn(
        "opacity-70 transition-opacity",
        props.comingSoon ? "text-muted-foreground" : "text-primary group-hover:opacity-100",
      )}>
        {props.icon}
      </span>
      <div>
        <p className="text-sm font-black text-foreground tracking-tight leading-tight">{props.title}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">{props.subtitle}</p>
      </div>
    </button>
  );
}

// ── Main component ────────────────────────────────────────────

export default function HomeMobile() {
  const {
    t, locale,
    setLocation,
    mode,
    firstName,
    dateStr,
    homeSignals,
    wellnessEntryQ,
    wellnessSubmittedToday,
    newReportsCount,
    nextSession,
    daysUntilNext,
    kpiPlayers,
    kpiWeekSessions,
    kpiWellnessPct,
    showClubActivityDot,
  } = useHomeData();

  // ── Smart alerts ──────────────────────────────────────────
  function renderAlerts() {
    if (mode === "staff") {
      const ranking = homeSignals.smartActionsRanking;
      if (!ranking) return null;
      const items = [ranking.primary, ranking.secondary].filter(Boolean) as typeof ranking.primary[];
      const L = {
        attendance: locale === "zh"
          ? `${homeSignals.kpis.pendingAttendanceCount} 人未确认今日出勤`
          : locale === "es"
          ? `${homeSignals.kpis.pendingAttendanceCount} confirmaciones de asistencia pendientes`
          : `${homeSignals.kpis.pendingAttendanceCount} attendance responses pending today`,
        wellness: locale === "zh"
          ? `Wellness ${kpiWellnessPct}% · 部分队员未提交`
          : locale === "es"
          ? `Wellness al ${kpiWellnessPct}% — revisar antes del entreno`
          : `Team wellness at ${kpiWellnessPct}% — check before training`,
        createSession: locale === "zh"
          ? "今天没有安排训练 — 规划本周"
          : locale === "es"
          ? "Sin sesiones hoy — planifica la semana"
          : "No sessions today — plan the week",
        club: locale === "zh"
          ? "球队名单有变动"
          : locale === "es"
          ? "Cambios en la plantilla"
          : "Roster changes to review",
      };
      const cfg = {
        attendance:    { icon: "⚠️", tone: "amber"   as const, route: "/schedule" },
        wellness:      { icon: "🫀", tone: "amber"   as const, route: "/schedule" },
        createSession: { icon: "📅", tone: "neutral" as const, route: "/schedule" },
        club:          { icon: "👥", tone: "blue"    as const, route: "/coach/club" },
      };
      if (!items.length) return null;
      return (
        <div className="mb-3 flex flex-wrap gap-2">
          {items.map((action) => {
            const c = cfg[action.kind];
            return (
              <AlertChip
                key={action.kind}
                icon={c.icon}
                label={L[action.kind]}
                tone={c.tone}
                onClick={() => setLocation(c.route)}
              />
            );
          })}
        </div>
      );
    }

    // Player alerts
    const entry = wellnessEntryQ.data;
    const chips: ReactNode[] = [];
    if (!wellnessSubmittedToday) {
      const label = locale === "zh"
        ? "记得发送今日健康状态"
        : locale === "es"
        ? "Pendiente: envía tu wellness de hoy"
        : "Don't forget to log your wellness today";
      chips.push(
        <AlertChip key="wellness-pending" icon="🫀" label={label} tone="amber" onClick={() => setLocation("/schedule")} />,
      );
    } else if (entry) {
      const sleep     = entry.sleep_quality;
      const readiness = entry.mental_readiness;
      const energy    = entry.energy_level;
      let label: string;
      let sub: string | undefined;
      if (sleep <= 2) {
        label = locale === "zh" ? "今天睡眠不足 — 注意休息" : locale === "es" ? "Parece que el descanso está costando" : "Looks like rest has been tough lately";
        sub   = locale === "zh" ? "睡眠好才能表现好 ✓"     : locale === "es" ? "Wellness enviado · cuídate esta noche" : "Wellness logged · take care tonight";
      } else if (readiness >= 4 && energy >= 4) {
        label = locale === "zh" ? "今天感觉很好 💪"      : locale === "es" ? "Te sientes bien hoy · sigue así" : "You're feeling strong today · keep it up";
        sub   = locale === "zh" ? "健康状态已提交 ✓"     : locale === "es" ? "Wellness enviado ✓"              : "Wellness logged ✓";
      } else {
        label = locale === "zh" ? "健康状态已提交 ✓"     : locale === "es" ? "Wellness de hoy enviado ✓"       : "Today's wellness logged ✓";
      }
      chips.push(<AlertChip key="wellness-done" icon="✅" label={label} sub={sub} tone="emerald" />);
    }
    if ((newReportsCount ?? 0) > 0) {
      const label = locale === "zh"
        ? `${newReportsCount} 份新球探报告`
        : locale === "es"
        ? `${newReportsCount} informe${(newReportsCount ?? 0) > 1 ? "s" : ""} nuevo${(newReportsCount ?? 0) > 1 ? "s" : ""} en Scout`
        : `${newReportsCount} new report${(newReportsCount ?? 0) > 1 ? "s" : ""} in Scout`;
      chips.push(
        <AlertChip key="reports" icon="📋" label={label} tone="blue" onClick={() => setLocation("/scout")} />,
      );
    }
    return chips.length ? <div className="mb-3 flex flex-wrap gap-2">{chips}</div> : null;
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      <main className="flex-1 overflow-y-auto min-h-0 px-3 pb-[calc(3.5rem+env(safe-area-inset-bottom))]">

        {/* Brand header */}
        <ModuleHeader
          module="core"
          tagline={
            locale === "zh" ? "球队管理中心" :
            locale === "es" ? "Centro de gestión del equipo" :
            "Team management hub"
          }
        />

        {/* Greeting */}
        <div className="pb-2">
          <p className="text-[10px] font-bold tracking-[2px] uppercase text-muted-foreground mb-1 truncate">
            {dateStr}
          </p>
          <h1 className="text-[24px] font-black tracking-tight leading-tight">
            {t("home_greeting_hi")}, <span className="text-primary">{firstName}</span> 👋
          </h1>
        </div>

        {/* Smart alerts */}
        {renderAlerts()}

        {/* KPI bar */}
        {mode === "staff" ? (
          <div className="mb-3 grid grid-cols-3 divide-x divide-border rounded-xl border-2 border-primary/20 bg-card">
            <KpiCell value={kpiPlayers}           label={t("home_kpi_players")}      color="default" />
            <KpiCell value={kpiWeekSessions}      label={t("home_kpi_week")}          color="primary" />
            <KpiCell value={`${kpiWellnessPct}%`} label={t("home_kpi_wellness")}     color="green"   />
          </div>
        ) : (
          <div className="mb-3 grid grid-cols-3 divide-x divide-border rounded-xl border-2 border-primary/20 bg-card">
            <KpiCell value={daysUntilNext ?? "—"} label={t("home_kpi_next_session")} color="default" />
            <KpiCell value={newReportsCount ?? 0} label={t("home_kpi_reports")}       color="primary" />
            <KpiCell
              value={wellnessSubmittedToday ? "✓" : "!"}
              label={t("home_kpi_wellness")}
              color={wellnessSubmittedToday ? "green" : "primary"}
            />
          </div>
        )}

        {/* Module grid */}
        <div className="mb-2">
          <p className="text-[9px] font-black tracking-[2px] uppercase text-muted-foreground mb-2">
            {t("home_modules_label")}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {mode === "staff" ? (
              <>
                <ModCard
                  icon={<CalendarDays className="w-6 h-6" />}
                  title={t("ucore_card_schedule_title")}
                  subtitle={homeSignals.kpis.sessionsTodayCount > 0
                    ? t("home_sessions_today_count").replace("{count}", String(homeSignals.kpis.sessionsTodayCount))
                    : t("schedule_empty_next_sessions")}
                  badge={homeSignals.kpis.sessionsTodayCount > 0 ? t("home_badge_today") : undefined}
                  onClick={() => setLocation("/schedule")}
                  testId="ucore-home-card-schedule"
                />
                <ModCard
                  icon={<Target className="w-6 h-6" />}
                  title={t("ucore_card_scout_title")}
                  subtitle={t("ucore_card_scout_sub_staff")}
                  onClick={() => setLocation("/scout")}
                  testId="ucore-home-card-scout"
                />
                <ModCard
                  icon={<BarChart3 className="w-6 h-6" />}
                  title={t("ucore_card_stats_title")}
                  subtitle={t("ucore_card_stats_sub")}
                  onClick={() => setLocation("/stats")}
                  testId="ucore-home-card-stats"
                />
                <ModCard
                  icon={<BookOpen className="w-6 h-6" />}
                  title="U Playbook"
                  subtitle={t("home_playbook_sub")}
                  onClick={() => setLocation("/playbook")}
                  testId="ucore-home-card-playbook"
                />
              </>
            ) : (
              <>
                <ModCard
                  icon={<CalendarDays className="w-6 h-6" />}
                  title={t("ucore_card_schedule_title")}
                  subtitle={nextSession ? nextSession.title : t("schedule_empty_next_sessions")}
                  onClick={() => setLocation("/schedule")}
                  testId="ucore-home-card-schedule"
                />
                <ModCard
                  icon={<Heart className="w-6 h-6" />}
                  title={t("home_wellness_today")}
                  subtitle={wellnessSubmittedToday ? t("schedule_wellness_submitted") : t("schedule_wellness_pending")}
                  onClick={() => setLocation("/player/wellness")}
                  testId="ucore-home-card-wellness"
                />
                <ModCard
                  icon={<Target className="w-6 h-6" />}
                  title={t("ucore_card_scout_title")}
                  subtitle={(newReportsCount ?? 0) > 0
                    ? t("ucore_slot_reports_count").replace("{count}", String(newReportsCount ?? 0))
                    : t("ucore_card_scout_sub_player")}
                  onClick={() => setLocation("/scout")}
                  testId="ucore-home-card-scout"
                />
                <ModCard
                  icon={<BarChart3 className="w-6 h-6" />}
                  title={t("ucore_card_stats_title")}
                  subtitle={t("ucore_card_stats_sub")}
                  onClick={() => setLocation("/stats")}
                  testId="ucore-home-card-stats"
                />
              </>
            )}
          </div>
        </div>

        {/* Mi Club — staff only */}
        {mode === "staff" && (
          <div className="mb-2">
            <button
              type="button"
              onClick={() => setLocation("/coach/club")}
              data-testid="ucore-home-mi-club"
              className={cn(
                "w-full flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-card/60 px-4 py-2.5",
                "text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-card transition-colors",
              )}
            >
              <Building2 className="w-4 h-4" />
              <span>{t("ucore_nav_club")}</span>
              {showClubActivityDot && (
                <span className="w-2 h-2 rounded-full bg-destructive ml-1" />
              )}
            </button>
          </div>
        )}

      </main>
      <ModuleNav />
    </div>
  );
}
