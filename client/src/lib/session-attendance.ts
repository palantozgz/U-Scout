import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  normalizeAttendance,
  type AttendanceReason,
  type AttendanceRow,
  type AttendanceStatus,
} from "@/lib/session-attendance-logic";

/**
 * Asistencia REAL por sesión. RLS: el staff que gestiona el club marca y lee todo el club; cada jugadora solo lee la suya.
 * Va en tabla aparte de schedule_participants (la intención) porque la jugadora puede editar su propia fila de esa tabla.
 */
const COLUMNS = "event_id, user_id, status, reason";

/** Staff: asistencia marcada de una sesión. */
export function useSessionAttendance(params: { clubId?: string; eventId?: string }) {
  return useQuery({
    queryKey: ["session-attendance", "event", params.clubId ?? null, params.eventId ?? null],
    enabled: Boolean(params.clubId) && Boolean(params.eventId),
    networkMode: "offlineFirst",
    queryFn: async (): Promise<AttendanceRow[]> => {
      const { data, error } = await supabase
        .from("session_attendance")
        .select(COLUMNS)
        .eq("club_id", params.clubId!)
        .eq("event_id", params.eventId!);
      if (error) throw error;
      return (data ?? []) as AttendanceRow[];
    },
  });
}

/** Staff: asistencia marcada de varias sesiones a la vez (para la tarjeta de carga). */
export function useSessionAttendanceForEvents(params: { clubId?: string; eventIds: string[] }) {
  return useQuery({
    queryKey: ["session-attendance", "events", params.clubId ?? null, params.eventIds],
    enabled: Boolean(params.clubId) && params.eventIds.length > 0,
    networkMode: "offlineFirst",
    queryFn: async (): Promise<AttendanceRow[]> => {
      const { data, error } = await supabase
        .from("session_attendance")
        .select(COLUMNS)
        .eq("club_id", params.clubId!)
        .in("event_id", params.eventIds);
      if (error) throw error;
      return (data ?? []) as AttendanceRow[];
    },
  });
}

/** Marca (o quita la marca, con status null) la asistencia de una jugadora en una sesión. */
export function useSetSessionAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      clubId: string;
      eventId: string;
      userId: string;
      markedBy: string;
      status: AttendanceStatus | null;
      reason?: AttendanceReason | null;
    }) => {
      if (body.status === null) {
        const { error } = await supabase
          .from("session_attendance")
          .delete()
          .eq("club_id", body.clubId)
          .eq("event_id", body.eventId)
          .eq("user_id", body.userId);
        if (error) throw error;
        return;
      }
      const n = normalizeAttendance(body.status, body.reason);
      const { error } = await supabase.from("session_attendance").upsert(
        {
          event_id: body.eventId,
          user_id: body.userId,
          club_id: body.clubId,
          status: n.status,
          reason: n.reason,
          marked_by: body.markedBy,
          marked_at: new Date().toISOString(),
        },
        { onConflict: "event_id,user_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["session-attendance"] });
    },
  });
}
