import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { todayKey } from "@/lib/wellness";

/**
 * El staff marca como "revisado" el check-in de una jugadora; la jugadora ve que su dato se ha visto
 * (cierra el circuito de feedback, que es lo que más pesa en la adherencia al registro).
 * Marcar o desmarcar no desencadena ninguna consecuencia automática.
 */
export type WellnessReview = {
  id: string;
  club_id: string;
  user_id: string;
  entry_date: string; // YYYY-MM-DD
  reviewed_by: string;
  reviewed_at: string;
};

const COLUMNS = "id, club_id, user_id, entry_date, reviewed_by, reviewed_at";

/** Jugadora: ¿ha revisado el staff mi check-in de hoy? (RLS: solo ve las suyas.) */
export function useMyWellnessReviewToday(params: { clubId?: string; userId?: string }) {
  const entryDate = todayKey();
  return useQuery({
    queryKey: ["wellness-reviews", "mine", params.clubId ?? null, params.userId ?? null, entryDate],
    enabled: Boolean(params.clubId) && Boolean(params.userId),
    networkMode: "offlineFirst",
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<WellnessReview | null> => {
      const { data, error } = await supabase
        .from("wellness_reviews")
        .select(COLUMNS)
        .eq("club_id", params.clubId!)
        .eq("user_id", params.userId!)
        .eq("entry_date", entryDate)
        .maybeSingle();
      if (error) throw error;
      return (data as WellnessReview | null) ?? null;
    },
  });
}

/** Staff: revisiones de un día para un conjunto de jugadoras. */
export function useWellnessReviewsForDate(params: { clubId?: string; entryDate: string; userIds: string[] }) {
  return useQuery({
    queryKey: ["wellness-reviews", "by-date", params.clubId ?? null, params.entryDate, params.userIds],
    enabled: Boolean(params.clubId) && params.userIds.length > 0,
    networkMode: "offlineFirst",
    queryFn: async (): Promise<WellnessReview[]> => {
      const { data, error } = await supabase
        .from("wellness_reviews")
        .select(COLUMNS)
        .eq("club_id", params.clubId!)
        .eq("entry_date", params.entryDate)
        .in("user_id", params.userIds);
      if (error) throw error;
      return (data ?? []) as WellnessReview[];
    },
  });
}

export function useToggleWellnessReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      clubId: string;
      userId: string;
      entryDate: string;
      reviewedBy: string;
      reviewed: boolean; // true = marcar como revisado, false = quitar la marca
    }) => {
      if (body.reviewed) {
        const { error } = await supabase.from("wellness_reviews").upsert(
          {
            club_id: body.clubId,
            user_id: body.userId,
            entry_date: body.entryDate,
            reviewed_by: body.reviewedBy,
            reviewed_at: new Date().toISOString(),
          },
          { onConflict: "user_id,entry_date" },
        );
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("wellness_reviews")
          .delete()
          .eq("club_id", body.clubId)
          .eq("user_id", body.userId)
          .eq("entry_date", body.entryDate);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["wellness-reviews"] });
    },
  });
}
