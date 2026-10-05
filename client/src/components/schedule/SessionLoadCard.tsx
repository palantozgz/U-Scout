import { useMemo } from "react";
import { useLocale } from "@/lib/i18n";
import type { I18nKey } from "@/lib/i18n";
import { CLUB_TIME_ZONE, type ScheduleEvent } from "@/lib/schedule";
import { ACTIVITY_TYPE_CONFIG } from "@/lib/scheduleActivityConfig";
import type { ClubMemberDto } from "@/lib/club-api";
import { useSessionRpeForEvents } from "@/lib/session-rpe";
import { useSessionAttendanceForEvents } from "@/lib/session-attendance";
import { expectedRpeRespondents } from "@/lib/session-attendance-logic";
import { isRpeSessionType, sessionMinutes, summarizeSessionRpe } from "@/lib/session-rpe-logic";

type Translate = (key: I18nKey) => string;

const MAX_SESSIONS = 6;

function memberName(m: ClubMemberDto): string {
  return (m.authFullName || m.displayName || m.authEmail || m.userId).trim();
}

function whenLabel(startsAt: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : locale, {
      timeZone: CLUB_TIME_ZONE,
      weekday: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(startsAt));
  } catch {
    return "";
  }
}

/**
 * Staff: carga de las sesiones ya terminadas de la semana = RPE medio x minutos. Cada sesión muestra
 * cuántas jugadoras han respondido y, desplegada, el RPE de cada una (de más alto a más bajo).
 */
export function SessionLoadCard(props: {
  clubId: string | undefined;
  rosterPlayers: ClubMemberDto[];
  weekEvents: ScheduleEvent[];
  t: Translate;
}) {
  const { clubId, rosterPlayers, weekEvents, t } = props;
  const { locale } = useLocale();

  const finished = useMemo(() => {
    const now = Date.now();
    return weekEvents
      .filter((e) => isRpeSessionType(e.session_type) && e.ends_at && new Date(e.ends_at).getTime() <= now)
      .sort((a, b) => b.starts_at.localeCompare(a.starts_at))
      .slice(0, MAX_SESSIONS);
  }, [weekEvents]);

  const rpeQ = useSessionRpeForEvents({ clubId, eventIds: finished.map((e) => e.id) });
  const attQ = useSessionAttendanceForEvents({ clubId, eventIds: finished.map((e) => e.id) });
  const nameByUserId = useMemo(() => new Map(rosterPlayers.map((m) => [m.userId, memberName(m)])), [rosterPlayers]);

  const rows = useMemo(() => {
    const byEvent = new Map<string, { userId: string; rpe: number }[]>();
    for (const r of rpeQ.data ?? []) {
      if (!nameByUserId.has(r.user_id)) continue; // solo jugadoras del plantel activo
      const list = byEvent.get(r.event_id) ?? [];
      list.push({ userId: r.user_id, rpe: r.rpe });
      byEvent.set(r.event_id, list);
    }
    return finished.map((ev) => {
      const answers = (byEvent.get(ev.id) ?? []).sort((a, b) => b.rpe - a.rpe);
      const minutes = sessionMinutes(ev.starts_at, ev.ends_at);
      // Asistencia real: las marcadas ausentes no deben responder, así que no cuentan en el total esperado.
      const { expected, absent } = expectedRpeRespondents(
        rosterPlayers.map((m) => m.userId),
        (attQ.data ?? []).filter((r) => r.event_id === ev.id),
        new Set(answers.map((a) => a.userId)),
      );
      return {
        ev,
        minutes,
        answers,
        summary: summarizeSessionRpe(
          answers.map((a) => a.rpe),
          expected,
          minutes,
        ),
        absent,
      };
    });
  }, [attQ.data, finished, nameByUserId, rosterPlayers, rpeQ.data]);

  return (
    <div className="rounded-2xl border border-border bg-card p-4" data-testid="session-load-card">
      <p className="text-xs font-black tracking-widest uppercase text-muted-foreground">{t("rpe_staff_title" as any)}</p>

      {rows.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-5 text-center">
          <p className="text-sm font-medium text-muted-foreground">{t("rpe_staff_empty" as any)}</p>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {rows.map(({ ev, answers, summary, absent }) => (
            <details key={ev.id} className="rounded-xl border border-border bg-background/40 px-3 py-3">
              <summary className="cursor-pointer list-none">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-extrabold text-foreground truncate">
                    {ev.title.trim() || t(ACTIVITY_TYPE_CONFIG[ev.session_type].labelKey)}
                  </p>
                  <p className="shrink-0 text-xs font-semibold text-muted-foreground">{whenLabel(ev.starts_at, locale)}</p>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-muted-foreground">
                  <span>
                    {(t("rpe_staff_row" as any) as string)
                      .replace("{n}", String(summary.responses))
                      .replace("{total}", String(summary.total))}
                  </span>
                  {absent > 0 ? (
                    <span>{(t("rpe_staff_absent" as any) as string).replace("{a}", String(absent))}</span>
                  ) : null}
                  {summary.meanRpe != null ? (
                    <span>{(t("rpe_staff_mean" as any) as string).replace("{mean}", String(summary.meanRpe))}</span>
                  ) : (
                    <span>{t("rpe_staff_no_answers" as any)}</span>
                  )}
                  {summary.load != null ? (
                    <span className="font-black text-foreground">
                      {(t("rpe_staff_load" as any) as string).replace("{load}", String(summary.load))}
                    </span>
                  ) : null}
                </div>
              </summary>
              {answers.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {answers.map((a) => (
                    <span
                      key={a.userId}
                      className="px-2 py-0.5 rounded-full border border-border bg-muted/25 text-xs font-bold text-foreground"
                    >
                      {nameByUserId.get(a.userId)} · {a.rpe}
                    </span>
                  ))}
                </div>
              ) : null}
            </details>
          ))}
        </div>
      )}

      <p className="mt-3 text-[11px] md:text-xs text-muted-foreground leading-snug">{t("rpe_staff_footnote" as any)}</p>
    </div>
  );
}
