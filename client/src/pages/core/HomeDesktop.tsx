import { cn } from "@/lib/utils";
import { Clock, MapPin, Building2, CalendarDays, Target, BarChart3, Heart } from "lucide-react";
import { useHomeData } from "@/lib/useHomeData";
import { ModuleNav } from "./ModuleNav";
import { ModuleHeader } from "@/components/branding/ModuleHeader";

// ── Tokens matching the mockup ────────────────────────────────
// card:      bg-card border border-border/30 rounded-xl
// label:     text-[10px] font-medium tracking-[1.5px] uppercase text-muted-foreground/70
// value:     text-[22px] font-medium tabular-nums
// greeting:  text-[26px] font-medium

function CardLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-medium tracking-[1.5px] uppercase text-muted-foreground/70 mb-2">
      {children}
    </p>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-card border border-border/30 rounded-xl", className)}>
      {children}
    </div>
  );
}

// ── KPI card — horizontal: big value + label ──────────────────
function KpiCard({
  value,
  label,
  color,
}: {
  value: string | number;
  label: string;
  color?: "primary" | "green" | "default";
}) {
  const valClass =
    color === "primary" ? "text-primary" :
    color === "green"   ? "text-emerald-500" :
    "text-foreground";
  return (
    <Card className="flex items-center gap-4 px-4 py-3.5">
      <span className={cn("text-[22px] font-medium leading-none tabular-nums", valClass)}>{value}</span>
      <span className="text-[11px] font-medium tracking-[1.5px] uppercase text-muted-foreground leading-tight">{label}</span>
    </Card>
  );
}

// ── Alert chip ────────────────────────────────────────────────
function AlertChip({
  icon, label, sub, tone, onClick,
}: {
  icon: string; label: string; sub?: string;
  tone: "amber" | "emerald" | "blue" | "neutral";
  onClick?: () => void;
}) {
  const bg = {
    amber:   "border-amber-500/25 bg-amber-500/6",
    emerald: "border-emerald-500/25 bg-emerald-500/6",
    blue:    "border-primary/25 bg-primary/6",
    neutral: "border-border/30 bg-card",
  }[tone];
  const text = {
    amber:   "text-amber-600 dark:text-amber-400",
    emerald: "text-emerald-600 dark:text-emerald-400",
    blue:    "text-primary",
    neutral: "text-foreground",
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "w-full rounded-xl border px-4 py-3 text-left transition-all",
        bg,
        onClick ? "hover:brightness-95 active:scale-[0.99]" : "cursor-default",
      )}
    >
      <div className="flex items-start gap-2.5">
        <span className="text-base leading-none mt-0.5 shrink-0">{icon}</span>
        <div className="min-w-0">
          <p className={cn("text-[12px] font-medium leading-snug", text)}>{label}</p>
          {sub && <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">{sub}</p>}
        </div>
      </div>
    </button>
  );
}

