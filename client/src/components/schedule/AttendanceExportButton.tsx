import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import type { ClubMemberDto } from "@/lib/club-api";
import {
  buildAttendanceCsv,
  type AttendanceActual,
  type AttendanceEvent,
  type AttendanceResponse,
} from "@/lib/attendance-csv";
import { toast } from "@/hooks/use-toast";

// AÑADIDO 2026-10-01 (Fase 2, Schedule): historial de asistencia exportable. Hasta ahora solo se podía
// exportar la semana como imagen. Lee con el cliente de Supabase bajo RLS (el staff ve toda la plantilla)
// los últimos 60 días de sesiones y las respuestas de asistencia, y descarga un CSV.
// Pensado para el staff en ordenador: en el WebView del iPhone las descargas de archivos no están garantizadas.

const DAYS = 60;
const CHUNK = 100;

function memberName(m: ClubMemberDto): string {
  return (m.authFullName || m.displayName || (m.authEmail ? m.authEmail.split("@")[0] : "") || m.userId).trim();
}

export function AttendanceExportButton(props: { clubId?: string; members: ClubMemberDto[] }) {
  const { t } = useLocale();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!props.clubId) return;
    setBusy(true);
    try {
      const now = new Date();
      const since = new Date(now.getTime() - DAYS * 86_400_000).toISOString();
      const { data: evs, error } = await supabase
        .from("schedule_events")
        .select("id, starts_at, session_type, title, attendance_required")
        .eq("club_id", props.clubId)
        .gte("starts_at", since)
        .lte("starts_at", now.toISOString())
        .order("starts_at", { ascending: true });
      if (error) throw error;
      const events = (evs ?? []) as AttendanceEvent[];
      if (events.length === 0) {
        toast({ description: t("attendance_export_empty" as any) });
        return;
      }

      const responses: AttendanceResponse[] = [];
      const actual: AttendanceActual[] = [];
      for (let i = 0; i < events.length; i += CHUNK) {
        const ids = events.slice(i, i + CHUNK).map((e) => e.id);
        const { data, error: pErr } = await supabase
          .from("schedule_participants")
          .select("event_id, user_id, status")
          .eq("club_id", props.clubId)
          .in("event_id", ids);
        if (pErr) throw pErr;
        responses.push(...((data ?? []) as AttendanceResponse[]));
        // Asistencia real marcada por el staff (RLS: solo la ve el staff que gestiona el club).
        const { data: real, error: aErr } = await supabase
          .from("session_attendance")
          .select("event_id, user_id, status, reason")
          .eq("club_id", props.clubId)
          .in("event_id", ids);
        if (aErr) throw aErr;
        actual.push(...((real ?? []) as AttendanceActual[]));
      }

      const players = props.members
        .filter((m) => m.role === "player" && m.status === "active")
        .map((m) => ({ userId: m.userId, name: memberName(m) }));

      const csv = buildAttendanceCsv({ events, players, responses, actual });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `asistencia-${now.toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast({ variant: "destructive" as any, description: t("attendance_export_error" as any) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      size="sm"
      variant="outline"
      className="gap-2"
      disabled={busy || !props.clubId}
      onClick={() => void run()}
      data-testid="attendance-export"
    >
      <Download className="w-3.5 h-3.5" />
      {t("attendance_export_label" as any)}
    </Button>
  );
}
