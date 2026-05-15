import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHomeData } from "@/lib/useHomeData";
import { apiRequest } from "@/lib/queryClient";
import { ModuleNav } from "./ModuleNav";

// ── Helpers ───────────────────────────────────────────────────
function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("text-[10px] font-bold tracking-[1.8px] uppercase text-muted-foreground mb-2.5", className)}>
      {children}
    </p>
  );
}

function ColHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold tracking-[1.8px] uppercase text-muted-foreground pb-2.5 border-b border-border/30 mb-3">
      {children}
    </p>
  );
}

const SESSION_TYPE_LABEL: Record<string, Record<string, string>> = {
  training:              { es: "Entrenamiento",        en: "Training",        zh: "训练" },
  recovery:              { es: "Recuperación",          en: "Recovery",        zh: "恢复" },
  match:                 { es: "Partido",               en: "Match",           zh: "比赛" },
  travel:                { es: "Viaje",                 en: "Travel",          zh: "出行" },
  video:                 { es: "Video",                 en: "Video Analysis",  zh: "录像" },
  strength_conditioning: { es: "Entrenamiento Físico",  en: "Strength & Conditioning", zh: "体能训练" },
  film:                  { es: "Análisis de Video",     en: "Film Session",    zh: "录像分析" },
};

const AVATAR_COLORS = [
  { bg: "rgba(58,129,254,0.14)",  border: "rgba(58,129,254,0.3)",  text: "#3A81FE" },
  { bg: "rgba(167,139,250,0.14)", border: "rgba(167,139,250,0.3)", text: "#a78bfa" },
  { bg: "rgba(16,185,129,0.14)",  border: "rgba(16,185,129,0.3)",  text: "#10B981" },
  { bg: "rgba(245,166,35,0.14)",  border: "rgba(245,166,35,0.3)",  text: "#F5A623" },
];

const ARCH_COLORS = [
  { bg: "rgba(58,129,254,0.10)",  text: "#3A81FE", border: "rgba(58,129,254,0.22)" },
  { bg: "rgba(167,139,250,0.10)", text: "#a78bfa", border: "rgba(167,139,250,0.22)" },
  { bg: "rgba(16,185,129,0.10)",  text: "#10B981", border: "rgba(16,185,129,0.22)" },
];

