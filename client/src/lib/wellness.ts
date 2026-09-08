import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type WellnessEntry = {
  id: string;
  club_id: string;
  user_id: string;
  entry_date: string; // YYYY-MM-DD
  sleep_quality: number;
  energy_level: number;
  muscle_soreness: number;
  mental_readiness: number;
  submitted_at: string;
};

/**
 * "YYYY-MM-DD" del día actual. Por defecto en Asia/Shanghai (hora del club),
 * NO en la zona horaria del dispositivo -- las 8 llamadas existentes a esta
 * función en la app no pasaban `timezoneName`, así que hasta ahora todas
 * calculaban "hoy" con el reloj local del dispositivo (mismo bug que ya se
 * corrigió dos veces en Schedule; aquí determinaba en qué día quedaba
 * archivado el check-in de wellness y si "hoy" ya estaba enviado o no).
 * Se puede seguir pasando otra zona explícitamente si algún día hace falta.
 */
export function todayKey(timezoneName: string = "Asia/Shanghai"): string {
  try {
    if (timezoneName) {
      const d = new Date();
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezoneName,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(d);
      const year  = parts.find(p => p.type === "year")?.value  ?? String(d.getFullYear());
      const month = parts.find(p => p.type === "month")?.value ?? String(d.getMonth() + 1).padStart(2, "0");
      const day   = parts.find(p => p.type === "day")?.value   ?? String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  } catch {
    // fall through to local
  }
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * "YYYY-MM-DD" de hace `n` días, anclado al día calendario del club
 * (Asia/Shanghai) y no al reloj del dispositivo. Para rangos tipo últimos
 * 7/30 días -- mismo bug de zona horaria que todayKey(), mismo arreglo.
 */
export function dateKeyNDaysAgo(n: number, timezoneName: string = "Asia/Shanghai"): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezoneName,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const d2 = Number(parts.find((p) => p.type === "day")?.value);
  const dt = new Date(Date.UTC(y, m - 1, d2));
  dt.setUTCDate(dt.getUTCDate() - n);
  const yyyy2 = dt.getUTCFullYear();
  const mm2 = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd2 = String(dt.getUTCDate()).padStart(2, "0");
  return `${yyyy2}-${mm2}-${dd2}`;
}

export function useWellnessEntryToday(params: { clubId?: string; userId?: string }) {
  const entryDate = todayKey();
  return useQuery({
    queryKey: ["wellness-entry", "today", params.clubId ?? null, params.userId ?? null, entryDate],
    enabled: Boolean(params.clubId) && Boolean(params.userId),
    networkMode: "offlineFirst",
    queryFn: async (): Promise<WellnessEntry | null> => {
      const { data, error } = await supabase
        .from("wellness_entries")
        .select(
          "id, club_id, user_id, entry_date, sleep_quality, energy_level, muscle_soreness, mental_readiness, submitted_at",
        )
        .eq("club_id", params.clubId!)
        .eq("user_id", params.userId!)
        .eq("entry_date", entryDate)
        .maybeSingle();
      if (error) throw error;
      return (data as WellnessEntry | null) ?? null;
    },
  });
}

export function useUpsertWellnessEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      club_id: string;
      user_id: string;
      entry_date: string; // YYYY-MM-DD
      sleep_quality: number;
      energy_level: number;
      muscle_soreness: number;
      mental_readiness: number;
    }) => {
      const { data, error } = await supabase
        .from("wellness_entries")
        .upsert(
          {
            ...body,
            submitted_at: new Date().toISOString(),
          },
          { onConflict: "user_id,entry_date" },
        )
        .select(
          "id, club_id, user_id, entry_date, sleep_quality, energy_level, muscle_soreness, mental_readiness, submitted_at",
        )
        .single();
      if (error) throw error;
      return data as WellnessEntry;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["wellness-entry"] });
      // Also invalidate the plural key used by staff-facing views (WellnessStaffTab, trends, etc.)
      // so a coach sees a fresh submission immediately instead of waiting for staleTime/reload.
      void qc.invalidateQueries({ queryKey: ["wellness-entries"] });
    },
  });
}

export function useWellnessEntriesForDate(params: { clubId?: string; entryDate: string; userIds: string[] }) {
  return useQuery({
    queryKey: ["wellness-entries", "by-date", params.clubId ?? null, params.entryDate, params.userIds],
    enabled: Boolean(params.clubId) && params.userIds.length > 0,
    networkMode: "offlineFirst",
    queryFn: async (): Promise<WellnessEntry[]> => {
      const { data, error } = await supabase
        .from("wellness_entries")
        .select(
          "id, club_id, user_id, entry_date, sleep_quality, energy_level, muscle_soreness, mental_readiness, submitted_at",
        )
        .eq("club_id", params.clubId!)
        .eq("entry_date", params.entryDate)
        .in("user_id", params.userIds);
      if (error) throw error;
      return (data as WellnessEntry[]) ?? [];
    },
  });
}

export function useWellnessEntriesLastNDays(params: { clubId?: string; userId?: string; days: number }) {
  return useQuery({
    queryKey: ["wellness-entries", "last-n-days", params.clubId ?? null, params.userId ?? null, params.days],
    enabled: Boolean(params.clubId) && Boolean(params.userId) && params.days > 0,
    networkMode: "offlineFirst",
    queryFn: async (): Promise<WellnessEntry[]> => {
      const end = todayKey();
      const start = dateKeyNDaysAgo(params.days - 1);

      const { data, error } = await supabase
        .from("wellness_entries")
        .select(
          "id, club_id, user_id, entry_date, sleep_quality, energy_level, muscle_soreness, mental_readiness, submitted_at",
        )
        .eq("club_id", params.clubId!)
        .eq("user_id", params.userId!)
        .gte("entry_date", start)
        .lte("entry_date", end)
        .order("entry_date", { ascending: true });
      if (error) throw error;
      return (data as WellnessEntry[]) ?? [];
    },
  });
}

export function useWellnessEntriesRangeForUsers(params: {
  clubId?: string;
  userIds: string[];
  fromDate: string; // YYYY-MM-DD
  toDate: string; // YYYY-MM-DD
}) {
  return useQuery({
    queryKey: ["wellness-entries", "range-users", params.clubId ?? null, params.fromDate, params.toDate, params.userIds],
    enabled: Boolean(params.clubId) && params.userIds.length > 0 && Boolean(params.fromDate) && Boolean(params.toDate),
    networkMode: "offlineFirst",
    queryFn: async (): Promise<WellnessEntry[]> => {
      const { data, error } = await supabase
        .from("wellness_entries")
        .select(
          "id, club_id, user_id, entry_date, sleep_quality, energy_level, muscle_soreness, mental_readiness, submitted_at",
        )
        .eq("club_id", params.clubId!)
        .gte("entry_date", params.fromDate)
        .lte("entry_date", params.toDate)
        .in("user_id", params.userIds)
        .order("entry_date", { ascending: true });
      if (error) throw error;
      return (data as WellnessEntry[]) ?? [];
    },
  });
}

