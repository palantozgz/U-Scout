import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { ScheduleEvent } from "@/lib/schedule";
import { RPE_SESSION_TYPES, RPE_WINDOW_HOURS, pickPendingRpeEvent } from "@/lib/session-rpe-logic";
import { shouldAnswerRpe } from "@/lib/session-attendance-logic";

export type SessionRpeRow = {
  id: string;
  club_id: string;
  event_id: string;
  user_id: string;
  rpe: number;
  submitted_at: string;
};

const EVENT_COLUMNS =
  "id, club_id, session_type, title, starts_at, ends_at, location, notes, attendance_required, created_by, created_at";

/**
 * Jugadora: la sesión terminada más reciente (últimas 24 h) de la que aún no ha dado su esfuerzo percibido.
 * Excluye las que ya contestó y a las que dijo que no iba a ir.
 */
export function usePendingRpeSession(params: { clubId?: string; userId?: string }) {
  return useQuery({
    queryKey: ["session-rpe", "pending", params.clubId ?? null, params.userId ?? null],
    enabled: Boolean(params.clubId) && Boolean(params.userId),
    networkMode: "offlineFirst",
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<ScheduleEvent | null> => {
      const now = Date.now();
      const sinceIso = new Date(now - RPE_WINDOW_HOURS * 3_600_000).toISOString();
      const { data: evs, error } = await supabase
        .from("schedule_events")
        .select(EVENT_COLUMNS)
        .eq("club_id", params.clubId!)
        .in("session_type", [...RPE_SESSION_TYPES])
        .gte("ends_at", sinceIso)
        .lte("ends_at", new Date(now).toISOString());
      if (error) throw error;
      const events = (evs ?? []) as ScheduleEvent[];
      if (events.length === 0) return null;
      const ids = events.map((e) => e.id);

      const [mine, parts, att] = await Promise.all([
        supabase.from("session_rpe").select("event_id").eq("user_id", params.userId!).in("event_id", ids),
        supabase.from("schedule_participants").select("event_id, status").eq("user_id", params.userId!).in("event_id", ids),
        supabase.from("session_attendance").select("event_id, status").eq("user_id", params.userId!).in("event_id", ids),
      ]);
      if (mine.error) throw mine.error;
      if (parts.error) throw parts.error;

      const answered = new Set<string>((mine.data ?? []).map((r: { event_id: string }) => r.event_id));
      const declined = new Set<string>(
        (parts.data ?? [])
          .filter((r: { status: string }) => r.status === "declined")
          .map((r: { event_id: string }) => r.event_id),
      );
      // Asistencia real: quien el staff marcó como ausente tampoco debe responder al RPE de esa sesión.
      // Si esta consulta falla no se rompe la tarjeta: se asume que participó.
      for (const r of att.error ? [] : (att.data ?? [])) {
        if (!shouldAnswerRpe({ status: (r as { status: "present" | "partial" | "absent" }).status })) {
          declined.add((r as { event_id: string }).event_id);
        }
      }
      return pickPendingRpeEvent(events, answered, declined, now);
    },
  });
}

export function useSubmitSessionRpe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { club_id: string; event_id: string; user_id: string; rpe: number }) => {
      const { data, error } = await supabase
        .from("session_rpe")
        .upsert({ ...body, submitted_at: new Date().toISOString() }, { onConflict: "event_id,user_id" })
        .select("id, club_id, event_id, user_id, rpe, submitted_at")
        .single();
      if (error) throw error;
      return data as SessionRpeRow;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["session-rpe"] });
    },
  });
}

/** Staff: respuestas de RPE de un conjunto de sesiones (RLS limita a staff del club). */
export function useSessionRpeForEvents(params: { clubId?: string; eventIds: string[] }) {
  return useQuery({
    queryKey: ["session-rpe", "staff", params.clubId ?? null, params.eventIds],
    enabled: Boolean(params.clubId) && params.eventIds.length > 0,
    networkMode: "offlineFirst",
    queryFn: async (): Promise<SessionRpeRow[]> => {
      const { data, error } = await supabase
        .from("session_rpe")
        .select("id, club_id, event_id, user_id, rpe, submitted_at")
        .eq("club_id", params.clubId!)
        .in("event_id", params.eventIds);
      if (error) throw error;
      return (data ?? []) as SessionRpeRow[];
    },
  });
}