// ── Day pill for week strip ───────────────────────────────────
function DayPill({ date, hasSession, isToday, locale }: { date: Date; hasSession: boolean; isToday: boolean; locale: string }) {
  const intl  = locale === "es" ? "es" : locale === "zh" ? "zh-CN" : "en";
  const name  = new Intl.DateTimeFormat(intl, { weekday: "short" }).format(date);
  const num   = date.getDate();
  return (
    <div className={cn(
      "flex flex-col items-center gap-1.5 px-2 py-2 rounded-xl flex-1 transition-colors",
      isToday ? "bg-primary/10" : "",
    )}>
      <span className={cn("text-[10px] font-medium uppercase tracking-wide leading-none",
        isToday ? "text-primary" : "text-muted-foreground/70")}>{name}</span>
      <span className={cn("text-[15px] font-medium leading-none",
        isToday ? "text-primary" : "text-foreground/70")}>{num}</span>
      <span className={cn("w-[5px] h-[5px] rounded-full",
        hasSession ? (isToday ? "bg-primary" : "bg-primary/50") : "bg-transparent")} />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export default function HomeDesktop() {
  const {
    t, locale,
    setLocation,
    mode,
    firstName,
    displayName,
    roleLabel,
    dateStr,
    homeSignals,
    wellnessEntryQ,
    wellnessSubmittedToday,
    newReportsCount,
    nextSession,
    nextSessionTimeStr,
    daysUntilNext,
    kpiPlayers,
    kpiWeekSessions,
    kpiWellnessPct,
    showClubActivityDot,
    weekDays,
    sessionDateSet,
    todayDateKey,
  } = useHomeData();

  // ── Alerts ────────────────────────────────────────────────
  function alertItems(): React.ReactNode[] {
    if (mode === "staff") {
      const ranking = homeSignals.smartActionsRanking;
      if (!ranking) return [];
      const items = [ranking.primary, ranking.secondary].filter(Boolean) as typeof ranking.primary[];
      const L: Record<string, string> = {
        attendance: locale === "zh"
          ? `${homeSignals.kpis.pendingAttendanceCount} 人未确认今日出勤`
          : locale === "es"
          ? `${homeSignals.kpis.pendingAttendanceCount} confirmaciones de asistencia pendientes`
          : `${homeSignals.kpis.pendingAttendanceCount} attendance responses pending`,
        wellness: locale === "zh"
          ? `Wellness ${kpiWellnessPct}% · 部分队员未提交`
          : locale === "es"
          ? `Wellness al ${kpiWellnessPct}% — revisar antes del entreno`
          : `Team wellness at ${kpiWellnessPct}% — check before training`,
        createSession: locale === "zh" ? "今天没有安排训练 — 规划本周"
          : locale === "es" ? "Sin sesiones hoy — planifica la semana"
          : "No sessions today — plan the week",
        club: locale === "zh" ? "球队名单有变动"
          : locale === "es" ? "Cambios en la plantilla"
          : "Roster changes to review",
      };
      const cfg: Record<string, { icon: string; tone: "amber" | "blue" | "neutral"; route: string }> = {
        attendance:    { icon: "⚠️", tone: "amber",   route: "/schedule" },
        wellness:      { icon: "🫀", tone: "amber",   route: "/schedule" },
        createSession: { icon: "📅", tone: "neutral", route: "/schedule" },
        club:          { icon: "👥", tone: "blue",    route: "/coach/club" },
      };
      return items.map((a) => {
        const c = cfg[a.kind];
        return (
          <AlertChip key={a.kind} icon={c.icon} label={L[a.kind]} tone={c.tone}
            onClick={() => setLocation(c.route)} />
        );
      });
    }

    // Player
    const out: React.ReactNode[] = [];
    const entry = wellnessEntryQ.data;
    if (!wellnessSubmittedToday) {
      out.push(<AlertChip key="wl-p" icon="🫀"
        label={locale === "zh" ? "记得发送今日健康状态" : locale === "es" ? "Pendiente: envía tu wellness de hoy" : "Don't forget to log your wellness today"}
        tone="amber" onClick={() => setLocation("/schedule")} />);
    } else if (entry) {
      const sleep = entry.sleep_quality; const readiness = entry.mental_readiness; const energy = entry.energy_level;
      let label = locale === "zh" ? "健康状态已提交 ✓" : locale === "es" ? "Wellness de hoy enviado ✓" : "Today's wellness logged ✓";
      let sub: string | undefined;
      if (sleep <= 2) {
        label = locale === "zh" ? "今天睡眠不足 — 注意休息" : locale === "es" ? "Parece que el descanso está costando" : "Rest has been tough lately";
        sub   = locale === "zh" ? "睡眠好才能表现好 ✓" : locale === "es" ? "Wellness enviado · cuídate esta noche" : "Wellness logged · take care tonight";
      } else if (readiness >= 4 && energy >= 4) {
        label = locale === "zh" ? "今天感觉很好 💪" : locale === "es" ? "Te sientes bien hoy · sigue así" : "Feeling strong today · keep it up";
        sub   = locale === "zh" ? "健康状态已提交 ✓" : locale === "es" ? "Wellness enviado ✓" : "Wellness logged ✓";
      }
      out.push(<AlertChip key="wl-d" icon="✅" label={label} sub={sub} tone="emerald" />);
    }
    if ((newReportsCount ?? 0) > 0) {
      const n = newReportsCount ?? 0;
      out.push(<AlertChip key="rep" icon="📋"
        label={locale === "zh" ? `${n} 份新球探报告`
          : locale === "es" ? `${n} informe${n !== 1 ? "s" : ""} nuevo${n !== 1 ? "s" : ""} en Scout`
          : `${n} new report${n !== 1 ? "s" : ""} in Scout`}
        tone="blue" onClick={() => setLocation("/scout")} />);
    }
    return out;
  }

  const alerts = alertItems();

  // ── Quick access buttons ──────────────────────────────────
  const quickLinks = mode === "staff"
    ? [
        { icon: <CalendarDays className="w-4 h-4" />, label: t("ucore_nav_schedule"), href: "/schedule" },
        { icon: <Target       className="w-4 h-4" />, label: t("ucore_nav_scout"),    href: "/scout"    },
        { icon: <BarChart3    className="w-4 h-4" />, label: t("ucore_nav_stats"),     href: "/stats"    },
      ]
    : [
        { icon: <CalendarDays className="w-4 h-4" />, label: t("ucore_nav_schedule"),  href: "/schedule"        },
        { icon: <Heart        className="w-4 h-4" />, label: t("home_wellness_today"),  href: "/player/wellness" },
        { icon: <Target       className="w-4 h-4" />, label: t("ucore_nav_scout"),     href: "/scout"           },
      ];

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      {/* ── Header fijo — mismo logo que el resto de módulos ── */}
      <ModuleHeader
        module="core"
        tagline={
          locale === "zh" ? "球队管理中心" :
          locale === "es" ? "Centro de gestión del equipo" :
          "Team management hub"
        }
        className="shrink-0 w-full max-w-5xl mx-auto px-8"
      />

      <main className="flex-1 overflow-y-auto min-h-0 px-8 pt-2 pb-10">

        {/* Greeting */}
        <div className="mb-4">
          <p className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground/70 mb-1">{dateStr}</p>
          <h1 className="text-[26px] font-medium text-foreground leading-tight">
            {t("home_greeting_hi")}, <span className="text-primary">{firstName}</span> 👋
          </h1>
        </div>

        {/* Two-column body */}
        <div className="flex gap-4 min-h-0">

          {/* ── LEFT ── */}
          <div className="flex flex-col flex-1 min-w-0 gap-3">

            {/* Week strip */}
            <Card className="px-3 py-3">
              <CardLabel>
                {locale === "zh" ? "本周" : locale === "es" ? "Esta semana" : "This week"}
              </CardLabel>
              <div className="flex gap-1">
                {weekDays.map((d) => (
                  <DayPill key={d.toDateString()} date={d}
                    hasSession={sessionDateSet.has(d.toDateString())}
                    isToday={d.toDateString() === todayDateKey}
                    locale={locale} />
                ))}
              </div>
            </Card>

            {/* Next session card */}
            {nextSession ? (
              <button
                type="button"
                onClick={() => setLocation("/schedule")}
                className="w-full text-left bg-card border border-border/30 rounded-xl p-4 hover:border-primary/40 transition-colors active:scale-[0.99]"
                data-testid="ucore-home-next-event"
              >
                {/* Badge */}
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="w-[6px] h-[6px] rounded-full bg-primary shrink-0" />
                  <span className="text-[10px] font-medium tracking-[1.5px] uppercase text-primary">
                    {t("home_next_event_label")}
                  </span>
                </div>
                {/* Title */}
                <p className="text-[17px] font-medium text-foreground leading-snug mb-2">{nextSession.title}</p>
                {/* Meta */}
                <div className="flex items-center gap-4 text-[12px] font-medium text-muted-foreground">
                  {nextSessionTimeStr && (
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{nextSessionTimeStr}</span>
                  )}
                  {nextSession.location?.trim() && (
                    <span className="flex items-center gap-1 truncate"><MapPin className="w-3.5 h-3.5 shrink-0" />{nextSession.location}</span>
                  )}
                </div>
                {/* Stats row */}
                {daysUntilNext !== null && (
                  <div className="flex items-center gap-5 mt-3 pt-3 border-t border-border/40">
                    <div>
                      <p className="text-[15px] font-medium text-foreground">{daysUntilNext}</p>
                      <p className="text-[10px] uppercase tracking-[1px] text-muted-foreground/70">{t("home_event_days")}</p>
                    </div>
                    {mode === "staff" && homeSignals.kpis.pendingAttendanceCount > 0 && (
                      <div>
                        <p className="text-[15px] font-medium text-amber-500">{homeSignals.kpis.pendingAttendanceCount}</p>
                        <p className="text-[10px] uppercase tracking-[1px] text-muted-foreground/70">{t("home_event_pending")}</p>
                      </div>
                    )}
                    <div className="ml-auto">
                      <span className="text-[11px] font-medium text-emerald-500">● {t("home_event_ok")}</span>
                    </div>
                  </div>
                )}
              </button>
            ) : (
              <Card className="px-4 py-6 flex items-center justify-center">
                <p className="text-[13px] font-medium text-muted-foreground/70">
                  {locale === "zh" ? "本周暂无安排" : locale === "es" ? "Sin sesiones próximas" : "No upcoming sessions"}
                </p>
              </Card>
            )}

            {/* Quick access */}
            <div className="flex gap-2">
              {quickLinks.map((l) => (
                <button
                  key={l.href}
                  type="button"
                  onClick={() => setLocation(l.href)}
                  className="flex flex-1 items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-border/30 bg-card text-[13px] font-medium text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-accent transition-colors"
                >
                  <span className="text-primary">{l.icon}</span>
                  {l.label}
                </button>
              ))}
            </div>

          </div>

          {/* ── RIGHT — 220px ── */}
          <div className="flex flex-col gap-3 w-[220px] shrink-0">

            {/* KPIs */}
            <CardLabel>
              {locale === "zh" ? "概况" : locale === "es" ? "Resumen" : "Overview"}
            </CardLabel>
            {mode === "staff" ? (
              <>
                <KpiCard value={kpiPlayers}           label={t("home_kpi_players")}     color="default" />
                <KpiCard value={kpiWeekSessions}      label={t("home_kpi_week")}         color="primary" />
                <KpiCard value={`${kpiWellnessPct}%`} label={t("home_kpi_wellness")}    color="green"   />
              </>
            ) : (
              <>
                <KpiCard value={daysUntilNext ?? "—"} label={t("home_kpi_next_session")} color="default" />
                <KpiCard value={newReportsCount ?? 0} label={t("home_kpi_reports")}       color="primary" />
                <KpiCard value={wellnessSubmittedToday ? "✓" : "!"}
                  label={t("home_kpi_wellness")} color={wellnessSubmittedToday ? "green" : "primary"} />
              </>
            )}

            {/* Alerts */}
            {alerts.length > 0 && (
              <>
                <CardLabel>
                  {locale === "zh" ? "提醒" : locale === "es" ? "Alertas" : "Alerts"}
                </CardLabel>
                <div className="flex flex-col gap-2">{alerts}</div>
              </>
            )}

            {/* Mi Club */}
            {mode === "staff" && (
              <button
                type="button"
                onClick={() => setLocation("/coach/club")}
                data-testid="ucore-home-mi-club"
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-border/30 bg-card px-4 py-2.5 text-[13px] font-medium text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-accent transition-colors"
              >
                <Building2 className="w-4 h-4" />
                <span>{t("ucore_nav_club")}</span>
                {showClubActivityDot && <span className="w-2 h-2 rounded-full bg-destructive ml-1" />}
              </button>
            )}

            {/* User identity — centrado en la columna */}
            <div className="pt-3 border-t border-border/30 text-center">
              <p className="text-[13px] font-semibold text-foreground">{displayName}</p>
              {roleLabel && <p className="text-[11px] text-muted-foreground/70 mt-0.5">{roleLabel}</p>}
              <p className="text-[9px] font-medium tracking-[2px] uppercase text-muted-foreground/40 mt-1">U·CORE</p>
            </div>

          </div>
        </div>
      </main>
      <ModuleNav />
    </div>
  );
}
