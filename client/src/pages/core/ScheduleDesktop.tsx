import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Clock, MapPin, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n";
import { useAuth } from "@/lib/useAuth";
import { useClub } from "@/lib/club-api";
import { useCapabilities } from "@/lib/capabilities";
import { useScheduleEventsRange, useScheduleParticipantsForEvents, type ScheduleEvent } from "@/lib/schedule";
import { ModuleNav } from "./ModuleNav";

// ── Helpers ───────────────────────────────────────────────────
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getWeekMonday(d: Date): Date {
  const day = d.getDay(); // 0=Sun
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

type SlotTime = "morning" | "midday" | "afternoon" | "night";

function getSlot(startsAt: string): SlotTime {
  const h = new Date(startsAt).getHours();
  if (h < 12) return "morning";
  if (h < 15) return "midday";
  if (h < 20) return "afternoon";
  return "night";
}

function sessionBlockStyle(type: ScheduleEvent["session_type"]): { borderColor: string; bg: string } {
  switch (type) {
    case "match":    return { borderColor: "#F5A623", bg: "rgba(245,166,35,0.10)" };
    case "recovery": return { borderColor: "#A78BFA", bg: "rgba(167,139,250,0.10)" };
    case "video":    return { borderColor: "#3A81FE", bg: "rgba(58,129,254,0.10)" };
    default:         return { borderColor: "#10B981", bg: "rgba(16,185,129,0.10)" }; // training, etc.
  }
}

function sessionTypeLabel(type: ScheduleEvent["session_type"], locale: string): string {
  const map: Record<string, Record<string, string>> = {
    training:              { es: "Entrenamiento",       en: "Training",     zh: "训练" },
    recovery:              { es: "Recuperación",         en: "Recovery",     zh: "恢复" },
    match:                 { es: "Partido",              en: "Match",        zh: "比赛" },
    video:                 { es: "Video",                en: "Video",        zh: "录像" },
    strength_conditioning: { es: "Fuerza",               en: "Strength",     zh: "体能" },
    travel:                { es: "Viaje",                en: "Travel",       zh: "出行" },
  };
  return (map[type ?? "training"] ?? map.training)[locale] ?? "Training";
}

// ── Mini Calendar ─────────────────────────────────────────────
function buildCalendarMonth(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const startDow = (first.getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// ── Main component ────────────────────────────────────────────
export default function ScheduleDesktop() {
  const { t, locale } = useLocale();
  const { profile } = useAuth();
  const clubQ = useClub();
  const clubId = clubQ.data?.club?.id;

  const [weekStart, setWeekStart] = useState<Date>(() => getWeekMonday(new Date()));
  const [selectedSession, setSelectedSession] = useState<ScheduleEvent | null>(null);

  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [weekStart]);

  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return d;
      }),
    [weekStart],
  );

  const todayStr = localDateStr(new Date());

  const eventsQ = useScheduleEventsRange({
    clubId,
    start: localDateStr(weekStart),
    end: localDateStr(weekEnd),
  });
  const events: ScheduleEvent[] = eventsQ.data ?? [];

  // Participants for selected session
  const participantsQ = useScheduleParticipantsForEvents({
    clubId,
    eventIds: selectedSession ? [selectedSession.id] : [],
  });
  const participants: any[] = (participantsQ.data as any[]) ?? [];
  const confirmed = participants.filter(
    (p) => p.status === "confirmed" || p.attending === true,
  );
  const pending = participants.filter(
    (p) => p.status !== "confirmed" && p.attending !== true,
  );

  // Event lookup: dayStr → slotTime → events[]
  const eventMap = useMemo(() => {
    const map = new Map<string, Map<SlotTime, ScheduleEvent[]>>();
    for (const ev of events) {
      const ds = localDateStr(new Date(ev.starts_at));
      if (!map.has(ds)) map.set(ds, new Map());
      const slot = getSlot(ev.starts_at);
      const inner = map.get(ds)!;
      if (!inner.has(slot)) inner.set(slot, []);
      inner.get(slot)!.push(ev);
    }
    return map;
  }, [events]);

  // Event dates for mini calendar dots
  const eventDateSet = useMemo(() => {
    const s = new Set<string>();
    for (const ev of events) s.add(localDateStr(new Date(ev.starts_at)));
    return s;
  }, [events]);

  // Mini calendar data
  const calYear = weekStart.getFullYear();
  const calMonth = weekStart.getMonth();
  const calCells = useMemo(() => buildCalendarMonth(calYear, calMonth), [calYear, calMonth]);

  // Navigation
  function prevWeek() {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  }
  function nextWeek() {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  }
  function goToday() {
    setWeekStart(getWeekMonday(new Date()));
  }

  const weekLabel = useMemo(() => {
    const s = new Intl.DateTimeFormat(locale === "es" ? "es" : locale === "zh" ? "zh-CN" : "en", {
      day: "numeric",
      month: "short",
    }).format(weekStart);
    const e = new Intl.DateTimeFormat(locale === "es" ? "es" : locale === "zh" ? "zh-CN" : "en", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(weekEnd);
    return `${s} – ${e}`;
  }, [weekStart, weekEnd, locale]);

  const DOW_LABELS_ES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const DOW_LABELS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const DOW_LABELS_ZH = ["一", "二", "三", "四", "五", "六", "日"];
  const dowLabels = locale === "es" ? DOW_LABELS_ES : locale === "zh" ? DOW_LABELS_ZH : DOW_LABELS_EN;

  const SLOT_LABELS: Record<SlotTime, Record<string, string>> = {
    morning:   { es: "MAÑANA",   en: "MORNING",   zh: "上午" },
    midday:    { es: "MEDIODÍA", en: "MIDDAY",     zh: "午间" },
    afternoon: { es: "TARDE",    en: "AFTERNOON",  zh: "下午" },
    night:     { es: "NOCHE",    en: "NIGHT",      zh: "晚上" },
  };
  const SLOTS: SlotTime[] = ["morning", "midday", "afternoon", "night"];

  function formatTime(iso: string): string {
    try {
      return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(
        new Date(iso),
      );
    } catch {
      return iso;
    }
  }

  const calMonthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "es" ? "es" : locale === "zh" ? "zh-CN" : "en", {
        month: "long",
        year: "numeric",
      }).format(new Date(calYear, calMonth)),
    [calYear, calMonth, locale],
  );

  const MC_DOW = locale === "es"
    ? ["L", "M", "X", "J", "V", "S", "D"]
    : locale === "zh"
    ? ["一", "二", "三", "四", "五", "六", "日"]
    : ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <div className="flex flex-col h-[100dvh] bg-background overflow-hidden">

      {/* ── Header ── */}
      <div
        className="flex items-center gap-4 px-5 shrink-0 bg-card border-b border-border/30"
        style={{ height: 58 }}
      >
        <span className="text-[16px] font-extrabold text-foreground">
          {locale === "es" ? "Schedule" : locale === "zh" ? "赛程" : "Schedule"}
        </span>

        {/* Week nav */}
        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={prevWeek}
            className="w-7 h-7 rounded-[7px] bg-muted/30 border border-border/30 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="w-3 h-3" strokeWidth={3} />
          </button>
          <span className="text-[13px] font-bold text-foreground/80 min-w-[160px] text-center">
            {weekLabel}
          </span>
          <button
            type="button"
            onClick={nextWeek}
            className="w-7 h-7 rounded-[7px] bg-muted/30 border border-border/30 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight className="w-3 h-3" strokeWidth={3} />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="px-3.5 h-7 rounded-[7px] text-[11px] font-extrabold tracking-wide transition-colors"
            style={{
              background: "rgba(245,166,35,0.10)",
              border: "1px solid rgba(245,166,35,0.28)",
              color: "#F5A623",
            }}
          >
            {locale === "es" ? "HOY" : locale === "zh" ? "今天" : "TODAY"}
          </button>
        </div>

        {/* View toggle */}
        <div className="flex gap-0.5 ml-4">
          {[
            locale === "es" ? "Planner" : "Planner",
            locale === "es" ? "Lista" : "List",
            "Wellness",
          ].map((v, i) => (
            <button
              key={v}
              type="button"
              className={cn(
                "px-3 py-1.5 rounded-[7px] text-[11px] font-bold transition-colors",
                i === 0
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
              style={i === 0 ? { background: "rgba(245,166,35,0.10)" } : undefined}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* ── Body — 3 zones ── */}
      <div
        className="flex-1 overflow-hidden grid"
        style={{ gridTemplateColumns: "1fr" }}
      >
        {/* Zone layout via CSS grid responsive trick using container-style */}
        <div className="flex flex-1 overflow-hidden min-h-0">

          {/* Zone 1 — Mini calendar (≥1280px) */}
          <div
            className="hidden xl:flex flex-col shrink-0 overflow-y-auto bg-card border-r border-border/30"
            style={{ width: 220 }}
          >
            <div className="px-4 py-3.5 border-b border-border/30">
              <div className="text-[12px] font-extrabold text-foreground capitalize">
                {calMonthLabel}
              </div>
            </div>
            <div className="px-3 py-2.5">
              <div className="grid grid-cols-7 gap-0.5 mb-0.5">
                {MC_DOW.map((d) => (
                  <div key={d} className="text-[8px] font-bold uppercase text-muted-foreground text-center py-1">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {calCells.map((cell, i) => {
                  if (!cell) return <div key={`e-${i}`} />;
                  const ds = localDateStr(cell);
                  const isToday = ds === todayStr;
                  const hasEv = eventDateSet.has(ds);
                  return (
                    <div
                      key={ds}
                      className="flex flex-col items-center justify-center rounded-[6px] cursor-pointer py-1"
                      style={
                        isToday
                          ? { background: "#F5A623", color: "#0a0b10" }
                          : { color: "var(--fg-muted, #6b7185)" }
                      }
                    >
                      <span className={cn("text-[11px] font-semibold", !isToday && "text-foreground/80")}>
                        {cell.getDate()}
                      </span>
                      {hasEv && !isToday && (
                        <span
                          className="w-1 h-1 rounded-full block mt-0.5"
                          style={{ background: "#10B981" }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Legend */}
            <div className="mt-auto px-4 py-3 border-t border-border/30 space-y-1.5">
              {[
                { color: "#10B981", label: locale === "es" ? "Físico" : locale === "zh" ? "体能" : "Physical" },
                { color: "#3A81FE", label: locale === "es" ? "Táctico" : locale === "zh" ? "战术" : "Tactical" },
                { color: "#F5A623", label: locale === "es" ? "Partido" : locale === "zh" ? "比赛" : "Match" },
                { color: "#A78BFA", label: locale === "es" ? "Recuperación" : locale === "zh" ? "恢复" : "Recovery" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: item.color }}
                  />
                  {item.label}
                </div>
              ))}
            </div>
          </div>

          {/* Zone 2 — Planner grid */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            <div className="flex-1 overflow-auto">
              <div style={{ minWidth: 520 }}>

                {/* Grid header */}
                <div
                  className="grid bg-card border-b border-border/30 sticky top-0 z-10"
                  style={{ gridTemplateColumns: "60px repeat(7, 1fr)" }}
                >
                  <div className="h-[42px] border-r border-border/30" />
                  {weekDays.map((d, i) => {
                    const ds = localDateStr(d);
                    const isToday = ds === todayStr;
                    return (
                      <div
                        key={ds}
                        className={cn(
                          "h-[42px] border-r border-border/30 last:border-r-0 flex flex-col items-center justify-center gap-0.5 cursor-pointer",
                          isToday && "border-b-2",
                        )}
                        style={isToday ? { background: "rgba(245,166,35,0.05)", borderBottomColor: "#F5A623" } : undefined}
                      >
                        <span className="text-[9px] font-bold uppercase text-muted-foreground">
                          {dowLabels[i]}
                        </span>
                        <span
                          className={cn("text-[14px] font-black", isToday ? "text-primary" : "text-foreground")}
                        >
                          {d.getDate()}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Slot rows */}
                {SLOTS.map((slot) => (
                  <div
                    key={slot}
                    className="grid"
                    style={{ gridTemplateColumns: "60px repeat(7, 1fr)" }}
                  >
                    {/* Time label */}
                    <div
                      className="border-r border-border/30 border-b border-border/20 px-1.5 pt-2 text-right text-[9px] font-bold tracking-[0.5px] text-muted-foreground"
                    >
                      {SLOT_LABELS[slot][locale]}
                    </div>

                    {/* Day cells */}
                    {weekDays.map((d) => {
                      const ds = localDateStr(d);
                      const isToday = ds === todayStr;
                      const slotEvents = eventMap.get(ds)?.get(slot) ?? [];
                      return (
                        <div
                          key={ds}
                          className="border-r border-border/30 last:border-r-0 border-b border-border/20 p-0.5 min-h-[64px] cursor-pointer transition-colors hover:bg-white/[0.01]"
                          style={isToday ? { background: "rgba(245,166,35,0.02)" } : undefined}
                        >
                          {slotEvents.map((ev) => {
                            const style = sessionBlockStyle(ev.session_type);
                            const isSel = selectedSession?.id === ev.id;
                            return (
                              <button
                                key={ev.id}
                                type="button"
                                onClick={() => setSelectedSession(isSel ? null : ev)}
                                className="w-full text-left rounded-[6px] px-1.5 py-1 mb-0.5 cursor-pointer border-l-[3px] transition-all"
                                style={{
                                  borderLeftColor: style.borderColor,
                                  background: isSel
                                    ? style.bg.replace("0.10", "0.20")
                                    : style.bg,
                                  outline: isSel
                                    ? `1px solid ${style.borderColor}40`
                                    : undefined,
                                }}
                              >
                                <div
                                  className="text-[10px] font-extrabold truncate"
                                  style={{ color: isSel ? style.borderColor : "var(--fg, #f5f5f7)" }}
                                >
                                  {ev.title}
                                </div>
                                <div className="text-[9px] text-muted-foreground mt-0.5">
                                  {formatTime(ev.starts_at)}
                                  {ev.duration_minutes ? ` · ${ev.duration_minutes}min` : ""}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                ))}

              </div>
            </div>
          </div>

          {/* Zone 3 — Session detail (≥1280px) */}
          <div
            className="hidden xl:flex flex-col bg-card border-l border-border/30 overflow-hidden"
            style={{ width: 300 }}
          >
            <div className="px-[18px] py-4 border-b border-border/30 shrink-0">
              <p className="text-[10px] font-bold tracking-[1.5px] uppercase text-muted-foreground">
                {locale === "es" ? "Detalle sesión" : locale === "zh" ? "训练详情" : "Session detail"}
              </p>
            </div>

            {selectedSession ? (
              <>
                <div className="flex-1 overflow-y-auto px-[18px] py-4 space-y-4">
                  {/* Type + name */}
                  <div>
                    <div
                      className="text-[10px] font-extrabold tracking-[1.5px] uppercase mb-1"
                      style={{ color: sessionBlockStyle(selectedSession.session_type).borderColor }}
                    >
                      {sessionTypeLabel(selectedSession.session_type, locale)}
                    </div>
                    <div className="text-[17px] font-black text-foreground">
                      {selectedSession.title}
                    </div>
                  </div>

                  {/* Meta rows */}
                  {[
                    {
                      icon: <Clock className="w-3.5 h-3.5 text-muted-foreground" />,
                      label: locale === "es" ? "Horario" : locale === "zh" ? "时间" : "Time",
                      value: `${
                        (() => {
                          const d = new Date(selectedSession.starts_at);
                          return d.toDateString() === new Date().toDateString()
                            ? locale === "es" ? "Hoy" : locale === "zh" ? "今天" : "Today"
                            : new Intl.DateTimeFormat(
                                locale === "es" ? "es" : locale === "zh" ? "zh-CN" : "en",
                                { weekday: "short", month: "short", day: "numeric" },
                              ).format(d);
                        })()
                      } · ${formatTime(selectedSession.starts_at)}${
                        selectedSession.duration_minutes
                          ? ` – ${(() => {
                              const end = new Date(
                                new Date(selectedSession.starts_at).getTime() +
                                  selectedSession.duration_minutes * 60_000,
                              );
                              return new Intl.DateTimeFormat(undefined, {
                                hour: "2-digit",
                                minute: "2-digit",
                              }).format(end);
                            })()}`
                          : ""
                      }`,
                    },
                    ...(selectedSession.location?.trim()
                      ? [
                          {
                            icon: <MapPin className="w-3.5 h-3.5 text-muted-foreground" />,
                            label: locale === "es" ? "Lugar" : locale === "zh" ? "地点" : "Location",
                            value: selectedSession.location,
                          },
                        ]
                      : []),
                    {
                      icon: <Users className="w-3.5 h-3.5 text-muted-foreground" />,
                      label: locale === "es" ? "Asistencia" : locale === "zh" ? "出勤" : "Attendance",
                      value:
                        participantsQ.isLoading
                          ? "…"
                          : `${confirmed.length} / ${participants.length} ${
                              locale === "es" ? "confirmadas" : locale === "zh" ? "已确认" : "confirmed"
                            }`,
                    },
                  ].map((row, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2.5 py-2.5 border-b border-border/30 last:border-b-0"
                    >
                      <div className="w-8 h-8 rounded-[8px] bg-muted/30 flex items-center justify-center shrink-0">
                        {row.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] text-muted-foreground">{row.label}</div>
                        <div className="text-[13px] font-bold text-foreground truncate">
                          {row.value}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Confirmed players */}
                  {participants.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold tracking-[1.5px] uppercase text-muted-foreground mb-2">
                        {locale === "es" ? "Confirmadas" : locale === "zh" ? "已确认" : "Confirmed"}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {participants.map((p: any, i: number) => {
                          const isConf = p.status === "confirmed" || p.attending === true;
                          const label = p.displayName ?? p.name ?? "?";
                          const init = label
                            .split(" ")
                            .map((w: string) => w[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase();
                          return (
                            <div
                              key={p.userId ?? i}
                              title={label}
                              className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-extrabold"
                              style={
                                isConf
                                  ? {
                                      background: "rgba(16,185,129,0.15)",
                                      border: "1.5px solid rgba(16,185,129,0.3)",
                                      color: "#10B981",
                                    }
                                  : {
                                      background: "var(--card2, #1a1b24)",
                                      border: "1.5px solid var(--border, #1e2030)",
                                      color: "var(--fg-muted, #6b7185)",
                                    }
                              }
                            >
                              {isConf ? init : "?"}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="shrink-0 flex gap-2 px-[18px] py-3.5 border-t border-border/30">
                  <button
                    type="button"
                    className="flex-1 py-2 rounded-[8px] text-[12px] font-bold bg-muted/30 text-muted-foreground border border-border/30 hover:text-foreground transition-colors"
                  >
                    {locale === "es" ? "Editar" : locale === "zh" ? "编辑" : "Edit"}
                  </button>
                  <button
                    type="button"
                    className="flex-1 py-2 rounded-[8px] text-[12px] font-bold text-[#0a0b10] transition-colors"
                    style={{ background: "#F5A623" }}
                  >
                    {locale === "es" ? "Tomar asistencia" : locale === "zh" ? "签到" : "Take attendance"}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <div className="w-10 h-10 rounded-full bg-muted/30 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
                <p className="text-[12px] font-semibold">
                  {locale === "es"
                    ? "Selecciona una sesión"
                    : locale === "zh"
                    ? "选择一个训练"
                    : "Select a session"}
                </p>
              </div>
            )}
          </div>

        </div>
      </div>

      <ModuleNav />
    </div>
  );
}
