import { useEffect, useMemo, useState } from "react";
import { BarChart3, ChevronDown, ChevronLeft, ChevronRight, Trophy, Users } from "lucide-react";
import { useSearch, useLocation } from "wouter";
import { ModulePageShell } from "./ModulePage";
import { LandscapeHint } from "@/components/LandscapeHint";
import { StatsRadar } from "@/components/StatsRadar";
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
  usePlayerDetail,
  useTeamDetail,
  toTitleCase,
  type PlayerSeasonStats,
  type LeaderRow,
  type StandingsRow,
  type GameLogEntry,
  type TeamDetail,
  type TeamRosterPlayer,
} from "@/lib/stats-api";

type MainTab = "liga" | "jugadoras";
type LigaSegment = "clasificacion" | "lideres";
type JugadorasSort = "ppg" | "rpg" | "apg";
type LeaderStatKey = "ppg" | "rpg" | "apg" | "spg" | "bpg" | "fgPct";
type PlayerSheetId = string | null;

function parseMainTab(search: string): MainTab {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const t = new URLSearchParams(raw).get("tab");
  if (t === "jugadoras" || t === "liga") return t;
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
  if (preferEn && row.playerNameEn?.trim()) return toTitleCase(row.playerNameEn) ?? row.playerName ?? "";
  return row.playerName ?? "";
}

