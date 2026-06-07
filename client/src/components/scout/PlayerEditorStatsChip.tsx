/**
 * PlayerEditorStatsChip — muestra stats WCBA de una jugadora directamente en el editor.
 * Llama a /api/stats/player-link?name= y si existe externalId muestra PPG/RPG/APG/FG%.
 * Componente auto-contenido: no bloquea el flujo de edición.
 */
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { BarChart3 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface StatsData {
  externalId: string | null;
  ppg: number;
  rpg: number;
  apg: number;
}

function usePlayerWcbaStats(name: string | undefined, enabled: boolean) {
  return useQuery<StatsData>({
    queryKey: ["stats-player-link-editor", name],
    queryFn: async () => {
      const r = await apiRequest(
        "GET",
        `/api/stats/player-link?name=${encodeURIComponent(name ?? "")}`,
      );
      return r.json();
    },
    enabled: enabled && Boolean(name?.trim()),
    staleTime: 1000 * 60 * 10,
    retry: false,
    networkMode: "offlineFirst",
  });
}

export function PlayerEditorStatsChip({
  playerName,
  locale,
}: {
  playerName: string | undefined;
  locale: string;
}) {
  const [, setLocation] = useLocation();
  const { data, isLoading } = usePlayerWcbaStats(playerName, Boolean(playerName?.trim()));

  if (isLoading || !data?.externalId) return null;

  const es = locale === "es";
  const zh = locale === "zh";

  const label = es ? "Stats WCBA" : zh ? "WCBA数据" : "WCBA Stats";
  const hint  = es ? "Ver en U Stats →" : zh ? "查看统计 →" : "View in U Stats →";

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <BarChart3 className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="text-[10px] font-black uppercase tracking-widest text-primary">
            {label}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setLocation(`/stats?tab=jugadoras&player=${data.externalId}`)}
          className="text-[10px] font-bold text-primary/70 hover:text-primary transition-colors shrink-0"
        >
          {hint}
        </button>
      </div>
      <div className="flex gap-3 mt-1.5 flex-wrap">
        <span className="text-sm font-black text-foreground tabular-nums">
          {data.ppg.toFixed(1)}{" "}
          <span className="text-[10px] font-normal text-muted-foreground">PPG</span>
        </span>
        <span className="text-sm font-black text-foreground tabular-nums">
          {data.rpg.toFixed(1)}{" "}
          <span className="text-[10px] font-normal text-muted-foreground">RPG</span>
        </span>
        <span className="text-sm font-black text-foreground tabular-nums">
          {data.apg.toFixed(1)}{" "}
          <span className="text-[10px] font-normal text-muted-foreground">APG</span>
        </span>
      </div>
    </div>
  );
}
