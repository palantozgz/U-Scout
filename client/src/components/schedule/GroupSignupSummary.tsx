import { useMemo } from "react";
import { useClub } from "@/lib/club-api";
import { useScheduleParticipantsForEvents } from "@/lib/schedule";
import { summarizeGroupSignups } from "@/lib/schedule-groups";

// AÑADIDO 2026-10-01: en las sesiones con grupos y auto-apuntarse, el grupo elegido por cada jugadora solo se guardaba
// en localStorage de su dispositivo y el staff nunca lo veía. Ahora se guarda en schedule_participants.group_label y
// esta tarjeta enseña quién ha elegido cada grupo.

export function GroupSignupSummary(props: {
  clubId: string;
  eventId: string;
  groupsCount: number;
  t: (key: any) => string;
}) {
  const { clubId, eventId, groupsCount, t } = props;
  const participantsQ = useScheduleParticipantsForEvents({ clubId, eventIds: [eventId] });
  const clubQ = useClub();

  const nameByUserId = useMemo(() => {
    const m = new Map<string, string>();
    for (const member of clubQ.data?.members ?? []) {
      m.set(member.userId, (member.authFullName || member.displayName || member.userId).trim());
    }
    return m;
  }, [clubQ.data?.members]);

  const summary = useMemo(
    () => summarizeGroupSignups(participantsQ.data ?? [], groupsCount),
    [participantsQ.data, groupsCount],
  );

  const nameOf = (uid: string) => nameByUserId.get(uid) ?? uid;
  const total = summary.groups.reduce((a, g) => a + g.length, 0) + summary.noGroup.length;

  return (
    <div className="rounded-xl border border-border bg-background/40 p-3 space-y-2" data-testid="group-signup-summary">
      <p className="text-xs font-black tracking-widest uppercase text-muted-foreground">
        {t("schedule_group_signups_title")}
      </p>
      {total === 0 ? (
        <p className="text-xs text-muted-foreground">{t("schedule_group_signups_none")}</p>
      ) : (
        <div className="space-y-2">
          {summary.groups.map((ids, idx) => (
            <div key={idx}>
              <p className="text-xs font-semibold text-muted-foreground">
                {t("schedule_group_label").replace("{group}", String.fromCharCode(65 + idx))} · {ids.length}
              </p>
              {ids.length > 0 ? <p className="text-[13px] text-foreground">{ids.map(nameOf).join(", ")}</p> : null}
            </div>
          ))}
          {summary.noGroup.length > 0 ? (
            <div>
              <p className="text-xs font-semibold text-muted-foreground">
                {t("schedule_group_signups_nogroup")} · {summary.noGroup.length}
              </p>
              <p className="text-[13px] text-foreground">{summary.noGroup.map(nameOf).join(", ")}</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