function minutesToDisplay(minutes: string | null): string {
  if (!minutes) return "—";
  if (/^\d+:\d{2}$/.test(minutes)) return minutes;
  const n = Number(minutes);
  if (Number.isFinite(n)) {
    const m = Math.floor(n);
    const s = Math.round((n - m) * 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }
  return minutes;
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
    jugadorasFilterEmpty: es ? "Sin jugadoras en este equipo" : zh ? "该队暂无球员" : "No players on this team",
    jugadorasSearchEmpty: es ? "Sin resultados" : zh ? "无匹配结果" : "No results",
    leadersSubtitle: es ? "Top 10 de la temporada" : zh ? "赛季前十名" : "Top 10 this season",
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
  const [jugadorasSearch, setJugadorasSearch] = useState("");
  const [jugadorasLimit, setJugadorasLimit] = useState(50);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [playerSheetId, setPlayerSheetId] = useState<PlayerSheetId>(null);
  const [teamSheetId, setTeamSheetId] = useState<string | null>(null);
  const [returnToTeamId, setReturnToTeamId] = useState<string | null>(null);
  const [seasonSheetOpen, setSeasonSheetOpen] = useState(false);
  const [seasonId, setSeasonId] = useState<number | null>(null);

  useEffect(() => {
    const raw = search.startsWith("?") ? search.slice(1) : search;
    const qs = new URLSearchParams(raw);
    const tab = qs.get("tab");
    if (tab === "jugadoras" || tab === "liga") setMainTab(tab);
    const player = qs.get("player");
    if (player) setPlayerSheetId(player);
  }, [search]);

  useEffect(() => {
    setJugadorasLimit(50);
  }, [jugadorasTeam, jugadorasSort, jugadorasSearch]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [leaderStat]);

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
      if (p.games > 0 && p.teamName?.trim()) set.add(p.teamName.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [playersForSeason]);

  const jugadorasFiltered = useMemo(() => {
    let list = playersForSeason.filter((p) => p.games > 0);
    if (jugadorasTeam.trim()) list = list.filter((p) => p.teamName === jugadorasTeam);
    const q = jugadorasSearch.trim().toLowerCase();
    if (q) list = list.filter((p) => p.playerName.toLowerCase().includes(q));
    return [...list].sort((a, b) => num(b[jugadorasSort]) - num(a[jugadorasSort]));
  }, [playersForSeason, jugadorasTeam, jugadorasSort, jugadorasSearch]);

  const playersWithGamesForSeason = useMemo(
    () => playersForSeason.filter((p) => p.games > 0),
    [playersForSeason],
  );

  const standingsRows = standingsQ.data?.standings ?? [];
  const leadersRows = leadersQ.data?.leaders ?? [];

  const standingsGroups = useMemo(() => {
    const rows = standingsRows;
    if (rows.length === 0) return { showHeaders: false, groups: [] as { label: string | null; rows: StandingsRow[] }[] };

    const phaseKey = (r: StandingsRow) =>
      r.phaseName != null && String(r.phaseName).trim() !== "" ? String(r.phaseName).trim() : "__default__";

    const order: string[] = [];
    for (const r of rows) {
      const k = phaseKey(r);
      if (!order.includes(k)) order.push(k);
    }
    const showHeaders = order.length > 1;
    const groups = order.map((k) => {
      const label = k === "__default__" ? null : k;
      const groupRows = rows.filter((r) => phaseKey(r) === k).sort((a, b) => b.wins - a.wins);
      return { label, rows: groupRows };
    });
    return { showHeaders, groups };
  }, [standingsRows]);

  const showJugadorasEmpty =
    !playersQ.isLoading && !playersQ.isError && playersWithGamesForSeason.length === 0;
  const showJugadorasTeamFilterEmpty =
    !playersQ.isLoading && !playersQ.isError && playersWithGamesForSeason.length > 0 && jugadorasFiltered.length === 0;
  const jugadorasFilterEmptyMessage = jugadorasSearch.trim() ? L.jugadorasSearchEmpty : L.jugadorasFilterEmpty;
  const jugadorasVerMasLabel = (n: number) =>
    es ? `Ver ${n} más` : zh ? `再显示 ${n} 人` : `See ${n} more`;

  const showGlobalSpinner =
    (mainTab === "liga" &&
      (seasonsQ.isLoading || standingsQ.isLoading || (ligaSegment === "lideres" && leadersQ.isLoading))) ||
    (mainTab === "jugadoras" && playersQ.isLoading);

  const refetchAll = () => {
    void seasonsQ.refetch();
    void playersQ.refetch();
    void standingsQ.refetch();
    void leadersQ.refetch();
  };

  return (
    <ModulePageShell title={t("ucore_card_stats_title")} moduleHeader={{ module: "stats", tagline: t("tagline_stats") }}>
      <>
      <div className="px-4 pb-10 max-w-md mx-auto w-full">
        <div className="flex items-center justify-end pt-2 pb-1">
          <button
            type="button"
            onClick={() => setSeasonSheetOpen(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          >
            {seasonsQ.isLoading ? (
              <span className="w-10 h-2.5 rounded bg-muted-foreground/20 animate-pulse inline-block" />
            ) : (
              seasonLabel
            )}
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
          <TabsList className="h-10 w-full grid grid-cols-2 gap-0.5">
            <TabsTrigger value="liga" className="text-[10px] sm:text-xs font-black px-1 gap-1">
              <Trophy className="w-3.5 h-3.5 shrink-0 opacity-80" />
              {L.tabLiga}
            </TabsTrigger>
            <TabsTrigger value="jugadoras" className="text-[10px] sm:text-xs font-black px-1 gap-1">
              <Users className="w-3.5 h-3.5 shrink-0 opacity-80" />
              {L.tabJugadoras}
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
                    <div className="grid grid-cols-[0.3fr_1fr_0.5fr_0.4fr_0.4fr_0.4fr] gap-1 border-b border-border bg-muted/30 px-2 py-2 text-[9px] font-black uppercase tracking-wider text-muted-foreground">
                      <span className="text-center">{L.colRank}</span>
                      <span>{L.colTeam}</span>
                      <span className="text-right">{L.colWL}</span>
                      <span className="text-right">{L.colPPG}</span>
                      <span className="text-right">{L.colOPPG}</span>
                      <span className="text-right">{L.colNET}</span>
                    </div>
                    {standingsGroups.groups.map((group, gi) => (
                      <div key={`${group.label ?? "default"}-${gi}`}>
                        {standingsGroups.showHeaders && (
                          <p className="px-2 py-1.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/15">
                            {group.label ?? "—"}
                          </p>
                        )}
                        {group.rows.map((row: StandingsRow) => {
                          const netNum =
                            row.ppg != null && row.oppg != null && Number.isFinite(num(row.ppg)) && Number.isFinite(num(row.oppg))
                              ? num(row.ppg) - num(row.oppg)
                              : null;
                          const netStr = netNum != null ? (netNum > 0 ? `+${netNum.toFixed(1)}` : netNum.toFixed(1)) : "—";
                          return (
                          <button
                            key={String(row.teamExternalId)}
                            type="button"
                            onClick={() => setTeamSheetId(String(row.teamExternalId))}
                            className="w-full grid grid-cols-[0.3fr_1fr_0.5fr_0.4fr_0.4fr_0.4fr] gap-1 items-center px-2 py-2 border-b border-border last:border-b-0 text-xs text-left touch-manipulation hover:bg-muted/25 active:bg-muted/40 active:opacity-90 transition-colors"
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
                            <p
                              className={cn(
                                "text-right font-black tabular-nums",
                                netNum == null
                                  ? "text-muted-foreground"
                                  : netNum > 0
                                    ? "text-green-600 dark:text-green-400"
                                    : netNum < 0
                                      ? "text-destructive"
                                      : "text-muted-foreground",
                              )}
                            >
                              {netStr}
                            </p>
                          </button>
                          );
                        })}
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
                  <>
                    <p className="text-[10px] text-muted-foreground px-0.5 -mt-1">{L.leadersSubtitle}</p>
                  <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
                    {leadersRows.slice(0, 10).map((row: LeaderRow, idx: number) => (
                      <button
                        key={row.externalId}
                        type="button"
                        onClick={() => setPlayerSheetId(String(row.externalId))}
                        className="w-full flex items-center gap-3 px-3 py-2.5 touch-manipulation hover:bg-muted/30 active:bg-muted/45 active:opacity-90 transition-colors text-left"
                      >
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
                      </button>
                    ))}
                  </div>
                  </>
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

            {showJugadorasTeamFilterEmpty && (
              <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-8 text-center text-sm font-bold text-muted-foreground">
                {jugadorasFilterEmptyMessage}
              </div>
            )}

            {!playersQ.isLoading && !playersQ.isError && jugadorasFiltered.length > 0 && (
              <>
                <input
                  type="text"
                  placeholder={es ? "Buscar jugadora..." : zh ? "搜索球员..." : "Search player..."}
                  value={jugadorasSearch}
                  onChange={(e) => setJugadorasSearch(e.target.value)}
                  className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/50"
                />
                <div className="flex flex-nowrap gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1">
                  <button
                    type="button"
                    onClick={() => setJugadorasTeam("")}
                    className={cn(
                      "shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-black transition-colors",
                      !jugadorasTeam.trim()
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border bg-card text-muted-foreground hover:bg-muted/40",
                    )}
                  >
                    {L.allTeams}
                  </button>
                  {teamOptions.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setJugadorasTeam(name)}
                      className={cn(
                        "shrink-0 max-w-[200px] truncate rounded-full border px-3 py-1.5 text-[11px] font-black transition-colors",
                        jugadorasTeam === name
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border bg-card text-muted-foreground hover:bg-muted/40",
                      )}
                    >
                      {name}
                    </button>
                  ))}
                </div>

                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                  <div className="grid grid-cols-[1.8fr_0.4fr_0.6fr_0.6fr_0.6fr] gap-0 border-b border-border bg-muted/30 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                    <span className="text-left">{L.colPlayer}</span>
                    <span className="text-right">{L.colG}</span>
                    {(["ppg", "rpg", "apg"] as const).map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setJugadorasSort(k)}
                        className={cn(
                          "text-right font-black uppercase tracking-wider text-[10px] touch-manipulation flex items-center justify-end gap-0.5 w-full",
                          jugadorasSort === k ? "text-primary" : "text-muted-foreground",
                        )}
                      >
                        {k === "ppg" ? L.sortPPG : k === "rpg" ? L.sortRPG : L.sortAPG}
                        {jugadorasSort === k && <span className="text-[8px]">▼</span>}
                      </button>
                    ))}
                  </div>

                  {jugadorasFiltered.slice(0, jugadorasLimit).map((p: PlayerSeasonStats) => {
                    const key = `${p.externalId}__${p.playerName}`;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setPlayerSheetId(p.externalId)}
                        className="w-full px-3 py-3 grid grid-cols-[1.8fr_0.4fr_0.6fr_0.6fr_0.6fr] items-center gap-0 text-left touch-manipulation hover:bg-muted/30 active:bg-muted/45 active:opacity-90 transition-colors border-b border-border last:border-b-0"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-extrabold text-foreground truncate">{p.playerName}</p>
                          <p className="text-[10px] text-muted-foreground/60 font-semibold truncate">{p.teamName ?? p.season}</p>
                        </div>
                        <p className="text-xs font-black text-foreground tabular-nums text-right">{p.games}</p>
                        <p className="text-xs font-black text-foreground tabular-nums text-right">{num(p.ppg).toFixed(1)}</p>
                        <p className="text-xs font-black text-foreground tabular-nums text-right">{num(p.rpg).toFixed(1)}</p>
                        <p className="text-xs font-black text-foreground tabular-nums text-right">{num(p.apg).toFixed(1)}</p>
                      </button>
                    );
                  })}
                </div>
                {jugadorasFiltered.length > jugadorasLimit && (
                  <button
                    type="button"
                    onClick={() => setJugadorasLimit((n) => n + 50)}
                    className="w-full rounded-xl border border-border bg-card py-2.5 text-xs font-black text-primary hover:bg-muted/30 transition-colors"
                  >
                    {jugadorasVerMasLabel(jugadorasFiltered.length - jugadorasLimit)}
                  </button>
                )}
              </>
            )}
          </TabsContent>

        </Tabs>
      </div>

      <Sheet
        open={Boolean(playerSheetId)}
        onOpenChange={(open) => {
          if (!open) {
            setPlayerSheetId(null);
            const raw2 = search.startsWith("?") ? search.slice(1) : search;
            const qs2 = new URLSearchParams(raw2);
            qs2.delete("player");
            const newSearch = qs2.toString();
            setLocation(newSearch ? `/stats?${newSearch}` : "/stats");
            if (returnToTeamId) {
              setTeamSheetId(returnToTeamId);
              setReturnToTeamId(null);
            }
          }
        }}
      >
        <SheetContent side="bottom" className="h-[92dvh] rounded-t-2xl p-0 flex flex-col max-w-lg mx-auto w-full">
          <StatsPlayerSheet
            externalId={playerSheetId}
            onClose={() => {
              setPlayerSheetId(null);
              const raw2 = search.startsWith("?") ? search.slice(1) : search;
              const qs2 = new URLSearchParams(raw2);
              qs2.delete("player");
              const newSearch = qs2.toString();
              setLocation(newSearch ? `/stats?${newSearch}` : "/stats");
              if (returnToTeamId) {
                setTeamSheetId(returnToTeamId);
                setReturnToTeamId(null);
              }
            }}
            onTeamTap={(teamId) => {
              setPlayerSheetId(null);
              setReturnToTeamId(null);
              setTeamSheetId(teamId);
            }}
            returnToTeamId={returnToTeamId}
            locale={locale}
          />
        </SheetContent>
      </Sheet>

      <Sheet open={Boolean(teamSheetId)} onOpenChange={(open) => { if (!open) setTeamSheetId(null); }}>
        <SheetContent side="bottom" className="h-[92dvh] rounded-t-2xl p-0 flex flex-col max-w-lg mx-auto w-full">
          <StatsTeamSheet
            externalId={teamSheetId}
            seasonId={effectiveSeasonId}
            onClose={() => setTeamSheetId(null)}
            onPlayerTap={(id) => {
              setReturnToTeamId(teamSheetId);
              setTeamSheetId(null);
              setPlayerSheetId(id);
            }}
            locale={locale}
          />
        </SheetContent>
      </Sheet>
      </>
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

