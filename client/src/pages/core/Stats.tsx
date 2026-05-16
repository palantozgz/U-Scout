import { useEffect, useMemo, useState, useRef } from "react";
import { BarChart3, ChevronDown, ChevronLeft, ChevronRight, Trophy, Users } from "lucide-react";
import { useSearch, useLocation } from "wouter";
import { ModulePageShell } from "./ModulePage";
import { LandscapeHint, useIsLandscape } from "@/components/LandscapeHint";
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

function pickName(nameZh: string | null | undefined, nameEn: string | null | undefined, locale: string): string {
  if (locale === "zh") return nameZh ?? nameEn ?? "";
  return nameEn ?? nameZh ?? "";
}

function translatePosition(pos: string | null | undefined, locale: string): string {
  if (!pos || locale === "zh") return pos ?? "";
  const map: Record<string, string> = {
    后卫: "Guard",
    控球后卫: "Point Guard",
    得分后卫: "Shooting Guard",
    前锋: "Forward",
    小前锋: "Small Forward",
    大前锋: "Power Forward",
    中锋: "Center",
  };
  return map[pos] ?? pos;
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
  const chipsScrollRef = useRef<HTMLDivElement>(null);
  const [jugadorasSort, setJugadorasSort] = useState<JugadorasSort>("ppg");
  const [jugadorasSortDir, setJugadorasSortDir] = useState<"asc" | "desc">("desc");
  const [jugadorasSearch, setJugadorasSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(jugadorasSearch), 200);
    return () => clearTimeout(t);
  }, [jugadorasSearch]);
  const [jugadorasLimit, setJugadorasLimit] = useState(50);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [playerSheetId, setPlayerSheetId] = useState<PlayerSheetId>(null);
  const [teamSheetId, setTeamSheetId] = useState<string | null>(null);
  const [returnToTeamId, setReturnToTeamId] = useState<string | null>(null);
  const [seasonSheetOpen, setSeasonSheetOpen] = useState(false);
  const [seasonId, setSeasonId] = useState<number | null>(() => {
    const s = localStorage.getItem("stats_seasonId");
    return s ? Number(s) : null;
  });

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
    if (chipsScrollRef.current) {
      chipsScrollRef.current.scrollLeft = 0;
    }
  }, [jugadorasTeam]);

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

  const handleJugadorasSortClick = (k: JugadorasSort) => {
    if (jugadorasSort === k) {
      setJugadorasSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setJugadorasSort(k);
      setJugadorasSortDir("desc");
    }
  };

  const jugadorasFiltered = useMemo(() => {
    let list = playersForSeason.filter((p) => p.games > 0);
    if (jugadorasTeam.trim()) list = list.filter((p) => p.teamName === jugadorasTeam);
    const q = debouncedSearch.trim().toLowerCase();
    if (q)
      list = list.filter(
        (p) =>
          p.playerName.toLowerCase().includes(q) ||
          (p.playerNameEn ?? "").toLowerCase().includes(q),
      );
    return [...list].sort((a, b) =>
      jugadorasSortDir === "desc"
        ? num(b[jugadorasSort]) - num(a[jugadorasSort])
        : num(a[jugadorasSort]) - num(b[jugadorasSort]),
    );
  }, [playersForSeason, jugadorasTeam, jugadorasSort, debouncedSearch, jugadorasSortDir]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setJugadorasLimit((n) => n + 50);
      },
      { threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [jugadorasFiltered]);

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
    order.sort((a, b) => a.localeCompare(b, "zh"));
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
      <div className="px-4 md:px-8 pb-10 max-w-5xl mx-auto w-full">
        <div className="mt-3 mb-1 rounded-xl border border-border bg-muted/40 px-4 py-3 flex items-center gap-3">
          <BarChart3 className="w-5 h-5 text-primary/60 shrink-0" />
          <div>
            <p className="text-xs font-bold text-foreground">{locale === "es" ? "Datos WCBA en integración" : locale === "zh" ? "WCBA数据集成中" : "Live WCBA data coming soon"}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{locale === "es" ? "Los datos en tiempo real llegarán en breve." : locale === "zh" ? "实时数据即将接入。" : "Real-time stats will appear here automatically."}</p>
          </div>
        </div>
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
                      localStorage.setItem("stats_seasonId", String(s.seasonId));
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
            <TabsTrigger value="liga" className="text-xs sm:text-xs font-black px-1 gap-1">
              <Trophy className="w-3.5 h-3.5 shrink-0 opacity-80" />
              {L.tabLiga}
            </TabsTrigger>
            <TabsTrigger value="jugadoras" className="text-xs sm:text-xs font-black px-1 gap-1">
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
                    <div className="grid grid-cols-[0.3fr_1fr_0.5fr_0.4fr_0.4fr_0.4fr] gap-1 border-b border-border bg-muted/30 px-2 py-2 text-xs font-black uppercase tracking-wider text-muted-foreground">
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
                          <p className="px-2 py-1.5 text-xs font-black uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/15">
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
                              <p className="font-bold text-foreground truncate">
                                {pickName(row.teamName, row.teamNameEn, locale)}
                              </p>
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
                        "rounded-full border px-2.5 py-1 text-xs font-black transition-colors",
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
                    <p className="text-xs text-muted-foreground px-0.5 -mt-1">{L.leadersSubtitle}</p>
                  <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
                    {leadersRows.slice(0, 10).map((row: LeaderRow, idx: number) => (
                      <button
                        key={row.externalId}
                        type="button"
                        onClick={() => setPlayerSheetId(String(row.externalId))}
                        className="w-full flex items-center gap-3 px-3 py-2.5 touch-manipulation hover:bg-muted/30 active:bg-muted/45 active:opacity-90 transition-colors text-left"
                      >
                        <span className="w-6 text-center text-xs font-black text-muted-foreground tabular-nums">{idx + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-extrabold text-foreground truncate">
                            {displayLeaderPlayerName(row, preferEnLeaderName)}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{row.teamName ?? "—"}</p>
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
                <div
                  ref={chipsScrollRef}
                  className="flex flex-nowrap gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1 scroll-snap-type-x-mandatory"
                >
                  <button
                    type="button"
                    onClick={() => setJugadorasTeam("")}
                    className={cn(
                      "scroll-snap-align-start shrink-0 rounded-full border px-3 py-1.5 text-xs font-black transition-colors",
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
                        "scroll-snap-align-start shrink-0 max-w-[200px] truncate rounded-full border px-3 py-1.5 text-xs font-black transition-colors",
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
                  <div className="grid grid-cols-[2fr_0.4fr_0.6fr_0.6fr_0.6fr] gap-0 border-b border-border bg-muted/30 px-3 py-2 text-xs font-black uppercase tracking-wider text-muted-foreground">
                    <span className="text-left">{L.colPlayer}</span>
                    <span className="text-right">{L.colG}</span>
                    {(["ppg", "rpg", "apg"] as const).map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => handleJugadorasSortClick(k)}
                        className={cn(
                          "text-right font-black uppercase tracking-wider text-xs touch-manipulation flex items-center justify-end gap-0.5 w-full",
                          jugadorasSort === k ? "text-primary" : "text-muted-foreground",
                        )}
                      >
                        {k === "ppg" ? L.sortPPG : k === "rpg" ? L.sortRPG : L.sortAPG}
                        {jugadorasSort === k && (
                          <span className="text-[8px]">{jugadorasSortDir === "desc" ? "▼" : "▲"}</span>
                        )}
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
                        className="w-full px-3 py-3 grid grid-cols-[2fr_0.4fr_0.6fr_0.6fr_0.6fr] items-center gap-0 text-left touch-manipulation hover:bg-muted/30 active:bg-muted/45 active:opacity-90 transition-colors border-b border-border last:border-b-0"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {p.photoUrl ? (
                            <img
                              src={p.photoUrl}
                              className="w-7 h-7 rounded-full object-cover object-top shrink-0 bg-muted/30"
                              alt=""
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-muted/40 shrink-0 flex items-center justify-center text-[8px] font-black text-muted-foreground">
                              {(pickName(p.playerName, p.playerNameEn ?? null, locale) || "?")[0].toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-extrabold text-foreground truncate">
                              {pickName(p.playerName, p.playerNameEn ?? null, locale)}
                            </p>
                            <p className="text-xs text-muted-foreground/60 font-semibold truncate">
                              {pickName(p.teamName, p.teamNameEn ?? null, locale) || p.season}
                            </p>
                          </div>
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
                  <div ref={sentinelRef} className="h-8 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
                  </div>
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

const STAT_FULL: Record<string, string> = {
  PPG: "Points Per Game",
  RPG: "Rebounds Per Game",
  APG: "Assists Per Game",
  SPG: "Steals Per Game",
  BPG: "Blocks Per Game",
  TOPG: "Turnovers Per Game",
  MPG: "Minutes Per Game",
  "FG%": "Field Goal %",
  "3P%": "3-Point %",
  "FT%": "Free Throw %",
  OPPG: "Opp. Points Per Game",
  NET: "Net Rating",
  "WIN%": "Win Percentage",
  STREAK: "Current Streak",
  HOME: "Home Record",
  AWAY: "Away Record",
  L10: "Last 10 Games",
  "TS%": "True Shooting % = PTS / (2 × (FGA + 0.44×FTA))",
  "eFG%": "Effective FG% = (FGM + 0.5×3PM) / FGA",
  DD: "Double-Doubles",
  TD: "Triple-Doubles",
};

function ShotZoneChart({ fgPct, fg3Pct }: { fgPct: number | null; fg3Pct: number | null }) {
  function zoneColor(pct: number | null, base: number) {
    if (pct == null) return "hsl(var(--muted))";
    const delta = pct - base;
    if (delta > 5) return "#22c55e";
    if (delta > 0) return "#86efac";
    if (delta > -5) return "#fca5a5";
    return "#ef4444";
  }
  const paint2Color = zoneColor(fgPct, 45);
  const mid2Color = zoneColor(fgPct, 38);
  const threeColor = zoneColor(fg3Pct, 33);
  return (
    <svg viewBox="0 0 300 160" className="w-full max-w-xs mx-auto" aria-label="Shot zones">
      {/* Half court outline */}
      <rect x="10" y="10" width="280" height="140" rx="4" fill="none" stroke="hsl(var(--border))" strokeWidth="1.5" />
      {/* 3PT zone background */}
      <rect x="10" y="10" width="280" height="140" rx="4" fill={threeColor} opacity="0.25" />
      {/* 2PT mid-range */}
      <path
        d="M 90 10 A 100 100 0 0 1 210 10 L 210 150 L 90 150 Z"
        fill={mid2Color}
        opacity="0.3"
      />
      {/* Paint */}
      <rect x="110" y="10" width="80" height="65" fill={paint2Color} opacity="0.4" />
      {/* Labels */}
      <text x="150" y="52" textAnchor="middle" fontSize="11" fontWeight="900" fill="hsl(var(--foreground))">
        {fgPct != null ? `${fgPct.toFixed(1)}%` : "—"}
      </text>
      <text x="150" y="64" textAnchor="middle" fontSize="7" fill="hsl(var(--muted-foreground))">
        PAINT
      </text>
      <text x="55" y="90" textAnchor="middle" fontSize="10" fontWeight="800" fill="hsl(var(--foreground))">
        {fg3Pct != null ? `${fg3Pct.toFixed(1)}%` : "—"}
      </text>
      <text x="55" y="101" textAnchor="middle" fontSize="7" fill="hsl(var(--muted-foreground))">
        3PT
      </text>
      <text x="245" y="90" textAnchor="middle" fontSize="10" fontWeight="800" fill="hsl(var(--foreground))">
        {fg3Pct != null ? `${fg3Pct.toFixed(1)}%` : "—"}
      </text>
      <text x="245" y="101" textAnchor="middle" fontSize="7" fill="hsl(var(--muted-foreground))">
        3PT
      </text>
    </svg>
  );
}

function StatChip(props: { label: string; value: string; hero?: boolean }) {
  const title = STAT_FULL[props.label] ?? props.label;
  if (props.hero) {
    return (
      <div
        title={title}
        className="rounded-xl border border-border bg-card px-3 py-3 flex flex-col items-center justify-center cursor-help"
      >
        <p className="text-xs font-black uppercase tracking-wider text-muted-foreground/70">{props.label}</p>
        <p className="text-2xl font-black text-foreground tabular-nums mt-0.5">{props.value}</p>
      </div>
    );
  }
  return (
    <div
      title={title}
      className="rounded-lg border border-border bg-card px-2.5 py-2 cursor-help"
    >
      <p className="text-xs font-black uppercase tracking-wider text-muted-foreground/60">{props.label}</p>
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
  const isLandscape = useIsLandscape();
  const [showAllGames, setShowAllGames] = useState(false);
  const [showRadar, setShowRadar] = useState(false);
  const [showMoreStats, setShowMoreStats] = useState(false);
  const [gameLogSort, setGameLogSort] = useState<"date" | "pts" | "reb" | "ast">("date");
  const [gameLogSortDir, setGameLogSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    setShowAllGames(false);
    setShowRadar(false);
    setShowMoreStats(false);
    setGameLogSort("date");
    setGameLogSortDir("desc");
  }, [externalId]);

  const player = data?.player;
  const gameLog = data?.gameLog ?? [];

  const advStats = useMemo(() => {
    if (gameLog.length === 0) return null;
    let fgm = 0,
      fga = 0,
      tpm = 0,
      ftm = 0,
      fta = 0,
      pts = 0;
    for (const g of gameLog) {
      fgm += g.fgm ?? 0;
      fga += g.fga ?? 0;
      tpm += g.tpm ?? 0;
      ftm += g.ftm ?? 0;
      fta += g.fta ?? 0;
      pts += g.pts ?? 0;
    }
    const eFGPct = fga > 0 ? ((fgm + 0.5 * tpm) / fga) * 100 : null;
    const tsPct = fga + 0.44 * fta > 0 ? (pts / (2 * (fga + 0.44 * fta))) * 100 : null;
    let dd = 0,
      td = 0;
    for (const g of gameLog) {
      const cats = [
        (g.pts ?? 0) >= 10,
        (g.reb ?? 0) >= 10,
        (g.ast ?? 0) >= 10,
        (g.stl ?? 0) >= 10,
        (g.blk ?? 0) >= 10,
      ].filter(Boolean).length;
      if (cats >= 3) td++;
      else if (cats >= 2) dd++;
    }
    const mean = pts / gameLog.length;
    const stdDev = Math.sqrt(
      gameLog.reduce((s, g) => s + ((g.pts ?? 0) - mean) ** 2, 0) / gameLog.length,
    );
    const last5 = [...gameLog]
      .sort((a, b) => new Date(b.gameDate ?? 0).getTime() - new Date(a.gameDate ?? 0).getTime())
      .slice(0, 5);
    const last5Avg =
      last5.length >= 3 ? last5.reduce((s, g) => s + (g.pts ?? 0), 0) / last5.length : null;
    const isHot = last5Avg != null && last5Avg > mean * 1.15;
    const isCold = last5Avg != null && last5Avg < mean * 0.85;
    return { eFGPct, tsPct, dd, td, stdDev, isHot, isCold, last5Avg, meanPts: mean };
  }, [gameLog]);

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

  const handleGameLogSortClick = (col: "pts" | "reb" | "ast") => {
    if (gameLogSort === col) {
      setGameLogSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setGameLogSort(col);
      setGameLogSortDir("desc");
    }
  };

  const sortedGameLog = [...gameLog].sort((a, b) => {
    let diff = 0;
    if (gameLogSort === "pts") diff = (b.pts ?? 0) - (a.pts ?? 0);
    else if (gameLogSort === "reb") diff = (b.reb ?? 0) - (a.reb ?? 0);
    else if (gameLogSort === "ast") diff = (b.ast ?? 0) - (a.ast ?? 0);
    else {
      diff = new Date(b.gameDate ?? 0).getTime() - new Date(a.gameDate ?? 0).getTime();
    }
    return gameLogSortDir === "desc" ? diff : -diff;
  });

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
        {player?.photoUrl ? (
          <img
            src={player.photoUrl}
            alt=""
            className="w-14 h-14 rounded-full object-cover object-top bg-muted/40 shrink-0 border border-border"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-muted/40 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-base font-black text-foreground truncate">{displayName}</p>
          {player && (
            <div className="text-xs text-muted-foreground truncate flex flex-wrap items-center gap-x-1 gap-y-0.5 min-w-0">
              {player.jerseyNumber != null && player.jerseyNumber !== "" ? (
                <span>{`#${player.jerseyNumber} · `}</span>
              ) : null}
              {pickName(player.teamName, player.teamNameEn, locale) && onTeamTap && player.teamExternalId ? (
                <button
                  type="button"
                  onClick={() => onTeamTap(String(player.teamExternalId))}
                  className="inline-flex max-w-full items-center gap-0.5 text-primary underline-offset-2 hover:underline active:opacity-70 touch-manipulation shrink-0"
                >
                  <span className="truncate">{pickName(player.teamName, player.teamNameEn, locale)}</span>
                  <ChevronRight className="w-3 h-3 shrink-0" />
                </button>
              ) : (
                <span>{pickName(player.teamName, player.teamNameEn, locale) || "—"}</span>
              )}
              {player.position && player.position.trim() && (
                <span className="inline-block rounded-full bg-muted/50 border border-border text-xs font-black uppercase tracking-wide px-1.5 py-0 leading-4 shrink-0">
                  {translatePosition(player.position, locale)}
                </span>
              )}
            </div>
          )}
        </div>
        {player && (
          <div className="shrink-0 text-right">
            <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">
              {player.games}G
            </p>
            {advStats && (advStats.isHot || advStats.isCold) && (
              <p
                className={cn(
                  "text-xs font-black tracking-wide",
                  advStats.isHot ? "text-orange-500" : "text-blue-400",
                )}
              >
                {advStats.isHot
                  ? es
                    ? "🔥 Racha"
                    : zh
                      ? "🔥 热手"
                      : "🔥 Hot"
                  : es
                    ? "📉 Baja"
                    : zh
                      ? "📉 低迷"
                      : "📉 Cold"}
              </p>
            )}
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
            <div className="rounded-2xl border border-border bg-card p-3 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <StatChip hero label="PPG" value={player.ppg.toFixed(1)} />
                <StatChip hero label="RPG" value={player.rpg.toFixed(1)} />
                <StatChip hero label="APG" value={player.apg.toFixed(1)} />
              </div>
              <div className="grid grid-cols-4 gap-2">
                <StatChip label="FG%" value={player.fgPct != null ? `${player.fgPct.toFixed(1)}%` : "—"} />
                <StatChip label="SPG" value={player.spg.toFixed(1)} />
                <StatChip label="BPG" value={player.bpg.toFixed(1)} />
                <StatChip label="TOPG" value={player.topg.toFixed(1)} />
              </div>
              {showMoreStats && (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <StatChip label="MPG" value={player.mpg.toFixed(1)} />
                    <StatChip label="3P%" value={player.fg3Pct != null ? `${player.fg3Pct.toFixed(1)}%` : "—"} />
                    <StatChip label="FT%" value={player.ftPct != null ? `${player.ftPct.toFixed(1)}%` : "—"} />
                  </div>
                  {advStats && (
                    <div className="grid grid-cols-4 gap-2">
                      <StatChip
                        label="TS%"
                        value={advStats.tsPct != null ? `${advStats.tsPct.toFixed(1)}%` : "—"}
                      />
                      <StatChip
                        label="eFG%"
                        value={advStats.eFGPct != null ? `${advStats.eFGPct.toFixed(1)}%` : "—"}
                      />
                      <StatChip label="DD" value={String(advStats.dd)} />
                      <StatChip label="TD" value={String(advStats.td)} />
                    </div>
                  )}
                  {advStats && gameLog.length >= 5 && (
                    <p className="text-xs text-muted-foreground/60 px-0.5">
                      {es
                        ? `Consistencia: σ ${advStats.stdDev.toFixed(1)} pts`
                        : zh
                          ? `稳定性：σ ${advStats.stdDev.toFixed(1)} 分`
                          : `Consistency: σ ${advStats.stdDev.toFixed(1)} pts`}
                    </p>
                  )}
                </>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowMoreStats((v) => !v)}
                  className="flex-1 rounded-xl border border-border bg-muted/20 py-2 text-xs font-black text-muted-foreground hover:bg-muted/40 active:opacity-70 touch-manipulation transition-colors"
                >
                  {showMoreStats
                    ? locale === "es"
                      ? "Ver menos"
                      : locale === "zh"
                        ? "收起"
                        : "Less"
                    : locale === "es"
                      ? "Ver más"
                      : locale === "zh"
                        ? "更多"
                        : "More"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowRadar((v) => !v)}
                  className={cn(
                    "flex-1 rounded-xl border py-2 text-xs font-black touch-manipulation transition-colors flex items-center justify-center gap-1.5",
                    showRadar
                      ? "border-primary/30 bg-primary/15 text-primary hover:bg-primary/25"
                      : "border-border bg-muted/20 text-muted-foreground hover:bg-muted/40 active:opacity-70",
                  )}
                >
                  <BarChart3 className="w-3.5 h-3.5 shrink-0" />
                  {showRadar
                    ? locale === "es"
                      ? "Ocultar radar"
                      : locale === "zh"
                        ? "隐藏雷达"
                        : "Hide radar"
                    : locale === "es"
                      ? "Ver radar"
                      : locale === "zh"
                        ? "雷达图"
                        : "Radar"}
                </button>
              </div>
              {showRadar && <StatsRadar player={player} locale={locale} />}
            </div>

            {isLandscape ? (
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-xs font-black uppercase tracking-wider text-muted-foreground/60 mb-3">
                  Shot Zones
                </p>
                <ShotZoneChart fgPct={player.fgPct ?? null} fg3Pct={player.fg3Pct ?? null} />
              </div>
            ) : (
              <LandscapeHint />
            )}

            {gameLog.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border px-6 py-8 text-center text-sm font-bold text-muted-foreground">
                {L.noData}
              </div>
            ) : (
              <div className="space-y-1.5">
                <p className="text-xs font-black uppercase tracking-wider text-muted-foreground px-0.5">
                  {L.gameLogTitle}
                </p>
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                  <div className="grid grid-cols-[1fr_0.9fr_0.5fr_0.5fr_0.5fr_0.5fr] gap-0 border-b border-border bg-muted/30 pl-2.5 pr-3 py-2 text-xs font-black uppercase tracking-wider text-muted-foreground">
                    <span>{L.dateCol}</span>
                    <span>{L.rivalCol}</span>
                    {(["pts", "reb", "ast"] as const).map((col) => (
                      <button
                        key={col}
                        type="button"
                        onClick={() => handleGameLogSortClick(col)}
                        className={cn(
                          "text-right font-black uppercase tracking-wider text-xs touch-manipulation flex items-center justify-end gap-0.5 w-full",
                          gameLogSort === col ? "text-primary" : "text-muted-foreground",
                        )}
                      >
                        {col === "pts" ? L.ptsCol : col === "reb" ? L.rebCol : L.astCol}
                        {gameLogSort === col && (
                          <span className="text-[7px]">{gameLogSortDir === "desc" ? "▼" : "▲"}</span>
                        )}
                      </button>
                    ))}
                    <span className="text-right">{L.minCol}</span>
                  </div>
                  {(showAllGames ? sortedGameLog : sortedGameLog.slice(0, 10)).map((g: GameLogEntry) => {
                    const date = g.gameDate
                      ? new Date(g.gameDate).toLocaleDateString(
                          locale === "zh" ? "zh-CN" : locale === "es" ? "es-ES" : "en-GB",
                          { month: "short", day: "numeric" },
                        )
                      : "—";
                    return (
                      <div
                        key={g.gameId}
                        className={cn(
                          "grid grid-cols-[1fr_0.9fr_0.5fr_0.5fr_0.5fr_0.5fr] gap-0 items-center pl-2 pr-3 py-2.5 border-b border-border last:border-b-0 text-xs border-l-[3px]",
                          g.plusMinus > 0
                            ? "border-l-green-500/50 dark:border-l-green-400/50"
                            : g.plusMinus < 0
                              ? "border-l-destructive/40"
                              : "border-l-transparent",
                        )}
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-foreground tabular-nums">{date}</p>
                          {g.isStart && (
                            <span className="inline-block rounded-full bg-primary/15 text-primary text-[8px] font-black uppercase tracking-wide px-1.5 py-0 leading-4">
                              {L.starter}
                            </span>
                          )}
                        </div>
                        <p className="text-muted-foreground truncate font-semibold">
                          {pickName(g.rivalName, (g as any).rivalNameEn ?? null, locale) || "—"}
                        </p>
                        <p className="text-right font-black tabular-nums text-foreground">{g.pts}</p>
                        <p className="text-right font-black tabular-nums text-foreground">{g.reb}</p>
                        <p className="text-right font-black tabular-nums text-foreground">{g.ast}</p>
                        <p className="text-right font-semibold tabular-nums text-muted-foreground">
                          {minutesToDisplay(g.minutes != null ? String(g.minutes) : null)}
                        </p>
                      </div>
                    );
                  })}
                </div>
                {!showAllGames && sortedGameLog.length > 10 && (
                  <button
                    type="button"
                    onClick={() => setShowAllGames(true)}
                    className="w-full rounded-xl border border-border bg-card py-2.5 text-xs font-black text-primary touch-manipulation hover:bg-muted/30 active:bg-muted/45 active:opacity-90 transition-colors"
                  >
                    {es
                      ? `Ver ${sortedGameLog.length - 10} partidos más`
                      : zh
                        ? `显示全部 ${sortedGameLog.length} 场`
                        : `See all ${sortedGameLog.length} games`}
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
  const [rosterSort, setRosterSort] = useState<"ppg" | "rpg" | "apg">("ppg");
  const [rosterSortDir, setRosterSortDir] = useState<"asc" | "desc">("desc");

  const handleRosterSortClick = (col: "ppg" | "rpg" | "apg") => {
    if (rosterSort === col) {
      setRosterSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setRosterSort(col);
      setRosterSortDir("desc");
    }
  };

  const activePlayers = [...players.filter((p) => p.games > 0)].sort((a, b) => {
    const diff = (b[rosterSort] ?? 0) - (a[rosterSort] ?? 0);
    return rosterSortDir === "desc" ? diff : -diff;
  });

  const teamName = pickName(team?.nameZh, team?.nameEn, locale) || "—";

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
              <p className="text-xs text-muted-foreground">
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
            <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">#{team.rank}</p>
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

            <div className="rounded-2xl border border-border bg-card p-3 space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <StatChip
                  label="WIN%"
                  value={
                    team.winPct != null ? `${(Number(team.winPct) * 100).toFixed(1)}%` : "—"
                  }
                />
                <StatChip
                  label="FG%"
                  value={team.teamFgPct != null ? `${team.teamFgPct.toFixed(1)}%` : "—"}
                />
                <StatChip
                  label="STREAK"
                  value={
                    team.streak != null && team.streak > 0
                      ? `W${team.streak}`
                      : team.streak != null && team.streak < 0
                        ? `L${Math.abs(team.streak)}`
                        : "—"
                  }
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <StatChip
                  label="HOME"
                  value={
                    team.homeW != null && team.homeL != null
                      ? `${team.homeW}-${team.homeL}`
                      : "—"
                  }
                />
                <StatChip
                  label="AWAY"
                  value={
                    team.awayW != null && team.awayL != null
                      ? `${team.awayW}-${team.awayL}`
                      : "—"
                  }
                />
                <StatChip
                  label="L10"
                  value={
                    team.last10W != null && team.last10L != null
                      ? `${team.last10W}-${team.last10L}`
                      : "—"
                  }
                />
              </div>
            </div>

            {activePlayers.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-black uppercase tracking-wider text-muted-foreground px-0.5">
                  {L.roster}
                </p>
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                  <div className="grid grid-cols-[1.6fr_0.4fr_0.55fr_0.55fr_0.55fr] gap-0 border-b border-border bg-muted/30 px-3 py-2 text-xs font-black uppercase tracking-wider text-muted-foreground">
                    <span>{L.colPlayer}</span>
                    <span className="text-right">{L.colG}</span>
                    {(["ppg", "rpg", "apg"] as const).map((col) => (
                      <button
                        key={col}
                        type="button"
                        onClick={() => handleRosterSortClick(col)}
                        className={cn(
                          "text-right font-black uppercase tracking-wider text-xs touch-manipulation flex items-center justify-end gap-0.5 w-full",
                          rosterSort === col ? "text-primary" : "text-muted-foreground",
                        )}
                      >
                        {col.toUpperCase()}
                        {rosterSort === col && (
                          <span className="text-[7px]">{rosterSortDir === "desc" ? "▼" : "▲"}</span>
                        )}
                      </button>
                    ))}
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
                            <p className="text-xs text-muted-foreground/60 font-semibold">#{p.jerseyNumber}</p>
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
