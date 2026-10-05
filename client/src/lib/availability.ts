import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { needsRow, type AvailabilityStatus } from "@/lib/availability-logic";

/**
 * Disponibilidad actual de cada jugadora. RLS: el staff que gestiona el club (jefe o entrenador con acceso a operaciones)
 * lee y escribe todo el club; cada jugadora solo lee su propia fila. Sin fila = completa.
 */
export type PlayerAvailability = {
  club_id: string;
  user_id: string;
  status: AvailabilityStatus;
  note: string | null;
  set_by: string;
  updated_at: string;
};

const COLUMNS = "club_id, user_id, status, note, set_by, updated_at";

export function usePlayerAvailability(params: { clubId?: string }) {
  return useQuery({
    queryKey: ["availability", params.clubId ?? null],
    enabled: Boolean(params.clubId),
    networkMode: "offlineFirst",
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<PlayerAvailability[]> => {
      const { data, error } = await supabase.from("player_availability").select(COLUMNS).eq("club_id", params.clubId!);
      if (error) throw error;
      return (data ?? []) as PlayerAvailability[];
    },
  });
}

export function useSetPlayerAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      clubId: string;
      userId: string;
      status: AvailabilityStatus;
      note: string | null;
      setBy: string;
    }) => {
      if (!needsRow(body.status, body.note)) {
        const { error } = await supabase
          .from("player_availability")
          .delete()
          .eq("club_id", body.clubId)
          .eq("user_id", body.userId);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("player_availability").upsert(
        {
          club_id: body.clubId,
          user_id: body.userId,
          status: body.status,
          note: body.note,
          set_by: body.setBy,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "club_id,user_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["availability"] });
    },
  });
}
