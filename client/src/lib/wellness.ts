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

export function todayKey(): string {
  // Local date key (YYYY-MM-DD). Phase 2A: keep it simple; timezone alignment can be refined later.
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
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
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - (params.days - 1));
      const yyyy = startDate.getFullYear();
      const mm = String(startDate.getMonth() + 1).padStart(2, "0");
      const dd = String(startDate.getDate()).padStart(2, "0");
      const start = `${yyyy}-${mm}-${dd}`;

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

