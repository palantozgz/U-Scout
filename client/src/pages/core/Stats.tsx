import { useMemo, useState } from "react";
import { BarChart3, ChevronRight } from "lucide-react";
import { ModulePageShell } from "./ModulePage";
import { useLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGameLog, usePlayerSeasonStats, type PlayerSeasonStats } from "@/lib/stats-api";

type SortKey = "playerName" | "teamName" | "games" | "ppg" | "rpg" | "apg" | "fgPct" | "fg3Pct" | "ftPct";

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function Stats() {
  const { t, locale } = useLocale();
  const es = locale === "es";
  const zh = locale === "zh";

  const L = {
    title: es ? "U Stats" : "U Stats",
    tabSeason: es ? "Temporada" : zh ? "赛季" : "Season",
    tabGames: es ? "Partidos" : zh ? "比赛" : "Games",
    emptyTitle: es ? "Esperando datos del scraper" : zh ? "等待采集器数据" : "Waiting for scraper data",
    emptySub: es
      ? "Los datos se actualizarán automáticamente cuando el colector esté activo"
      : zh
      ? "当采集器上线后，数据将自动更新"
      : "Data will update automatically when the collector is active",
    retry: es ? "Reintentar" : zh ? "重试" : "Retry",
    loadError: es ? "Error al cargar estadísticas" : zh ? "加载统计失败" : "Failed to load stats",
    selectPlayer: es ? "Jugadora" : zh ? "球员" : "Player",
    gamesEmpty: es ? "Sin partidos para mostrar" : zh ? "暂无比赛记录" : "No games to show",
    colPlayer: es ? "Jugadora" : zh ? "球员" : "Player",
    colTeam: es ? "Equipo" : zh ? "队伍" : "Team",
    colG: es ? "PJ" : zh ? "场" : "G",
    colPPG: es ? "PPG" : zh ? "得分" : "PPG",
    colRPG: es ? "RPG" : zh ? "篮板" : "RPG",
    colAPG: es ? "APG" : zh ? "助攻" : "APG",
    colFG: es ? "FG%" : "FG%",
    col3P: es ? "3P%" : zh ? "三分%" : "3P%",
    colFT: es ? "FT%" : "FT%",
    more: es ? "Más" : zh ? "更多" : "More",
    mpg: "MPG",
    spg: "SPG",
    bpg: "BPG",
    topg: "TOPG",
    date: es ? "Fecha" : zh ? "日期" : "Date",
    rival: es ? "Rival" : zh ? "对手" : "Rival",
    line: es ? "PTS/REB/AST · MIN" : zh ? "分/板/助 · 分钟" : "PTS/REB/AST · MIN",
    plusMinus: "+/-",
    tbd: es ? "—" : "—",
  };

  const playersQ = usePlayerSeasonStats();
  const players = playersQ.data?.players ?? [];

  const [tab, setTab] = useState<"season" | "games">("season");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "ppg", dir: "desc" });

  const sortedPlayers = useMemo(() => {
    const arr = [...players];
    const dirMul = sort.dir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      const ka = (a as any)[sort.key];
      const kb = (b as any)[sort.key];
      if (sort.key === "playerName" || sort.key === "teamName") {
        return String(ka ?? "").localeCompare(String(kb ?? "")) * dirMul;
      }
      return (num(ka) - num(kb)) * dirMul;
    });
    return arr;
  }, [players, sort.dir, sort.key]);

  const toggleSort = (key: SortKey) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));
  };

  const playerOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of players) set.add(p.playerName);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [players]);

  const [selectedPlayer, setSelectedPlayer] = useState<string>(() => playerOptions[0] ?? "");
  const selectedPlayerSafe = selectedPlayer || playerOptions[0] || "";

  const gamesQ = useGameLog(tab === "games" ? selectedPlayerSafe : null);
  const games = gamesQ.data?.games ?? [];

  const showEmpty = !playersQ.isLoading && !playersQ.isError && players.length === 0;

  return (
    <ModulePageShell
      title={t("ucore_card_stats_title")}
      moduleHeader={{ module: "stats", tagline: t("tagline_stats") }}
    >
      <div className="px-4 pb-10 max-w-md mx-auto w-full">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
          <div className="pt-2">
            <TabsList className="h-10 w-full grid grid-cols-2">
              <TabsTrigger value="season" className="text-xs font-black">{L.tabSeason}</TabsTrigger>
              <TabsTrigger value="games" className="text-xs font-black">{L.tabGames}</TabsTrigger>
            </TabsList>
          </div>

          {(playersQ.isLoading || (tab === "games" && gamesQ.isLoading)) && (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {(playersQ.isError || (tab === "games" && gamesQ.isError)) && (
            <div className="rounded-2xl border border-border bg-card p-5 mt-4 space-y-3">
              <p className="text-sm font-bold text-destructive">{L.loadError}</p>
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl text-xs font-bold"
                onClick={() => {
                  void playersQ.refetch();
                  if (tab === "games") void gamesQ.refetch();
                }}
              >
                {L.retry}
              </Button>
            </div>
          )}

          {showEmpty && (
            <div className="rounded-2xl border border-border bg-card p-6 mt-4 text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-muted/50 border border-border flex items-center justify-center mx-auto">
                <BarChart3 className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-black text-foreground">{L.emptyTitle}</p>
              <p className="text-xs text-muted-foreground/70 leading-relaxed">{L.emptySub}</p>
            </div>
          )}

          <TabsContent value="season" className="mt-4">
            {!playersQ.isLoading && !playersQ.isError && players.length > 0 && (
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="grid grid-cols-[1.4fr_0.8fr_0.4fr_0.55fr_0.55fr_0.55fr] gap-0 border-b border-border bg-muted/30 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  <button type="button" className="text-left" onClick={() => toggleSort("playerName")}>{L.colPlayer}</button>
                  <button type="button" className="text-left" onClick={() => toggleSort("teamName")}>{L.colTeam}</button>
                  <button type="button" className="text-right" onClick={() => toggleSort("games")}>{L.colG}</button>
                  <button type="button" className="text-right" onClick={() => toggleSort("ppg")}>{L.colPPG}</button>
                  <button type="button" className="text-right" onClick={() => toggleSort("rpg")}>{L.colRPG}</button>
                  <button type="button" className="text-right" onClick={() => toggleSort("apg")}>{L.colAPG}</button>
                </div>

                {sortedPlayers.map((p) => {
                  const key = `${p.playerName}__${p.teamName}__${p.season}`;
                  const expanded = expandedKey === key;
                  return (
                    <div key={key} className="border-b border-border last:border-b-0">
                      <button
                        type="button"
                        onClick={() => setExpandedKey(expanded ? null : key)}
                        className="w-full px-3 py-3 grid grid-cols-[1.4fr_0.8fr_0.4fr_0.55fr_0.55fr_0.55fr] items-center gap-0 text-left hover:bg-muted/30 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-extrabold text-foreground truncate">{p.playerName}</p>
                          <p className="text-[10px] text-muted-foreground/60 font-semibold truncate">{p.season}</p>
                        </div>
                        <p className="text-xs font-semibold text-muted-foreground truncate">{p.teamName}</p>
                        <p className="text-xs font-black text-foreground tabular-nums text-right">{p.games}</p>
                        <p className="text-xs font-black text-foreground tabular-nums text-right">{p.ppg.toFixed(1)}</p>
                        <p className="text-xs font-black text-foreground tabular-nums text-right">{p.rpg.toFixed(1)}</p>
                        <p className="text-xs font-black text-foreground tabular-nums text-right">{p.apg.toFixed(1)}</p>
                      </button>

                      {expanded && (
                        <div className="px-3 pb-3">
                          <div className="rounded-xl border border-border bg-background/40 px-3 py-2.5">
                            <div className="grid grid-cols-4 gap-2 text-[11px]">
                              <StatChip label={L.mpg} value={p.mpg.toFixed(1)} />
                              <StatChip label={L.spg} value={p.spg.toFixed(1)} />
                              <StatChip label={L.bpg} value={p.bpg.toFixed(1)} />
                              <StatChip label={L.topg} value={p.topg.toFixed(1)} />
                            </div>
                            <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                              <StatChip label={L.colFG} value={p.fgPct == null ? "—" : `${p.fgPct.toFixed(1)}%`} />
                              <StatChip label={L.col3P} value={p.fg3Pct == null ? "—" : `${p.fg3Pct.toFixed(1)}%`} />
                              <StatChip label={L.colFT} value={p.ftPct == null ? "—" : `${p.ftPct.toFixed(1)}%`} />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                <div className="px-3 py-2 text-[10px] text-muted-foreground/60 font-semibold bg-muted/20">
                  {es ? "Toca una fila para ver más" : zh ? "点按查看更多" : "Tap a row for more"}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="games" className="mt-4">
            {!playersQ.isLoading && !playersQ.isError && players.length > 0 && (
              <div className="space-y-3">
                <div className="rounded-2xl border border-border bg-card p-3">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1">
                    {L.selectPlayer}
                  </label>
                  <select
                    value={selectedPlayerSafe}
                    onChange={(e) => setSelectedPlayer(e.target.value)}
                    className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm font-bold text-foreground"
                  >
                    {playerOptions.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>

                {!gamesQ.isLoading && !gamesQ.isError && games.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
                    <p className="text-sm font-bold text-muted-foreground">{L.gamesEmpty}</p>
                  </div>
                )}

                {!gamesQ.isLoading && !gamesQ.isError && games.length > 0 && (
                  <div className="rounded-2xl border border-border bg-card overflow-hidden">
                    {games.map((g) => (
                      <div key={g.id} className="px-4 py-3 border-b border-border last:border-b-0">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-extrabold text-foreground truncate">
                              {g.gameDate ? g.gameDate : "—"}
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {g.rivalName ?? "—"}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[11px] font-black text-foreground tabular-nums">
                              {num(g.points)}/{num(g.reboundsTotal)}/{num(g.assists)}{" "}
                              <span className="text-muted-foreground/60 font-semibold">·</span>{" "}
                              {g.minutes == null ? "—" : num(g.minutes).toFixed(1)}
                            </p>
                            <p className="text-[10px] font-bold text-muted-foreground tabular-nums">
                              {L.plusMinus}:{" "}
                              <span className={cn(
                                "font-black",
                                (g.plusMinus ?? 0) > 0 ? "text-emerald-600 dark:text-emerald-400"
                                : (g.plusMinus ?? 0) < 0 ? "text-rose-600 dark:text-rose-400"
                                : "text-muted-foreground",
                              )}>
                                {g.plusMinus == null ? "—" : String(g.plusMinus)}
                              </span>
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </ModulePageShell>
  );
}

function StatChip(props: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-2.5 py-2">
      <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/60">{props.label}</p>
      <p className="text-[12px] font-black text-foreground tabular-nums mt-0.5">{props.value}</p>
    </div>
  );
}

