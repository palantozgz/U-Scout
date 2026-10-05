import { useMemo, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { useClub, type ClubMemberDto } from "@/lib/club-api";
import { useScheduleParticipantsForEvents, type ScheduleEvent } from "@/lib/schedule";
import { useSessionAttendance, useSetSessionAttendance } from "@/lib/session-attendance";
import {
  ATTENDANCE_REASONS,
  ATTENDANCE_STATUSES,
  canMarkAttendance,
  rsvpHint,
  summarizeAttendance,
  type AttendanceReason,
  type AttendanceStatus,
} from "@/lib/session-attendance-logic";
import { toast } from "@/hooks/use-toast";

// El staff marca qué ocurrió de verdad en una sesión (presente, parcial, ausente y motivo). Distinto del RSVP, que es la
// intención de la jugadora. Sin esto no se sabe quién debía responder al RPE ni qué carga recibió cada una.
// Solo lo ve quien gestiona el club (jefe, o entrenador con acceso a operaciones) y solo cuando la sesión ya ha empezado.

const STATUS_STYLE: Record<AttendanceStatus, string> = {
  present: "border-emerald-500/40 bg-emerald-500/15 text-emerald-900 dark:text-emerald-200",
  partial: "border-amber-500/40 bg-amber-500/15 text-amber-900 dark:text-amber-200",
  absent: "border-rose-500/40 bg-rose-500/15 text-rose-900 dark:text-rose-200",
};

function nameOf(m: ClubMemberDto): string {
  return (m.authFullName || m.displayName || m.authEmail || m.userId).toString();
}

export function AttendanceMarker(props: { event: ScheduleEvent; t: (key: any) => string }) {
  const { event, t } = props;
  const { profile } = useAuth();
  const clubQ = useClub();
  const members = clubQ.data?.members ?? [];
  const me = members.find((m) => m.userId === profile?.id);
  const canManage =
    me?.status === "active" && (me.role === "head_coach" || (me.role === "coach" && Boolean(me.operationsAccess)));

  const players = useMemo(() => members.filter((m) => m.role === "player" && m.status === "active"), [members]);
  const playerIds = useMemo(() => players.map((m) => m.userId), [players]);

  // Las jugadoras no ven este panel: no se lanzan las consultas para ellas.
  const queryClubId = canManage ? event.club_id : undefined;
  const attQ = useSessionAttendance({ clubId: queryClubId, eventId: event.id });
  const rsvpQ = useScheduleParticipantsForEvents({ clubId: queryClubId, eventIds: [event.id] });
  const setMut = useSetSessionAttendance();
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  const rows = attQ.data ?? [];
  const summary = useMemo(() => summarizeAttendance(rows, playerIds), [rows, playerIds]);

  if (!canManage || event.attendance_required === false || !canMarkAttendance(event.starts_at) || players.length === 0) {
    return null;
  }

  const mark = (userId: string, status: AttendanceStatus | null, reason?: AttendanceReason | null) => {
    if (!profile?.id) return;
    setPendingUserId(userId);
    setMut.mutate(
      { clubId: event.club_id, eventId: event.id, userId, markedBy: profile.id, status, reason },
      {
        onError: () => toast({ variant: "destructive" as any, description: t("attendance_error") }),
        onSettled: () => setPendingUserId(null),
      },
    );
  };

  return (
    <div className="rounded-xl border border-border bg-background/40 p-3 space-y-2" data-testid="attendance-marker">
      <p className="text-xs font-black tracking-widest uppercase text-muted-foreground">{t("attendance_title")}</p>
      <p className="text-xs text-muted-foreground leading-relaxed">{t("attendance_hint")}</p>
      <p className="text-xs font-semibold text-foreground">
        {t("attendance_summary")
          .replace("{p}", String(summary.present))
          .replace("{t}", String(summary.partial))
          .replace("{a}", String(summary.absent))
          .replace("{u}", String(summary.unmarked))}
      </p>

      <div className="space-y-1.5">
        {players.map((m) => {
          const cur = rows.find((r) => r.user_id === m.userId);
          const hint = rsvpHint((rsvpQ.data ?? []).find((p) => p.user_id === m.userId)?.status);
          const busy = pendingUserId === m.userId;
          return (
            <div key={m.userId} className="rounded-lg border border-border bg-card px-2.5 py-2 space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-foreground truncate">{nameOf(m)}</p>
                  {hint && !cur ? (
                    <p className="text-[11px] font-semibold text-muted-foreground">
                      {hint === "confirmed" ? t("attendance_rsvp_confirmed") : t("attendance_rsvp_declined")}
                    </p>
                  ) : null}
                </div>
                <div className="flex gap-1" role="group" aria-label={t("attendance_title")}>
                  {ATTENDANCE_STATUSES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={busy}
                      onClick={() => mark(m.userId, cur?.status === s ? null : s, cur?.status === s ? null : cur?.reason)}
                      className={[
                        "min-h-[36px] rounded-lg border px-2.5 text-xs font-bold transition-colors disabled:opacity-50",
                        cur?.status === s ? STATUS_STYLE[s] : "border-border bg-background/40 text-muted-foreground",
                      ].join(" ")}
                      aria-pressed={cur?.status === s}
                      data-testid={`attendance-${s}-${m.userId}`}
                    >
                      {t(`attendance_${s}`)}
                    </button>
                  ))}
                </div>
              </div>
              {cur && cur.status !== "present" ? (
                <select
                  value={cur.reason ?? ""}
                  disabled={busy}
                  onChange={(e) => mark(m.userId, cur.status, (e.target.value || null) as AttendanceReason | null)}
                  className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm text-foreground"
                  aria-label={t("attendance_reason_ph")}
                  data-testid={`attendance-reason-${m.userId}`}
                >
                  <option value="">{t("attendance_reason_ph")}</option>
                  {ATTENDANCE_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {t(`attendance_reason_${r}`)}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
