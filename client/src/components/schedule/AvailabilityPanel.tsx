import { useMemo, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import type { ClubMemberDto } from "@/lib/club-api";
import { usePlayerAvailability, useSetPlayerAvailability } from "@/lib/availability";
import {
  AVAILABILITY_STATUSES,
  availabilityOf,
  normalizeNote,
  summarizeAvailability,
  type AvailabilityStatus,
} from "@/lib/availability-logic";
import { toast } from "@/hooks/use-toast";

// Panel del staff (misma audiencia que la pestaña de Wellness): estado de disponibilidad de cada jugadora.
// Cada club decide quién lo gestiona: si tiene fisio o médico, el entrenador jefe le da acceso de operaciones; si no, lo
// fija el cuerpo técnico. La nota es de restricciones para entrenar ("sin contacto", "máx. 20 min"), no un diagnóstico.

type Props = {
  clubId: string | undefined;
  rosterPlayers: ClubMemberDto[];
  t: (key: any) => string;
};

const STATUS_STYLE: Record<AvailabilityStatus, string> = {
  full: "border-emerald-500/40 bg-emerald-500/15 text-emerald-900 dark:text-emerald-200",
  modified: "border-amber-500/40 bg-amber-500/15 text-amber-900 dark:text-amber-200",
  unavailable: "border-rose-500/40 bg-rose-500/15 text-rose-900 dark:text-rose-200",
};

function nameOf(m: ClubMemberDto): string {
  return (m.authFullName || m.displayName || m.authEmail || m.userId).toString();
}

export function AvailabilityPanel({ clubId, rosterPlayers, t }: Props) {
  const { profile } = useAuth();
  const availQ = usePlayerAvailability({ clubId });
  const setMut = useSetPlayerAvailability();
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  const rows = availQ.data ?? [];
  const ids = useMemo(() => rosterPlayers.map((m) => m.userId), [rosterPlayers]);
  const summary = useMemo(() => summarizeAvailability(rows, ids), [rows, ids]);

  const save = (userId: string, status: AvailabilityStatus, rawNote: string | null) => {
    if (!clubId || !profile?.id) return;
    setPendingUserId(userId);
    setMut.mutate(
      { clubId, userId, status, note: normalizeNote(rawNote), setBy: profile.id },
      {
        onError: () => toast({ variant: "destructive" as any, description: t("availability_error") }),
        onSettled: () => setPendingUserId(null),
      },
    );
  };

  if (!clubId || rosterPlayers.length === 0) return null;

  const restrictedText =
    summary.modified + summary.unavailable === 0
      ? t("availability_all_full")
      : t("availability_summary").replace("{m}", String(summary.modified)).replace("{u}", String(summary.unavailable));

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3" data-testid="availability-panel">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-black tracking-widest uppercase text-muted-foreground">{t("availability_title")}</p>
        <p className="text-xs font-semibold text-muted-foreground">{restrictedText}</p>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{t("availability_hint")}</p>

      <div className="space-y-2">
        {rosterPlayers.map((m) => {
          const cur = availabilityOf(rows, m.userId);
          const busy = pendingUserId === m.userId;
          return (
            <div key={m.userId} className="rounded-xl border border-border bg-background/40 px-3 py-2.5 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-extrabold text-foreground truncate">{nameOf(m)}</p>
                <div className="flex gap-1" role="group" aria-label={t("availability_title")}>
                  {AVAILABILITY_STATUSES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={busy}
                      onClick={() => cur.status !== s && save(m.userId, s, cur.note)}
                      className={[
                        "min-h-[36px] rounded-lg border px-2.5 text-xs font-bold transition-colors disabled:opacity-50",
                        cur.status === s ? STATUS_STYLE[s] : "border-border bg-background/40 text-muted-foreground",
                      ].join(" ")}
                      aria-pressed={cur.status === s}
                      data-testid={`availability-${s}-${m.userId}`}
                    >
                      {t(`availability_${s}`)}
                    </button>
                  ))}
                </div>
              </div>
              {cur.status !== "full" ? (
                <input
                  type="text"
                  defaultValue={cur.note ?? ""}
                  key={`${m.userId}-${cur.status}-${cur.note ?? ""}`}
                  maxLength={200}
                  disabled={busy}
                  placeholder={t("availability_note_ph")}
                  onBlur={(e) => {
                    const next = normalizeNote(e.currentTarget.value);
                    if (next !== cur.note) save(m.userId, cur.status, next);
                  }}
                  className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground"
                  data-testid={`availability-note-${m.userId}`}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