function StatsPlayerSheet({
  externalId,
  onClose,
  onTeamTap,
  returnToTeamId: _returnToTeamId,
  locale,
}: {
  externalId: string | null;
  onClose: () => void;
  onTeamTap?: (teamId: string) => void;
  returnToTeamId?: string | null;
  locale: string;
}) {
  const es = locale === "es";
  const zh = locale === "zh";
  const { data, isLoading, isError } = usePlayerDetail(externalId);
  const [showAllGames, setShowAllGames] = useState(false);
  const [showRadar, setShowRadar] = useState(false);

  useEffect(() => {
    setShowAllGames(false);
    setShowRadar(false);
  }, [externalId]);

  const player = data?.player;
  const gameLog = data?.gameLog ?? [];

  const displayName =
    (locale === "en" || locale === "es") && player?.nameEn?.trim()
      ? (toTitleCase(player.nameEn) ?? player.nameEn.trim())
      : player?.nameZh ?? "—";

  const L = {
    close: es ? "Volver" : zh ? "返回" : "Back",
    error: es ? "Error al cargar" : zh ? "加载失败" : "Failed to load",
    noData: es ? "Sin datos" : zh ? "暂无数据" : "No data",
    gameLogTitle: es ? "Últimos partidos" : zh ? "近期比赛" : "Recent games",
    dateCol: es ? "Fecha" : zh ? "日期" : "Date",
    rivalCol: es ? "Rival" : zh ? "对手" : "Rival",
    ptsCol: "PTS",
    rebCol: "REB",
    astCol: "AST",
    minCol: "MIN",
    pmCol: "+/-",
    starter: es ? "Titular" : zh ? "首发" : "Starter",
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        <button
          type="button"
          onClick={() => onClose()}
          className="p-1.5 -ml-1 rounded-lg text-muted-foreground touch-manipulation hover:text-foreground active:opacity-70 transition-colors"
          aria-label={L.close}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-base font-black text-foreground truncate">{displayName}</p>
          {player && (
            <div className="text-[11px] text-muted-foreground truncate flex flex-wrap items-center gap-x-1 gap-y-0.5 min-w-0">
              {player.jerseyNumber != null && player.jerseyNumber !== "" ? (
                <span>{`#${player.jerseyNumber} · `}</span>
              ) : null}
              {player.teamName && onTeamTap && player.teamExternalId ? (
                <button
                  type="button"
                  onClick={() => onTeamTap(String(player.teamExternalId))}
                  className="inline-flex max-w-full items-center gap-0.5 text-primary underline-offset-2 hover:underline active:opacity-70 touch-manipulation shrink-0"
                >
                  <span className="truncate">{player.teamName}</span>
                  <ChevronRight className="w-3 h-3 shrink-0" />
                </button>
              ) : (
                <span>{player.teamName ?? "—"}</span>
              )}
              {player.position ? <span>{` · ${player.position}`}</span> : null}
            </div>
          )}
        </div>
        {player && (
          <div className="shrink-0 text-right">
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              {player.games}G
            </p>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {isLoading && (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {isError && (
          <div className="rounded-2xl border border-border bg-card p-5 text-center">
            <p className="text-sm font-bold text-destructive">{L.error}</p>
          </div>
        )}

        {!isLoading && !isError && player && player.games === 0 && (
          <div className="rounded-2xl border border-dashed border-border px-6 py-10 text-center">
            <p className="text-sm font-bold text-muted-foreground">
              {es ? "Sin datos de partido disponibles" : zh ? "暂无比赛数据" : "No game data available"}
            </p>
          </div>
        )}

        {!isLoading && !isError && player && player.games > 0 && (
          <>
            <div className="rounded-2xl border border-border bg-card p-3 space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <StatChip label="PPG" value={player.ppg.toFixed(1)} />
                <StatChip label="RPG" value={player.rpg.toFixed(1)} />
                <StatChip label="APG" value={player.apg.toFixed(1)} />
              </div>
              <div className="grid grid-cols-4 gap-2">
                <StatChip label="SPG" value={player.spg.toFixed(1)} />
                <StatChip label="BPG" value={player.bpg.toFixed(1)} />
                <StatChip label="TOPG" value={player.topg.toFixed(1)} />
                <StatChip label="MPG" value={player.mpg.toFixed(1)} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <StatChip label="FG%" value={player.fgPct != null ? `${player.fgPct.toFixed(1)}%` : "—"} />
                <StatChip label="3P%" value={player.fg3Pct != null ? `${player.fg3Pct.toFixed(1)}%` : "—"} />
                <StatChip label="FT%" value={player.ftPct != null ? `${player.ftPct.toFixed(1)}%` : "—"} />
              </div>
              <button
                type="button"
                onClick={() => setShowRadar((v) => !v)}
                className="w-full rounded-xl border border-border bg-muted/20 py-2 text-xs font-black text-muted-foreground hover:bg-muted/40 active:opacity-70 touch-manipulation transition-colors flex items-center justify-center gap-1.5"
              >
                <BarChart3 className="w-3.5 h-3.5 shrink-0" />
                {showRadar
                  ? locale === "es"
                    ? "Ocultar radar"
                    : locale === "zh"
                      ? "隐藏雷达图"
                      : "Hide radar"
                  : locale === "es"
                    ? "Ver radar"
                    : locale === "zh"
                      ? "查看雷达图"
                      : "View radar"}
              </button>
              {showRadar && <StatsRadar player={player} locale={locale} />}
            </div>

            <LandscapeHint />

            {gameLog.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border px-6 py-8 text-center text-sm font-bold text-muted-foreground">
                {L.noData}
              </div>
            ) : (
              <div className="space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground px-0.5">
                  {L.gameLogTitle}
                </p>
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                  <div className="grid grid-cols-[1fr_0.9fr_0.5fr_0.5fr_0.5fr_0.5fr_0.45fr] gap-0 border-b border-border bg-muted/30 px-3 py-2 text-[9px] font-black uppercase tracking-wider text-muted-foreground">
                    <span>{L.dateCol}</span>
                    <span>{L.rivalCol}</span>
                    <span className="text-right">{L.ptsCol}</span>
                    <span className="text-right">{L.rebCol}</span>
                    <span className="text-right">{L.astCol}</span>
                    <span className="text-right">{L.minCol}</span>
                    <span className="text-right">{L.pmCol}</span>
                  </div>
                  {(showAllGames ? gameLog : gameLog.slice(0, 10)).map((g: GameLogEntry) => {
                    const date = g.gameDate
                      ? new Date(g.gameDate).toLocaleDateString(
                          locale === "zh" ? "zh-CN" : locale === "es" ? "es-ES" : "en-GB",
                          { month: "short", day: "numeric" },
                        )
                      : "—";
                    const pm = g.plusMinus > 0 ? `+${g.plusMinus}` : String(g.plusMinus);
                    return (
                      <div
                        key={g.gameId}
                        className="grid grid-cols-[1fr_0.9fr_0.5fr_0.5fr_0.5fr_0.5fr_0.45fr] gap-0 items-center px-3 py-2.5 border-b border-border last:border-b-0 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-foreground tabular-nums">{date}</p>
                          {g.isStart && (
                            <span className="text-[8px] font-black uppercase text-primary/70">{L.starter}</span>
                          )}
                        </div>
                        <p className="text-muted-foreground truncate font-semibold">{g.rivalName ?? "—"}</p>
                        <p className="text-right font-black tabular-nums text-foreground">{g.pts}</p>
                        <p className="text-right font-black tabular-nums text-foreground">{g.reb}</p>
                        <p className="text-right font-black tabular-nums text-foreground">{g.ast}</p>
                        <p className="text-right font-semibold tabular-nums text-muted-foreground">
                          {minutesToDisplay(g.minutes != null ? String(g.minutes) : null)}
                        </p>
                        <p
                          className={cn(
                            "text-right font-black tabular-nums",
                            g.plusMinus > 0
                              ? "text-green-600 dark:text-green-400"
                              : g.plusMinus < 0
                                ? "text-destructive"
                                : "text-muted-foreground",
                          )}
                        >
                          {pm}
                        </p>
                      </div>
                    );
                  })}
                </div>
                {!showAllGames && gameLog.length > 10 && (
                  <button
                    type="button"
                    onClick={() => setShowAllGames(true)}
                    className="w-full rounded-xl border border-border bg-card py-2.5 text-xs font-black text-primary touch-manipulation hover:bg-muted/30 active:bg-muted/45 active:opacity-90 transition-colors"
                  >
                    {es
                      ? `Ver ${gameLog.length - 10} partidos más`
                      : zh
                        ? `显示全部 ${gameLog.length} 场`
                        : `See all ${gameLog.length} games`}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatsTeamSheet({
  externalId,
  seasonId,
  onClose,
  onPlayerTap,
  locale,
}: {
  externalId: string | null;
  seasonId: number;
  onClose: () => void;
  onPlayerTap: (id: string) => void;
  locale: string;
}) {
  const es = locale === "es";
  const zh = locale === "zh";
  const preferEn = locale === "en" || locale === "es";
  const { data, isLoading, isError } = useTeamDetail(externalId, seasonId);

  const team = data?.team;
  const players = data?.players ?? [];
  const activePlayers = players.filter((p) => p.games > 0);

  const teamName = team?.nameZh ?? "—";

  const L = {
    close: es ? "Volver" : zh ? "返回" : "Back",
    error: es ? "Error al cargar" : zh ? "加载失败" : "Failed to load",
    noData: es ? "Sin datos" : zh ? "暂无数据" : "No data",
    roster: es ? "Plantilla" : zh ? "阵容" : "Roster",
    colPlayer: es ? "Jugadora" : zh ? "球员" : "Player",
    colG: es ? "PJ" : zh ? "场" : "G",
    teamNoPlayerStats: es ? "Sin estadísticas disponibles" : zh ? "暂无统计数据" : "No statistics available",
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 -ml-1 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          aria-label={L.close}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {team?.logoUrl ? (
            <img src={team.logoUrl} alt="" className="w-8 h-8 rounded-md object-contain bg-muted/30 shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-md bg-muted/40 shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-base font-black text-foreground truncate">{teamName}</p>
            {team && (
              <p className="text-[11px] text-muted-foreground">
                {team.wins}-{team.losses}
                {team.net != null && (
                  <span className={cn(
                    "ml-2 font-black",
                    team.net > 0 ? "text-green-600 dark:text-green-400" : team.net < 0 ? "text-destructive" : "text-muted-foreground"
                  )}>
                    NET {team.net > 0 ? `+${team.net}` : team.net}
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
        {team && (
          <div className="shrink-0 text-right">
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">#{team.rank}</p>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {isLoading && (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {isError && (
          <div className="rounded-2xl border border-border bg-card p-5 text-center">
            <p className="text-sm font-bold text-destructive">{L.error}</p>
          </div>
        )}

        {!isLoading && !isError && team && (
          <>
            <div className="rounded-2xl border border-border bg-card p-3 space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <StatChip label="PPG" value={team.ppg != null ? team.ppg.toFixed(1) : "—"} />
                <StatChip label="OPPG" value={team.oppg != null ? team.oppg.toFixed(1) : "—"} />
                <StatChip label="NET" value={team.net != null ? (team.net > 0 ? `+${team.net}` : String(team.net)) : "—"} />
              </div>
            </div>

            {activePlayers.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground px-0.5">
                  {L.roster}
                </p>
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                  <div className="grid grid-cols-[1.6fr_0.4fr_0.55fr_0.55fr_0.55fr] gap-0 border-b border-border bg-muted/30 px-3 py-2 text-[9px] font-black uppercase tracking-wider text-muted-foreground">
                    <span>{L.colPlayer}</span>
                    <span className="text-right">{L.colG}</span>
                    <span className="text-right">PPG</span>
                    <span className="text-right">RPG</span>
                    <span className="text-right">APG</span>
                  </div>
                  {activePlayers.map((p: TeamRosterPlayer) => {
                    const name =
                      preferEn && p.nameEn?.trim() ? (toTitleCase(p.nameEn) ?? p.nameEn.trim()) : p.nameZh;
                    return (
                      <button
                        key={p.externalId}
                        type="button"
                        onClick={() => onPlayerTap(p.externalId)}
                        className="w-full grid grid-cols-[1.6fr_0.4fr_0.55fr_0.55fr_0.55fr] gap-0 items-center px-3 py-2.5 border-b border-border last:border-b-0 text-xs text-left touch-manipulation hover:bg-muted/30 active:bg-muted/45 active:opacity-90 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-extrabold text-foreground truncate">{name}</p>
                          {p.jerseyNumber != null && p.jerseyNumber !== "" && (
                            <p className="text-[9px] text-muted-foreground/60 font-semibold">#{p.jerseyNumber}</p>
                          )}
                        </div>
                        <p className="text-xs font-black text-foreground tabular-nums text-right">{p.games}</p>
                        <p className="text-xs font-black text-foreground tabular-nums text-right">{p.ppg.toFixed(1)}</p>
                        <p className="text-xs font-black text-foreground tabular-nums text-right">{p.rpg.toFixed(1)}</p>
                        <p className="text-xs font-black text-foreground tabular-nums text-right">{p.apg.toFixed(1)}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {activePlayers.length === 0 && players.length > 0 && (
              <div className="rounded-2xl border border-dashed border-border px-6 py-10 text-center">
                <p className="text-sm font-bold text-muted-foreground">{L.teamNoPlayerStats}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