function initials(name: string) {
  return (name ?? "")
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";
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
    clubData,
    rosterPlayerUserIds,
    nextSession,
    nextSessionTimeStr,
    daysUntilNext,
    kpiWellnessPct,
    kpiWeekSessions,
    showClubActivityDot,
    weekDays,
    sessionDateSet,
    todayDateKey,
    wellnessPctQ,
    todayParticipantsQ,
  } = useHomeData();

  // Recent players for scout rows
  const playersQ = useQuery({
    queryKey: ["/api/players"],
    queryFn: async () => (await apiRequest("GET", "/api/players")).json(),
    staleTime: 10 * 60 * 1000,
  });
  const recentPlayers: any[] = ((playersQ.data as any[]) ?? []).slice(-2).reverse();

  // Greeting by time of day
  const hour = new Date().getHours();
  const greet =
    hour < 12
      ? locale === "es" ? "Buenos días" : locale === "zh" ? "早上好" : "Good morning"
      : hour < 19
      ? locale === "es" ? "Buenas tardes" : locale === "zh" ? "下午好" : "Good afternoon"
      : locale === "es" ? "Buenas noches" : locale === "zh" ? "晚上好" : "Good evening";

  // Session confirmation stats
  const todayParticipants: any[] = (todayParticipantsQ.data as any[]) ?? [];
  const confirmed = todayParticipants.filter(
    (p) => p.status === "confirmed" || p.attending === true,
  ).length;
  const total = rosterPlayerUserIds.length;
  const confPct = total > 0 ? Math.round((confirmed / total) * 100) : 0;

  // Session type label
  function sessionTypeLabel(s: any): string {
    if (!s) return "";
    const type: string = s.session_type ?? s.type ?? "training";
    return (SESSION_TYPE_LABEL[type] ?? SESSION_TYPE_LABEL.training)[locale] ?? "Training";
  }

  // Session tags
  function sessionTags(s: any): { color: string; label: string }[] {
    if (!s) return [];
    const out: { color: string; label: string }[] = [];
    if (s.location?.trim()) out.push({ color: "#10B981", label: s.location });
    if (s.duration_minutes) out.push({ color: "#6B6B9A", label: `${s.duration_minutes} min` });
    const pending = homeSignals.kpis.pendingAttendanceCount;
    if (pending > 0)
      out.push({
        color: "#F59E0B",
        label:
          locale === "es" ? `${pending} sin confirmar` : locale === "zh" ? `${pending} 未确认` : `${pending} unconfirmed`,
      });
    return out;
  }

  // KPI chips data
  const wellnessScore =
    wellnessPctQ.data?.pct != null
      ? ((wellnessPctQ.data.pct / 100) * 10).toFixed(1)
      : "—";

  const loadLabel =
    kpiWeekSessions >= 5
      ? locale === "es" ? "Alta" : locale === "zh" ? "高" : "High"
      : kpiWeekSessions >= 3
      ? locale === "es" ? "Media" : locale === "zh" ? "中" : "Med"
      : locale === "es" ? "Baja" : locale === "zh" ? "低" : "Low";

  const kpiChips = [
    {
      val: `${kpiWellnessPct}`,
      unit: "%",
      label: locale === "es" ? "Asist." : locale === "zh" ? "出勤" : "Attend.",
      trend: "↑ +3%",
      trendColor: "#10B981",
    },
    {
      val: wellnessScore,
      unit: "",
      label: "Wellness",
      trend: locale === "es" ? "— estable" : locale === "zh" ? "— 稳定" : "— stable",
      trendColor: "#6b7185",
    },
    {
      val: loadLabel,
      unit: "",
      label: locale === "es" ? "Carga" : locale === "zh" ? "强度" : "Load",
      trend: "↑ +12%",
      trendColor: "#F59E0B",
    },
  ];

  // Wellness alerts
  function buildAlerts(): { color: string; text: React.ReactNode }[] {
    if (mode !== "staff") return [];
    const out: { color: string; text: React.ReactNode }[] = [];
    const pending = homeSignals.kpis.pendingAttendanceCount;
    const wellPct = wellnessPctQ.data?.pct ?? 100;
    if (pending > 0) {
      out.push({
        color: "#F59E0B",
        text: (
          <>
            <span className="font-bold" style={{ color: "var(--fg, #f5f5f7)" }}>
              {locale === "es" ? "Asistencia" : locale === "zh" ? "出勤" : "Attendance"}
            </span>{" "}
            —{" "}
            {locale === "es"
              ? `${pending} confirmaciones pendientes para hoy.`
              : locale === "zh"
              ? `今天有 ${pending} 人未确认。`
              : `${pending} attendance responses pending for today.`}
          </>
        ),
      });
    }
    if (wellPct < 80 && wellPct > 0) {
      out.push({
        color: "#EF4444",
        text: (
          <>
            <span className="font-bold" style={{ color: "var(--fg, #f5f5f7)" }}>
              {locale === "es" ? "Wellness bajo" : locale === "zh" ? "健康状态低" : "Low wellness"}
            </span>{" "}
            —{" "}
            {locale === "es"
              ? `Solo ${wellPct}% de envíos. Revisa antes del entreno.`
              : locale === "zh"
              ? `仅 ${wellPct}% 的队员提交了。`
              : `Only ${wellPct}% submitted. Check before training.`}
          </>
        ),
      });
    }
    return out;
  }

  const alerts = buildAlerts();

  return (
    <div className="flex flex-col h-[100dvh] bg-background overflow-hidden">
      <main className="flex-1 overflow-y-auto min-h-0">
        <div className="px-8 pt-7 pb-10 max-w-[1320px] mx-auto">

          {/* ── Greeting ── */}
          <div className="mb-6">
            <p className="text-[11px] font-bold tracking-[1.5px] uppercase text-muted-foreground mb-1">
              {dateStr}
            </p>
            <h1 className="text-[28px] font-extrabold text-foreground leading-tight">
              {greet},{" "}
              <span className="text-primary">{firstName}</span>
            </h1>
          </div>

          {/* ── 2-column grid ── */}
          <div
            className="grid gap-5 items-start"
            style={{ gridTemplateColumns: "1fr min(320px, 30%)" }}
          >

            {/* ────────── LEFT ────────── */}
            <div className="flex flex-col gap-[18px]">

              {/* 1. Próxima sesión */}
              <div>
                <Eyebrow>
                  {locale === "zh" ? "下一场训练" : locale === "es" ? "Próxima sesión" : "Next session"}
                </Eyebrow>
                {nextSession ? (
                  <button
                    type="button"
                    onClick={() => setLocation("/schedule")}
                    className="relative overflow-hidden w-full text-left bg-card border border-border/30 rounded-xl px-5 py-[18px] flex items-center gap-[18px] hover:border-emerald-500/30 transition-colors"
                  >
                    {/* Green left accent */}
                    <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r" style={{ background: "#10B981" }} />

                    {/* Time block */}
                    <div
                      className="rounded-[9px] px-4 py-2.5 text-center shrink-0"
                      style={{ background: "rgba(16,185,129,0.09)", border: "1px solid rgba(16,185,129,0.2)" }}
                    >
                      <div className="text-[22px] font-black leading-none" style={{ color: "#10B981" }}>
                        {nextSessionTimeStr ?? "—"}
                      </div>
                      <div
                        className="text-[10px] font-bold tracking-[1px] uppercase mt-1"
                        style={{ color: "rgba(16,185,129,0.7)" }}
                      >
                        {daysUntilNext === 0
                          ? locale === "zh" ? "今天" : locale === "es" ? "Hoy" : "Today"
                          : daysUntilNext === 1
                          ? locale === "zh" ? "明天" : locale === "es" ? "Mañana" : "Tomorrow"
                          : `+${daysUntilNext}d`}
                      </div>
                    </div>

                    {/* Session body */}
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-[10px] font-extrabold tracking-[1.5px] uppercase mb-1"
                        style={{ color: "#10B981" }}
                      >
                        {sessionTypeLabel(nextSession)}
                      </div>
                      <div className="text-[16px] font-extrabold text-foreground mb-2 truncate">
                        {nextSession.title}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {sessionTags(nextSession).map((tag, i) => (
                          <span key={i} className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                            <span
                              className="w-[5px] h-[5px] rounded-full shrink-0"
                              style={{ background: tag.color }}
                            />
                            {tag.label}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Confirmation stats */}
                    {total > 0 && (
                      <div className="text-right shrink-0">
                        <div className="text-[26px] font-black leading-none text-foreground">
                          {confirmed}
                          <span className="text-[14px] font-semibold text-muted-foreground">
                            /{total}
                          </span>
                        </div>
                        <div className="text-[10px] font-bold tracking-[1px] uppercase text-muted-foreground mt-1">
                          {locale === "zh" ? "已确认" : locale === "es" ? "Confirmadas" : "Confirmed"}
                        </div>
                        <div className="mt-1.5 w-[60px] h-[3px] rounded-full ml-auto overflow-hidden" style={{ background: "var(--border-2, rgba(37,39,55,1))" }}>
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${confPct}%`, background: "#10B981" }}
                          />
                        </div>
                      </div>
                    )}
                  </button>
                ) : (
                  <div className="bg-card border border-border/30 rounded-xl px-5 py-5 flex items-center justify-center">
                    <p className="text-[13px] text-muted-foreground">
                      {locale === "zh" ? "本周暂无安排" : locale === "es" ? "Sin sesiones próximas" : "No upcoming sessions"}
                    </p>
                  </div>
                )}
              </div>

              {/* 2. Esta semana */}
              <div>
                <Eyebrow>
                  {locale === "zh" ? "本周" : locale === "es" ? "Esta semana" : "This week"}
                </Eyebrow>
                <div className="bg-card border border-border/30 rounded-xl px-[18px] py-3.5">
                  <div className="grid grid-cols-7 gap-1">
                    {weekDays.map((d) => {
                      const isToday = d.toDateString() === todayDateKey;
                      const hasSession = sessionDateSet.has(d.toDateString());
                      const dowChar = new Intl.DateTimeFormat(
                        locale === "es" ? "es" : locale === "zh" ? "zh-CN" : "en",
                        { weekday: "narrow" },
                      ).format(d);
                      return (
                        <div
                          key={d.toDateString()}
                          className={cn(
                            "text-center px-1 py-2 rounded-[8px] cursor-pointer border",
                            isToday
                              ? "border-primary/30"
                              : "border-transparent hover:bg-muted/20",
                          )}
                          style={isToday ? { background: "rgba(245,166,35,0.10)" } : undefined}
                        >
                          <div className="text-[9px] font-bold uppercase text-muted-foreground">
                            {dowChar}
                          </div>
                          <div
                            className={cn(
                              "text-[15px] font-extrabold mt-0.5",
                              isToday ? "text-primary" : "text-foreground",
                            )}
                          >
                            {d.getDate()}
                          </div>
                          {hasSession ? (
                            <div
                              className="w-1 h-1 rounded-full mx-auto mt-1"
                              style={{ background: "#10B981" }}
                            />
                          ) : (
                            <div className="h-2" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 3. Último informe scout */}
              <div>
                <Eyebrow>
                  {locale === "zh" ? "最新球探报告" : locale === "es" ? "Último informe scout" : "Recent scout"}
                </Eyebrow>
                {recentPlayers.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {recentPlayers.map((player, idx) => {
                      const col = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                      const arch = ARCH_COLORS[idx % ARCH_COLORS.length];
                      const name: string = player.name ?? player.username ?? "Player";
                      const init = initials(name);
                      const team: string = player.team ?? player.teamName ?? "";
                      const number: string | number = player.number ?? player.jersey_number ?? "";
                      const position: string = player.position ?? "";
                      const archetype: string = player.archetype ?? player.playerType ?? "Player";
                      const sub = [team, number ? `#${number}` : null, position]
                        .filter(Boolean)
                        .join(" · ");
                      return (
                        <button
                          key={player.id ?? idx}
                          type="button"
                          onClick={() => setLocation("/scout")}
                          className="flex items-center gap-3.5 px-[18px] py-3 bg-card border border-border/30 rounded-xl text-left transition-colors"
                          style={{ ["--tw-border-opacity" as any]: 1 }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.borderColor = "rgba(58,129,254,0.4)")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.borderColor = "")
                          }
                        >
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-extrabold shrink-0"
                            style={{
                              background: col.bg,
                              border: `1.5px solid ${col.border}`,
                              color: col.text,
                            }}
                          >
                            {init}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-bold text-foreground">{name}</div>
                            {sub && (
                              <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>
                            )}
                          </div>
                          <span
                            className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-[0.8px] uppercase whitespace-nowrap shrink-0"
                            style={{
                              background: arch.bg,
                              color: arch.text,
                              border: `1px solid ${arch.border}`,
                            }}
                          >
                            {archetype}
                          </span>
                          <div className="text-[11px] text-muted-foreground text-right whitespace-nowrap leading-relaxed shrink-0">
                            <div>
                              {locale === "es" ? "Hace 2h" : locale === "zh" ? "2小时前" : "2h ago"}
                            </div>
                            <div className="font-bold" style={{ color: "#10B981" }}>
                              {locale === "es" ? "Aprobado" : locale === "zh" ? "已批准" : "Approved"}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setLocation("/scout")}
                    className="w-full flex items-center gap-3 px-[18px] py-3.5 bg-card border border-border/30 rounded-xl hover:border-primary/30 transition-colors"
                  >
                    <span className="text-[13px] text-muted-foreground">
                      {locale === "zh" ? "前往 Scout →" : locale === "es" ? "Abrir Scout →" : "Open Scout →"}
                    </span>
                  </button>
                )}
              </div>

            </div>
            {/* ────────── /LEFT ────────── */}

            {/* ────────── RIGHT ────────── */}
            <div className="flex flex-col gap-4">

              {/* KPIs */}
              <div>
                <ColHeader>
                  {locale === "zh" ? "本周球队" : locale === "es" ? "Equipo esta semana" : "Team this week"}
                </ColHeader>
                <div className="grid grid-cols-3 gap-2">
                  {kpiChips.map((kpi, i) => (
                    <div
                      key={i}
                      className="bg-card border border-border/30 rounded-[10px] px-2 py-3 text-center"
                    >
                      <div className="text-[20px] font-black leading-none text-foreground">
                        {kpi.val}
                        <span className="text-[12px] font-semibold">{kpi.unit}</span>
                      </div>
                      <div className="text-[9px] font-bold tracking-[1px] uppercase text-muted-foreground mt-1">
                        {kpi.label}
                      </div>
                      <div className="text-[10px] font-bold mt-1" style={{ color: kpi.trendColor }}>
                        {kpi.trend}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Wellness alerts */}
              <div>
                <ColHeader>
                  {locale === "zh" ? "健康预警" : locale === "es" ? "Alertas wellness" : "Wellness alerts"}
                </ColHeader>
                {alerts.length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    {alerts.map((a, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2.5 p-3 rounded-[9px] bg-card"
                        style={{
                          border: `1px solid ${
                            a.color === "#EF4444"
                              ? "rgba(239,68,68,0.25)"
                              : "rgba(245,158,11,0.25)"
                          }`,
                        }}
                      >
                        <div
                          className="w-[7px] h-[7px] rounded-full shrink-0 mt-1"
                          style={{ background: a.color }}
                        />
                        <div className="text-[12px] text-foreground/80 leading-relaxed">
                          {a.text}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    className="flex items-start gap-2.5 p-3 rounded-[9px] bg-card"
                    style={{ border: "1px solid rgba(16,185,129,0.2)" }}
                  >
                    <div
                      className="w-[7px] h-[7px] rounded-full shrink-0 mt-1"
                      style={{ background: "#10B981" }}
                    />
                    <div className="text-[12px] text-foreground/80">
                      {locale === "zh"
                        ? "所有队员状态良好 ✓"
                        : locale === "es"
                        ? "Sin alertas de wellness hoy ✓"
                        : "No wellness alerts today ✓"}
                    </div>
                  </div>
                )}
              </div>

              {/* My Club */}
              {mode === "staff" && (
                <div>
                  <ColHeader>My Club</ColHeader>
                  <button
                    type="button"
                    onClick={() => setLocation("/coach/club")}
                    className="w-full flex items-center justify-between bg-card border border-border/30 rounded-xl px-4 py-3.5 hover:border-border/60 transition-colors"
                  >
                    <div className="text-left min-w-0">
                      <div className="text-[13px] font-bold text-foreground flex items-center gap-1.5">
                        {clubData?.club?.name ??
                          (locale === "es" ? "Mi Club" : locale === "zh" ? "我的俱乐部" : "My Club")}
                        {showClubActivityDot && (
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {rosterPlayerUserIds.length > 0
                          ? `${rosterPlayerUserIds.length} ${
                              locale === "zh"
                                ? "位球员"
                                : locale === "es"
                                ? "jugadoras"
                                : "players"
                            } · ${
                              locale === "es"
                                ? "Temporada activa"
                                : locale === "zh"
                                ? "赛季进行中"
                                : "Active season"
                            }`
                          : locale === "es"
                          ? "Ver detalles"
                          : locale === "zh"
                          ? "查看详情"
                          : "View details"}
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 ml-3" />
                  </button>
                </div>
              )}

            </div>
            {/* ────────── /RIGHT ────────── */}

          </div>
        </div>
      </main>
      <ModuleNav />
    </div>
  );
}
