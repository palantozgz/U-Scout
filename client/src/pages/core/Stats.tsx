import { useEffect, useMemo, useState } from "react";
import { BarChart3, ChevronDown, Trophy, Users, Shield } from "lucide-react";
import { useSearch, useLocation } from "wouter";
import { ModulePageShell } from "./ModulePage";
import { useLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  usePlayerSeasonStats,
  useSeasons,
  useStandings,
  useLeaders,
  type PlayerSeasonStats,
  type LeaderRow,
  type StandingsRow,
} from "@/lib/stats-api";

type MainTab = "liga" | "jugadoras" | "equipos";
type LigaSegment = "clasificacion" | "lideres";
type JugadorasSort = "ppg" | "rpg" | "apg";
type LeaderStatKey = "ppg" | "rpg" | "apg" | "spg" | "bpg" | "fgPct";

function parseMainTab(search: string): MainTab {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const t = new URLSearchParams(raw).get("tab");
  if (t === "jugadoras" || t === "equipos" || t === "liga") return t;
  return "liga";
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function leaderStatLabel(key: LeaderStatKey, L: Record<string, string>): string {
  switch (key) {
    case "ppg":
      return L.leaderPPG;
    case "rpg":
      return L.leaderRPG;
    case "apg":
      return L.leaderAPG;
    case "spg":
      return L.leaderSPG;
    case "bpg":
      return L.leaderBPG;
    case "fgPct":
      return L.leaderFG;
    default:
      return key;
  }
}

function formatLeaderValue(stat: string, value: unknown): string {
  if (value == null || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  if (stat === "fgPct") return `${n.toFixed(1)}%`;
  return n.toFixed(1);
}

function displayLeaderPlayerName(row: LeaderRow, preferEn: boolean): string {
  if (preferEn && row.playerNameEn?.trim()) return row.playerNameEn.trim();
  return row.playerName ?? "";
}

export default function Stats() {
  const { t, locale } = useLocale();
  const es = locale === "es";
  const zh = locale === "zh";
  const preferEnLeaderName = locale === "en" || locale === "es";

  const search = useSearch();
  const [, setLocation] = useLocation();

  const L = {
    tabLiga: es ? "Liga" : zh ? "联赛" : "League",
    tabJugadoras: es ? "Jugadoras" : zh ? "球员" : "Players",
    tabEquipos: es ? "Equipos" : zh ? "球队" : "Teams",
    segClasificacion: es ? "Clasificación" : zh ? "排名" : "Standings",
    segLideres: es ? "Líderes" : zh ? "领袖" : "Leaders",
    seasonPick: es ? "Temporada" : zh ? "赛季" : "Season",
    emptyTitle: es ? "Esperando datos del scraper" : zh ? "等待采集器数据" : "Waiting for scraper data",
    emptySub: es
      ? "Los datos se actualizarán automáticamente cuando el colector esté activo"
      : zh
        ? "当采集器上线后，数据将自动更新"
        : "Data will update automatically when the collector is active",
    retry: es ? "Reintentar" : zh ? "重试" : "Retry",
    loadError: es ? "Error al cargar estadísticas" : zh ? "加载统计失败" : "Failed to load stats",
    colRank: es ? "#" : zh ? "#" : "#",
    colTeam: es ? "Equipo" : zh ? "队伍" : "Team",
    colWL: es ? "W-L" : zh ? "胜负" : "W-L",
    colPPG: es ? "PPG" : zh ? "得分" : "PPG",
    colOPPG: es ? "OPPG" : zh ? "失分" : "OPP PPG",
    colNET: es ? "NET" : zh ? "净效" : "NET",
    colPlayer: es ? "Jugadora" : zh ? "球员" : "Player",
    colG: es ? "PJ" : zh ? "场" : "G",
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
    plusMinus: "+/-",
    allTeams: es ? "Todos" : zh ? "全部" : "All",
    tapRowMore: es ? "Toca una fila para ver más" : zh ? "点按查看更多" : "Tap a row for more",
    leadersEmpty: es ? "Sin líderes" : zh ? "暂无数据" : "No leaders yet",
    standingsEmpty: es ? "Sin clasificación" : zh ? "暂无排名" : "No standings",
    teamsEmpty: es ? "Sin equipos" : zh ? "暂无球队" : "No teams",
    leaderPPG: "PPG",
    leaderRPG: "RPG",
    leaderAPG: "APG",
    leaderSPG: "SPG",
    leaderBPG: "BPG",
    leaderFG: "FG%",
    sortPPG: "PPG",
    sortRPG: "RPG",
    sortAPG: "APG",
    tbd: "—",
  };

  const LEADER_STAT_KEYS: LeaderStatKey[] = ["ppg", "rpg", "apg", "spg", "bpg", "fgPct"];

  const [mainTab, setMainTab] = useState<MainTab>(() => parseMainTab(search));
  const [ligaSegment, setLigaSegment] = useState<LigaSegment>("clasificacion");
  const [leaderStat, setLeaderStat] = useState<LeaderStatKey>("ppg");
  const [jugadorasTeam, setJugadorasTeam] = useState<string>("");
  const [jugadorasSort, setJugadorasSort] = useState<JugadorasSort>("ppg");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [seasonSheetOpen, setSeasonSheetOpen] = useState(false);
  const [seasonId, setSeasonId] = useState<number | null>(null);

  useEffect(() => {
    setMainTab(parseMainTab(search));
  }, [search]);

  const setTabAndLocation = (tab: MainTab) => {
    setMainTab(tab);
    const raw = search.startsWith("?") ? search.slice(1) : search;
    const qs = new URLSearchParams(raw);
    qs.set("tab", tab);
    setLocation(`/stats?${qs.toString()}`);
  };

  const seasonsQ = useSeasons();
  const seasons = seasonsQ.data?.seasons ?? [];
  const effectiveSeasonId = seasonId ?? seasons[0]?.seasonId ?? 2092;
  const seasonLabel =
    seasons.find((s) => s.seasonId === effectiveSeasonId)?.label ?? String(effectiveSeasonId);

  const playersQ = usePlayerSeasonStats();
  const playersRaw = playersQ.data?.players ?? [];

  const standingsQ = useStandings(effectiveSeasonId);
  const leadersQ = useLeaders(effectiveSeasonId, leaderStat);

  const seasonMetaLabel = seasons.find((s) => s.seasonId === effectiveSeasonId)?.label;
  const playersForSeason = useMemo(() => {
    if (!seasonMetaLabel) return playersRaw;
    const filtered = playersRaw.filter((p) => p.season === seasonMetaLabel);
    return filtered.length > 0 ? filtered : playersRaw;
  }, [playersRaw, seasonMetaLabel]);

  const teamOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of playersForSeason) {
      if (p.teamName?.trim()) set.add(p.teamName.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [playersForSeason]);

  const jugadorasFiltered = useMemo(() => {
    let list = playersForSeason;
    if (jugadorasTeam.trim()) list = list.filter((p) => p.teamName === jugadorasTeam);
    return [...list].sort((a, b) => num(b[jugadorasSort]) - num(a[jugadorasSort]));
  }, [playersForSeason, jugadorasTeam, jugadorasSort]);

  const standingsRows = standingsQ.data?.standings ?? [];
  const leadersRows = leadersQ.data?.leaders ?? [];

  const showJugadorasEmpty = !playersQ.isLoading && !playersQ.isError && jugadorasFiltered.length === 0;

  const showGlobalSpinner =
    (mainTab === "liga" &&
      (seasonsQ.isLoading || standingsQ.isLoading || (ligaSegment === "lideres" && leadersQ.isLoading))) ||
    (mainTab === "jugadoras" && playersQ.isLoading) ||
    (mainTab === "equipos" && (seasonsQ.isLoading || standingsQ.isLoading));

  const refetchAll = () => {
    void seasonsQ.refetch();
    void playersQ.refetch();
    void standingsQ.refetch();
    void leadersQ.refetch();
  };

  return (
    <ModulePageShell title={t("ucore_card_stats_title")} moduleHeader={{ module: "stats", tagline: t("tagline_stats") }}>
      <div className="px-4 pb-10 max-w-md mx-auto w-full">
        <div className="flex items-center justify-end pt-2 pb-1">
          <button
            type="button"
            onClick={() => setSeasonSheetOpen(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          >
            {seasonLabel}
            <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-70" />
          </button>
        </div>

        <Sheet open={seasonSheetOpen} onOpenChange={setSeasonSheetOpen}>
          <SheetContent side="bottom" className="rounded-t-2xl">
            <SheetHeader>
              <SheetTitle className="text-left">{L.seasonPick}</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-1 max-h-[50dvh] overflow-y-auto">
              {seasonsQ.isLoading ? (
                <p className="text-sm text-muted-foreground py-4 text-center">…</p>
              ) : seasons.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">{L.tbd}</p>
              ) : (
                seasons.map((s) => (
                  <button
                    key={s.seasonId}
                    type="button"
                    onClick={() => {
                      setSeasonId(s.seasonId);
                      setSeasonSheetOpen(false);
                    }}
                    className={cn(
                      "w-full text-left rounded-xl px-3 py-3 text-sm font-bold transition-colors",
                      s.seasonId === effectiveSeasonId ? "bg-primary/15 text-primary" : "hover:bg-muted/50",
                    )}
                  >
                    {s.label}
                  </button>
                ))
              )}
            </div>
          </SheetContent>
        </Sheet>

        <Tabs value={mainTab} onValueChange={(v) => setTabAndLocation(v as MainTab)} className="w-full">
          <TabsList className="h-10 w-full grid grid-cols-3 gap-0.5">
            <TabsTrigger value="liga" className="text-[10px] sm:text-xs font-black px-1 gap-1">
              <Trophy className="w-3.5 h-3.5 shrink-0 opacity-80" />
              {L.tabLiga}
            </TabsTrigger>
            <TabsTrigger value="jugadoras" className="text-[10px] sm:text-xs font-black px-1 gap-1">
              <Users className="w-3.5 h-3.5 shrink-0 opacity-80" />
              {L.tabJugadoras}
            </TabsTrigger>
            <TabsTrigger value="equipos" className="text-[10px] sm:text-xs font-black px-1 gap-1">
              <Shield className="w-3.5 h-3.5 shrink-0 opacity-80" />
              {L.tabEquipos}
            </TabsTrigger>
          </TabsList>

          {showGlobalSpinner && (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!showGlobalSpinner &&
            (playersQ.isError || standingsQ.isError || leadersQ.isError || seasonsQ.isError) && (
              <div className="rounded-2xl border border-border bg-card p-5 mt-4 space-y-3">
                <p className="text-sm font-bold text-destructive">{L.loadError}</p>
                <Button size="sm" variant="outline" className="rounded-xl text-xs font-bold" onClick={() => void refetchAll()}>
                  {L.retry}
                </Button>
              </div>
            )}

          <TabsContent value="liga" className={cn("mt-4 space-y-3", showGlobalSpinner && "hidden")}>
            <div className="flex rounded-xl border border-border bg-muted/20 p-1">
              <button
                type="button"
                onClick={() => setLigaSegment("clasificacion")}
                className={cn(
                  "flex-1 rounded-lg py-2 text-xs font-black transition-colors",
                  ligaSegment === "clasificacion" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground",
                )}
              >
                {L.segClasificacion}
              </button>
              <button
                type="button"
                onClick={() => setLigaSegment("lideres")}
                className={cn(
                  "flex-1 rounded-lg py-2 text-xs font-black transition-colors",
                  ligaSegment === "lideres" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground",
                )}
              >
                {L.segLideres}
              </button>
            </div>

            {!standingsQ.isLoading && !standingsQ.isError && ligaSegment === "clasificacion" && (
              <>
                {standingsRows.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center text-sm font-bold text-muted-foreground">
                    {L.standingsEmpty}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-border bg-card overflow-hidden">
                    <div className="grid grid-cols-[0.35fr_1fr_0.55fr_0.45fr_0.45fr] gap-1 border-b border-border bg-muted/30 px-2 py-2 text-[9px] font-black uppercase tracking-wider text-muted-foreground">
                      <span className="text-center">{L.colRank}</span>
                      <span>{L.colTeam}</span>
                      <span className="text-right">{L.colWL}</span>
                      <span className="text-right">{L.colPPG}</span>
                      <span className="text-right">{L.colOPPG}</span>
                    </div>
                    {standingsRows.map((row: StandingsRow) => (
                      <div
                        key={String(row.teamExternalId)}
                        className="grid grid-cols-[0.35fr_1fr_0.55fr_0.45fr_0.45fr] gap-1 items-center px-2 py-2 border-b border-border last:border-b-0 text-xs"
                      >
                        <p className="text-center font-black tabular-nums text-muted-foreground">{row.rank}</p>
                        <div className="min-w-0 flex items-center gap-2">
                          {row.logoUrl ? (
                            <img src={row.logoUrl} alt="" className="w-7 h-7 rounded-md object-contain bg-muted/30 shrink-0" />
                          ) : (
                            <div className="w-7 h-7 rounded-md bg-muted/40 shrink-0" />
                          )}
                          <p className="font-bold text-foreground truncate">{row.teamName}</p>
                        </div>
                        <p className="text-right font-black tabular-nums">
                          {row.wins}-{row.losses}
                        </p>
                        <p className="text-right font-black tabular-nums">{row.ppg != null ? num(row.ppg).toFixed(1) : "—"}</p>
                        <p className="text-right font-black tabular-nums">{row.oppg != null ? num(row.oppg).toFixed(1) : "—"}</p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {!leadersQ.isLoading && !leadersQ.isError && ligaSegment === "lideres" && (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {LEADER_STAT_KEYS.map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setLeaderStat(k)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[10px] font-black transition-colors",
                        leaderStat === k
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border bg-card text-muted-foreground hover:bg-muted/40",
                      )}
                    >
                      {leaderStatLabel(k, L)}
                    </button>
                  ))}
                </div>
                {leadersRows.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center text-sm font-bold text-muted-foreground">
                    {L.leadersEmpty}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
                    {leadersRows.map((row: LeaderRow, idx: number) => (
                      <div key={row.externalId} className="flex items-center gap-3 px-3 py-2.5">
                        <span className="w-6 text-center text-[11px] font-black text-muted-foreground tabular-nums">{idx + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-extrabold text-foreground truncate">
                            {displayLeaderPlayerName(row, preferEnLeaderName)}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">{row.teamName ?? "—"}</p>
                        </div>
                        <p className="text-sm font-black tabular-nums text-foreground shrink-0">
                          {formatLeaderValue(leadersQ.data?.stat ?? leaderStat, row.value)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="jugadoras" className={cn("mt-4 space-y-3", showGlobalSpinner && "hidden")}>
            {showJugadorasEmpty && (
              <div className="rounded-2xl border border-border bg-card p-6 text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-muted/50 border border-border flex items-center justify-center mx-auto">
                  <BarChart3 className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-black text-foreground">{L.emptyTitle}</p>
                <p className="text-xs text-muted-foreground/70 leading-relaxed">{L.emptySub}</p>
              </div>
            )}

            {!playersQ.isLoading && !playersQ.isError && jugadorasFiltered.length > 0 && (
              <>
                <div className="rounded-2xl border border-border bg-card p-3 space-y-2">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-muted-foreground">{L.colTeam}</label>
                  <select
                    value={jugadorasTeam}
                    onChange={(e) => setJugadorasTeam(e.target.value)}
                    className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm font-bold text-foreground"
                  >
                    <option value="">{L.allTeams}</option>
                    {teamOptions.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-1.5 flex-wrap">
                  {(["ppg", "rpg", "apg"] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setJugadorasSort(k)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-[11px] font-black transition-colors",
                        jugadorasSort === k
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border bg-card text-muted-foreground hover:bg-muted/40",
                      )}
                    >
                      {k === "ppg" ? L.sortPPG : k === "rpg" ? L.sortRPG : L.sortAPG}
                    </button>
                  ))}
                </div>

                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                  <div className="grid grid-cols-[1.4fr_0.8fr_0.4fr_0.55fr_0.55fr_0.55fr] gap-0 border-b border-border bg-muted/30 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                    <span className="text-left">{L.colPlayer}</span>
                    <span className="text-left">{L.colTeam}</span>
                    <span className="text-right">{L.colG}</span>
                    <span className="text-right">{L.colPPG}</span>
                    <span className="text-right">{L.colRPG}</span>
                    <span className="text-right">{L.colAPG}</span>
                  </div>

                  {jugadorasFiltered.map((p: PlayerSeasonStats) => {
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

                  <div className="px-3 py-2 text-[10px] text-muted-foreground/60 font-semibold bg-muted/20">{L.tapRowMore}</div>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="equipos" className={cn("mt-4", showGlobalSpinner && "hidden")}>
            {!standingsQ.isLoading && !standingsQ.isError && (
              <>
                {standingsRows.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center text-sm font-bold text-muted-foreground">
                    {L.teamsEmpty}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-border bg-card overflow-hidden">
                    <div className="grid grid-cols-[0.35fr_1fr_0.5fr_0.45fr_0.45fr_0.45fr] gap-1 border-b border-border bg-muted/30 px-2 py-2 text-[9px] font-black uppercase tracking-wider text-muted-foreground">
                      <span className="text-center">{L.colRank}</span>
                      <span>{L.colTeam}</span>
                      <span className="text-right">{L.colWL}</span>
                      <span className="text-right">{L.colPPG}</span>
                      <span className="text-right">{L.colOPPG}</span>
                      <span className="text-right">{L.colNET}</span>
                    </div>
                    {standingsRows.map((row: StandingsRow) => {
                      const net =
                        row.ppg != null && row.oppg != null && Number.isFinite(num(row.ppg)) && Number.isFinite(num(row.oppg))
                          ? (num(row.ppg) - num(row.oppg)).toFixed(1)
                          : "—";
                      return (
                        <button
                          key={String(row.teamExternalId)}
                          type="button"
                          className="w-full grid grid-cols-[0.35fr_1fr_0.5fr_0.45fr_0.45fr_0.45fr] gap-1 items-center px-2 py-2 border-b border-border last:border-b-0 text-xs text-left hover:bg-muted/25 transition-colors"
                        >
                          <p className="text-center font-black tabular-nums text-muted-foreground">{row.rank}</p>
                          <div className="min-w-0 flex items-center gap-2">
                            {row.logoUrl ? (
                              <img src={row.logoUrl} alt="" className="w-7 h-7 rounded-md object-contain bg-muted/30 shrink-0" />
                            ) : (
                              <div className="w-7 h-7 rounded-md bg-muted/40 shrink-0" />
                            )}
                            <p className="font-bold text-foreground truncate">{row.teamName}</p>
                          </div>
                          <p className="text-right font-black tabular-nums">
                            {row.wins}-{row.losses}
                          </p>
                          <p className="text-right font-black tabular-nums">{row.ppg != null ? num(row.ppg).toFixed(1) : "—"}</p>
                          <p className="text-right font-black tabular-nums">{row.oppg != null ? num(row.oppg).toFixed(1) : "—"}</p>
                          <p className="text-right font-black tabular-nums">{net}</p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
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
