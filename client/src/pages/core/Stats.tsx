import { useEffect, useMemo, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, ChevronDown, ChevronLeft, ChevronRight, Trophy, Users } from "lucide-react";
import { useSearch, useLocation } from "wouter";
import { ModulePageShell } from "./ModulePage";
import { LandscapeHint, useIsLandscape } from "@/components/LandscapeHint";
import { StatsRadar } from "@/components/StatsRadar";
import { useLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useIsDesktop } from "@/lib/useIsDesktop";
import { useAuth } from "@/lib/useAuth";
import { useCapabilities } from "@/lib/capabilities";
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
  useLeagueAverages,
  usePlayerPercentiles,
  toTitleCase,
  type PlayerSeasonStats,
  type LeaderRow,
  type StandingsRow,
  type GameLogEntry,
  type TeamDetail,
  type TeamRosterPlayer,
  type TeamGameLogEntry,
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
  const isDesktop = useIsDesktop();
  const { profile } = useAuth();
  const { canUsePlayerUX } = useCapabilities();
  const myExternalId = canUsePlayerUX
    ? ((profile as { wcba_external_id?: string | null })?.wcba_external_id ?? null)
    : null;

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

  const [mainTab, setMainTab] = useState<MainTab>(() => {
    const fromUrl = parseMainTab(search);
    const raw = search.startsWith("?") ? search.slice(1) : search;
    if (new URLSearchParams(raw).has("tab")) return fromUrl;
    return canUsePlayerUX ? "jugadoras" : "liga";
  });
  const [ligaSegment, setLigaSegment] = useState<LigaSegment>("clasificacion");
  const [showCoachDash, setShowCoachDash] = useState(false);
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

  const matchesQ = useQuery({
    queryKey: ["club-matches"],
    queryFn: async () => {
      const res = await fetch("/api/club/matches", { credentials: "include" });
      if (!res.ok) return { matches: [] };
      return res.json() as Promise<
        { id: number; rivalName: string; matchDate: string; location: string | null; matchType: string }[]
      >;
    },
    staleTime: 5 * 60 * 1000,
  });

  const nextMatch = useMemo(() => {
    const now = Date.now();
    const upcoming = (Array.isArray(matchesQ.data) ? matchesQ.data : [])
      .filter((m) => new Date(m.matchDate).getTime() > now)
      .sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime());
    return upcoming[0] ?? null;
  }, [matchesQ.data]);

  const rivalStanding = useMemo(() => {
    if (!nextMatch || standingsRows.length === 0) return null;
    const rivalLower = nextMatch.rivalName.toLowerCase();
    return (
      standingsRows.find(
        (r) =>
          (r.teamName ?? "").toLowerCase().includes(rivalLower) ||
          (r.teamNameEn ?? "").toLowerCase().includes(rivalLower),
      ) ?? null
    );
  }, [nextMatch, standingsRows]);

  const ownL5 = useMemo(() => {
    if (standingsRows.length === 0) return null;
    const ownTeamName = "Inner Mongolia";
    const own =
      standingsRows.find(
        (r) =>
          (r.teamName ?? "").toLowerCase().includes(ownTeamName.toLowerCase()) ||
          (r.teamNameEn ?? "").toLowerCase().includes(ownTeamName.toLowerCase()),
      ) ?? null;
    return own;
  }, [standingsRows]);

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

  const closePlayerSheet = () => {
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
  };

  const desktopPanel = isDesktop ? (
    <StatsDesktopPanel
      playerSheetId={playerSheetId}
      teamSheetId={teamSheetId}
      seasonId={effectiveSeasonId}
      locale={locale}
      returnToTeamId={returnToTeamId}
      onClosePlayer={closePlayerSheet}
      onCloseTeam={() => setTeamSheetId(null)}
      onTeamTapFromPlayer={(teamId) => {
        setPlayerSheetId(null);
        setReturnToTeamId(null);
        setTeamSheetId(teamId);
      }}
      onPlayerTapFromTeam={(id) => {
        setReturnToTeamId(teamSheetId);
        setTeamSheetId(null);
        setPlayerSheetId(id);
      }}
    />
  ) : undefined;

  return (
    <ModulePageShell
      title={t("ucore_card_stats_title")}
      moduleHeader={{ module: "stats", tagline: t("tagline_stats") }}
      panel={desktopPanel}
      panelWide={isDesktop && Boolean(playerSheetId || teamSheetId)}
      panelLabel={isDesktop ? (locale === "zh" ? "详情" : locale === "es" ? "DETALLE" : "DETAIL") : undefined}
    >
      <>
      <div className={`px-4 md:px-8 pb-10 mx-auto w-full ${isDesktop && (playerSheetId || teamSheetId) ? 'max-w-2xl' : 'max-w-5xl'}`}>
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
            {!canUsePlayerUX && nextMatch && (
              <button
                type="button"
                onClick={() => setShowCoachDash((v) => !v)}
                className={cn(
                  "w-full rounded-xl border px-4 py-3 text-left transition-colors",
                  showCoachDash
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:bg-muted/30",
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider mb-0.5">
                      {es ? "Dashboard coaching" : zh ? "教练仪表盘" : "Coaching dashboard"}
                    </p>
                    <p className="text-sm font-black text-foreground">
                      {es
                        ? `Próximo: ${nextMatch.rivalName}`
                        : zh
                          ? `下场: ${nextMatch.rivalName}`
                          : `Next: ${nextMatch.rivalName}`}
                    </p>
                  </div>
                  <ChevronDown
                    className={cn("w-4 h-4 transition-transform", showCoachDash && "rotate-180")}
                  />
                </div>
              </button>
            )}

            {!canUsePlayerUX && showCoachDash && nextMatch && (
              <div className="rounded-xl border border-border bg-card p-4 space-y-3 -mt-2">
                <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
                  <p className="text-[9px] font-black uppercase tracking-wider text-blue-500 mb-1">
                    {es ? "Próximo rival" : zh ? "下场对手" : "Next opponent"}
                  </p>
                  <p className="text-lg font-black text-foreground">{nextMatch.rivalName}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span>
                      {new Date(nextMatch.matchDate).toLocaleDateString(
                        locale === "zh" ? "zh-CN" : locale === "es" ? "es-ES" : "en-GB",
                        { weekday: "short", day: "numeric", month: "short" },
                      )}
                    </span>
                    {nextMatch.location && <span>· {nextMatch.location}</span>}
                    {rivalStanding && (
                      <span className="font-black text-foreground">
                        · #{rivalStanding.rank} · {rivalStanding.wins}-{rivalStanding.losses}
                      </span>
                    )}
                  </div>
                  {rivalStanding?.eFGPct != null && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      eFG%{" "}
                      <span className="font-black text-foreground">
                        {num(rivalStanding.eFGPct).toFixed(1)}
                      </span>
                      {rivalStanding.streak != null && rivalStanding.streak !== 0 && (
                        <span
                          className={cn(
                            "ml-2 font-black",
                            rivalStanding.streak > 0
                              ? "text-green-600 dark:text-green-400"
                              : "text-destructive",
                          )}
                        >
                          {rivalStanding.streak > 0
                            ? `W${rivalStanding.streak}`
                            : `L${Math.abs(rivalStanding.streak)}`}
                        </span>
                      )}
                    </p>
                  )}
                </div>

                {ownL5 && (
                  <div className="rounded-xl border border-border bg-muted/20 p-3">
                    <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground mb-1">
                      {es ? "Nuestro registro" : zh ? "我方战绩" : "Our record"}
                    </p>
                    <p className="text-lg font-black text-foreground">
                      {ownL5.wins}-{ownL5.losses}
                      <span className="text-sm font-semibold text-muted-foreground ml-2">
                        #{ownL5.rank}
                      </span>
                    </p>
                    {ownL5.streak != null && ownL5.streak !== 0 && (
                      <p
                        className={cn(
                          "text-xs font-black mt-0.5",
                          ownL5.streak > 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-destructive",
                        )}
                      >
                        {ownL5.streak > 0
                          ? `${es ? "Racha" : zh ? "连胜" : "Streak"} W${ownL5.streak}`
                          : `${es ? "Racha" : zh ? "连败" : "Streak"} L${Math.abs(ownL5.streak)}`}
                      </p>
                    )}
                    {ownL5.eFGPct != null && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        eFG% <span className="font-black text-foreground">{num(ownL5.eFGPct).toFixed(1)}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

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
                    <div className="grid grid-cols-[0.3fr_1fr_0.5fr_0.35fr_0.35fr_0.4fr_auto] gap-1 border-b border-border bg-muted/30 px-2 py-2 text-xs font-black uppercase tracking-wider text-muted-foreground">
                      <span className="text-center">{L.colRank}</span>
                      <span>{L.colTeam}</span>
                      <span className="text-right">{L.colWL}</span>
                      <span className="text-right">{L.colPPG}</span>
                      <span className="text-right">{L.colOPPG}</span>
                      <span className="text-right">{L.colNET}</span>
                      <span className="text-right">eFG%</span>
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
                            className="w-full grid grid-cols-[0.3fr_1fr_0.5fr_0.35fr_0.35fr_0.4fr_auto] gap-1 items-center px-2 py-2 border-b border-border last:border-b-0 text-xs text-left touch-manipulation hover:bg-muted/25 active:bg-muted/40 active:opacity-90 transition-colors"
                          >
                            <p className="text-center font-black tabular-nums text-muted-foreground">{row.rank}</p>
                            <div className="min-w-0 flex items-center gap-1.5">
                              {row.logoUrl ? (
                                <img src={row.logoUrl} alt="" className="w-7 h-7 rounded-md object-contain bg-muted/30 shrink-0" />
                              ) : (
                                <div className="w-7 h-7 rounded-md bg-muted/40 shrink-0" />
                              )}
                              <div className="min-w-0">
                                <p className="font-bold text-foreground truncate">
                                  {pickName(row.teamName, row.teamNameEn, locale)}
                                </p>
                                {row.streak != null && row.streak !== 0 && (
                                  <p
                                    className={cn(
                                      "text-[9px] font-black",
                                      row.streak > 0
                                        ? "text-green-600 dark:text-green-400"
                                        : "text-destructive",
                                    )}
                                  >
                                    {row.streak > 0 ? `W${row.streak}` : `L${Math.abs(row.streak)}`}
                                  </p>
                                )}
                              </div>
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
                            <p className="text-right font-black tabular-nums text-xs">
                              {row.eFGPct != null ? `${num(row.eFGPct).toFixed(1)}` : "—"}
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
            {canUsePlayerUX && myExternalId && (
              <div className="mb-4">
                <button
                  type="button"
                  onClick={() => setPlayerSheetId(myExternalId)}
                  className="w-full rounded-2xl border border-primary/30 bg-primary/5 p-4 text-left hover:bg-primary/10 transition-colors active:opacity-80 touch-manipulation"
                >
                  <p className="text-[10px] font-black uppercase tracking-wider text-primary mb-1">
                    {es ? "Mis estadísticas" : zh ? "我的数据" : "My stats"}
                  </p>
                  <p className="text-base font-black text-foreground">
                    {es ? "Ver mi ficha completa →" : zh ? "查看我的完整数据 →" : "View my full profile →"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {es
                      ? "Percentiles · Home/Away · Forma reciente"
                      : zh
                        ? "百分位 · 主客场 · 近期状态"
                        : "Percentiles · Home/Away · Recent form"}
                  </p>
                </button>
              </div>
            )}
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
                          <span className="text-[8px] md:text-xs">{jugadorasSortDir === "desc" ? "▼" : "▲"}</span>
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
                            <div className="w-7 h-7 rounded-full bg-muted/40 shrink-0 flex items-center justify-center text-[8px] md:text-sm font-black text-muted-foreground">
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
        open={!isDesktop && Boolean(playerSheetId)}
        onOpenChange={(open) => {
          if (!open) closePlayerSheet();
        }}
      >
        <SheetContent side="bottom" className="h-[92dvh] rounded-t-2xl p-0 flex flex-col max-w-lg mx-auto w-full">
          <StatsPlayerSheet
            externalId={playerSheetId}
            onClose={closePlayerSheet}
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

      <Sheet
        open={!isDesktop && Boolean(teamSheetId)}
        onOpenChange={(open) => {
          if (!open) setTeamSheetId(null);
        }}
      >
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
  "eFG%": "Effective FG% = (FGM + 0.5×3PM) / FGA — pondera los triples",
  "TOV%": "Turnover Rate — % de posesiones que terminan en pérdida de balón",
  "FT Rate": "Free Throw Rate = FTA / FGA — cuántos tiros libres genera por tiro de campo",
  "ORB%": "Offensive Rebound % — % de rebotes ofensivos disponibles capturados",
  DD: "Double-Doubles",
  TD: "Triple-Doubles",
};

// ─────────────────────────────────────────────────────────────────────────
// ShotZoneChart — 10 zonas estándar NBA
// Sistema de coordenadas: NBA stats API (hoop=origen, 1ft=10u), escala=0.6
// SVG: W=300 H=282 | sx(x)=(x+250)*0.6 | sy(y)=(422.5-y)*0.6
//
// Zonas 3PT: Corner-L/R, Wing-L/R, Center-3
// Zonas 2PT: RA, Paint, Mid-Left/Center/Right
//
// Colores por tema:
//  dark (.dark):        fondo #0c1018, líneas rgba(255,255,255,0.22)
//  office (.theme-office):  fondo #c8d0e0, líneas rgba(0,0,0,0.22)
//  oldschool (.theme-oldschool): fondo #1a0c02, líneas rgba(240,224,168,0.22)
//
// Verde/Ámbar/Rojo son universales a los tres temas.
// ─────────────────────────────────────────────────────────────────────────

interface ShotZoneData {
  pct: number | null;
  lg: number;
  fgm?: number;
  fga?: number;
}

interface ShotZoneChartProps {
  fgPct?: number | null;
  fg3Pct?: number | null;
  zones?: {
    ra?: ShotZoneData;
    paint?: ShotZoneData;
    mid2L?: ShotZoneData;
    mid2C?: ShotZoneData;
    mid2R?: ShotZoneData;
    c3L?: ShotZoneData;
    wg3L?: ShotZoneData;
    ctr3?: ShotZoneData;
    wg3R?: ShotZoneData;
    c3R?: ShotZoneData;
  };
  showLabels?: boolean;
}

function ShotZoneChart({ fgPct, fg3Pct, zones, showLabels = true }: ShotZoneChartProps) {
  function zf(pct: number | null, lg: number): string {
    if (pct == null) return "rgba(128,128,128,0.08)";
    const d = pct - lg;
    if (d > 3) return "rgba(34,197,94,0.62)";
    if (d > -3) return "rgba(234,179,8,0.55)";
    return "rgba(239,68,68,0.60)";
  }

  const Z = {
    ra: zones?.ra ?? { pct: fgPct ?? null, lg: 63.0 },
    paint: zones?.paint ?? { pct: fgPct ?? null, lg: 46.0 },
    mid2L: zones?.mid2L ?? { pct: fgPct ?? null, lg: 38.0 },
    mid2C: zones?.mid2C ?? { pct: fgPct ?? null, lg: 38.0 },
    mid2R: zones?.mid2R ?? { pct: fgPct ?? null, lg: 38.0 },
    c3L: zones?.c3L ?? { pct: fg3Pct ?? null, lg: 35.5 },
    wg3L: zones?.wg3L ?? { pct: fg3Pct ?? null, lg: 34.0 },
    ctr3: zones?.ctr3 ?? { pct: fg3Pct ?? null, lg: 34.0 },
    wg3R: zones?.wg3R ?? { pct: fg3Pct ?? null, lg: 34.0 },
    c3R: zones?.c3R ?? { pct: fg3Pct ?? null, lg: 35.5 },
  };

  const hasData = fgPct != null || fg3Pct != null || zones != null;

  const W = 300,
    H = 282;
  const HX = 150,
    HY = 253.5;
  const PLX = 102,
    PRX = 198;
  const FTY = 168;
  const FTR = 36;
  const RAR = 24;
  const C3L = 18,
    C3R = 282;
  const C3Y = 200;
  const ARC_R = 142.5;
  const ASX = 282.1,
    ASY = 200.1;
  const AEX = 17.9,
    AEY = 200.1;
  const WING_L = 102,
    WING_R = 198;

  const clipId = `arc2pt_sz`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ display: "block", borderRadius: 6, overflow: "hidden" }}
      aria-label="Shot zone chart"
    >
      <defs>
        <clipPath id={clipId}>
          <path d={`M ${ASX} ${ASY} A ${ARC_R} ${ARC_R} 0 0 0 ${AEX} ${AEY} L 0 ${H} L ${W} ${H} Z`} />
        </clipPath>
      </defs>

      <rect width={W} height={H} fill="hsl(var(--muted))" opacity="0.15" rx="3" />

      <rect
        x={0}
        y={C3Y}
        width={C3L}
        height={H - C3Y}
        fill={zf(Z.c3L.pct, Z.c3L.lg)}
        opacity={hasData ? 0.84 : 0.3}
      />
      <rect
        x={C3L}
        y={0}
        width={WING_L - C3L}
        height={H}
        fill={zf(Z.wg3L.pct, Z.wg3L.lg)}
        opacity={hasData ? 0.72 : 0.3}
      />
      <rect
        x={WING_L}
        y={0}
        width={WING_R - WING_L}
        height={FTY}
        fill={zf(Z.ctr3.pct, Z.ctr3.lg)}
        opacity={hasData ? 0.72 : 0.3}
      />
      <rect
        x={WING_R}
        y={0}
        width={C3R - WING_R}
        height={H}
        fill={zf(Z.wg3R.pct, Z.wg3R.lg)}
        opacity={hasData ? 0.72 : 0.3}
      />
      <rect
        x={C3R}
        y={C3Y}
        width={W - C3R}
        height={H - C3Y}
        fill={zf(Z.c3R.pct, Z.c3R.lg)}
        opacity={hasData ? 0.84 : 0.3}
      />

      <rect
        x={C3L}
        y={0}
        width={WING_L - C3L}
        height={H}
        fill={zf(Z.mid2L.pct, Z.mid2L.lg)}
        clipPath={`url(#${clipId})`}
        opacity={hasData ? 0.78 : 0.3}
      />
      <rect
        x={WING_L}
        y={0}
        width={WING_R - WING_L}
        height={FTY}
        fill={zf(Z.mid2C.pct, Z.mid2C.lg)}
        clipPath={`url(#${clipId})`}
        opacity={hasData ? 0.78 : 0.3}
      />
      <rect
        x={WING_R}
        y={0}
        width={C3R - WING_R}
        height={H}
        fill={zf(Z.mid2R.pct, Z.mid2R.lg)}
        clipPath={`url(#${clipId})`}
        opacity={hasData ? 0.78 : 0.3}
      />
      <rect
        x={PLX}
        y={FTY}
        width={PRX - PLX}
        height={H - FTY}
        fill={zf(Z.paint.pct, Z.paint.lg)}
        opacity={hasData ? 0.88 : 0.3}
      />
      <circle
        cx={HX}
        cy={HY}
        r={RAR}
        fill={zf(Z.ra.pct, Z.ra.lg)}
        opacity={hasData ? 0.94 : 0.3}
      />

      <rect
        width={W}
        height={H}
        fill="none"
        stroke="hsl(var(--foreground))"
        strokeOpacity="0.18"
        strokeWidth="1.4"
        rx="3"
      />
      <rect
        x={PLX}
        y={FTY}
        width={PRX - PLX}
        height={H - FTY}
        fill="none"
        stroke="hsl(var(--foreground))"
        strokeOpacity="0.18"
        strokeWidth="1.4"
      />
      <rect
        x={114}
        y={FTY}
        width={72}
        height={H - FTY}
        fill="none"
        stroke="hsl(var(--foreground))"
        strokeOpacity="0.18"
        strokeWidth="1.4"
      />
      <line
        x1={PLX}
        y1={FTY}
        x2={PRX}
        y2={FTY}
        stroke="hsl(var(--foreground))"
        strokeOpacity="0.18"
        strokeWidth="1.4"
      />
      <path
        d={`M ${HX - FTR} ${FTY} A ${FTR} ${FTR} 0 0 1 ${HX + FTR} ${FTY}`}
        fill="none"
        stroke="hsl(var(--foreground))"
        strokeOpacity="0.18"
        strokeWidth="1.4"
      />
      <path
        d={`M ${HX - FTR} ${FTY} A ${FTR} ${FTR} 0 0 0 ${HX + FTR} ${FTY}`}
        fill="none"
        stroke="hsl(var(--foreground))"
        strokeOpacity="0.08"
        strokeWidth="1"
        strokeDasharray="4 3"
      />
      <path
        d={`M ${HX - RAR} ${HY} A ${RAR} ${RAR} 0 0 1 ${HX + RAR} ${HY}`}
        fill="none"
        stroke="hsl(var(--foreground))"
        strokeOpacity="0.18"
        strokeWidth="1.4"
      />
      <line
        x1={C3L}
        y1={H}
        x2={C3L}
        y2={C3Y}
        stroke="hsl(var(--foreground))"
        strokeOpacity="0.18"
        strokeWidth="1.4"
      />
      <line
        x1={C3R}
        y1={H}
        x2={C3R}
        y2={C3Y}
        stroke="hsl(var(--foreground))"
        strokeOpacity="0.18"
        strokeWidth="1.4"
      />
      <path
        d={`M ${ASX} ${ASY} A ${ARC_R} ${ARC_R} 0 0 0 ${AEX} ${AEY}`}
        fill="none"
        stroke="hsl(var(--foreground))"
        strokeOpacity="0.18"
        strokeWidth="1.4"
      />
      <line
        x1={WING_L}
        y1={FTY}
        x2={WING_L}
        y2={0}
        stroke="hsl(var(--foreground))"
        strokeOpacity="0.08"
        strokeWidth="1"
        strokeDasharray="4 3"
      />
      <line
        x1={WING_R}
        y1={FTY}
        x2={WING_R}
        y2={0}
        stroke="hsl(var(--foreground))"
        strokeOpacity="0.08"
        strokeWidth="1"
        strokeDasharray="4 3"
      />
      <path
        d="M 110 0 A 60 60 0 0 0 190 0"
        fill="none"
        stroke="hsl(var(--foreground))"
        strokeOpacity="0.08"
        strokeWidth="1"
        strokeDasharray="4 3"
      />
      <line
        x1={132}
        y1={H - 22}
        x2={168}
        y2={H - 22}
        stroke="hsl(var(--foreground))"
        strokeOpacity="0.22"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle
        cx={HX}
        cy={HY}
        r={7.5}
        fill="none"
        stroke="hsl(var(--foreground))"
        strokeOpacity="0.18"
        strokeWidth="1.4"
      />

      {showLabels && (
        <>
          {Z.ra.pct != null && (
            <>
              <text
                x={HX}
                y={253}
                textAnchor="middle"
                fontSize={11}
                fontWeight="900"
                fill="hsl(var(--foreground))"
                fontFamily="-apple-system,system-ui,sans-serif"
              >
                {Z.ra.pct.toFixed(1)}%
              </text>
              {Z.ra.fga && (
                <text
                  x={HX}
                  y={264}
                  textAnchor="middle"
                  fontSize={8.5}
                  fontWeight="700"
                  fill="hsl(var(--foreground))"
                  fillOpacity="0.52"
                  fontFamily="-apple-system,system-ui,sans-serif"
                >
                  {Z.ra.fgm}/{Z.ra.fga}
                </text>
              )}
            </>
          )}
          {Z.paint.pct != null && (
            <>
              <text
                x={HX}
                y={192}
                textAnchor="middle"
                fontSize={9}
                fontWeight="900"
                fill="hsl(var(--foreground))"
                fontFamily="-apple-system,system-ui,sans-serif"
              >
                {Z.paint.pct.toFixed(1)}%
              </text>
              {Z.paint.fga && (
                <text
                  x={HX}
                  y={202}
                  textAnchor="middle"
                  fontSize={7.5}
                  fontWeight="700"
                  fill="hsl(var(--foreground))"
                  fillOpacity="0.52"
                  fontFamily="-apple-system,system-ui,sans-serif"
                >
                  {Z.paint.fgm}/{Z.paint.fga}
                </text>
              )}
            </>
          )}
          {Z.mid2L.pct != null && (
            <>
              <text
                x={60}
                y={165}
                textAnchor="middle"
                fontSize={9}
                fontWeight="900"
                fill="hsl(var(--foreground))"
                fontFamily="-apple-system,system-ui,sans-serif"
              >
                {Z.mid2L.pct.toFixed(1)}%
              </text>
              {Z.mid2L.fga && (
                <text
                  x={60}
                  y={175}
                  textAnchor="middle"
                  fontSize={7.5}
                  fontWeight="700"
                  fill="hsl(var(--foreground))"
                  fillOpacity="0.52"
                  fontFamily="-apple-system,system-ui,sans-serif"
                >
                  {Z.mid2L.fgm}/{Z.mid2L.fga}
                </text>
              )}
            </>
          )}
          {Z.mid2C.pct != null && (
            <>
              <text
                x={HX}
                y={134}
                textAnchor="middle"
                fontSize={9}
                fontWeight="900"
                fill="hsl(var(--foreground))"
                fontFamily="-apple-system,system-ui,sans-serif"
              >
                {Z.mid2C.pct.toFixed(1)}%
              </text>
              {Z.mid2C.fga && (
                <text
                  x={HX}
                  y={144}
                  textAnchor="middle"
                  fontSize={7.5}
                  fontWeight="700"
                  fill="hsl(var(--foreground))"
                  fillOpacity="0.52"
                  fontFamily="-apple-system,system-ui,sans-serif"
                >
                  {Z.mid2C.fgm}/{Z.mid2C.fga}
                </text>
              )}
            </>
          )}
          {Z.mid2R.pct != null && (
            <>
              <text
                x={240}
                y={165}
                textAnchor="middle"
                fontSize={9}
                fontWeight="900"
                fill="hsl(var(--foreground))"
                fontFamily="-apple-system,system-ui,sans-serif"
              >
                {Z.mid2R.pct.toFixed(1)}%
              </text>
              {Z.mid2R.fga && (
                <text
                  x={240}
                  y={175}
                  textAnchor="middle"
                  fontSize={7.5}
                  fontWeight="700"
                  fill="hsl(var(--foreground))"
                  fillOpacity="0.52"
                  fontFamily="-apple-system,system-ui,sans-serif"
                >
                  {Z.mid2R.fgm}/{Z.mid2R.fga}
                </text>
              )}
            </>
          )}
          {Z.wg3L.pct != null && (
            <>
              <text
                x={60}
                y={72}
                textAnchor="middle"
                fontSize={9}
                fontWeight="900"
                fill="hsl(var(--foreground))"
                fontFamily="-apple-system,system-ui,sans-serif"
              >
                {Z.wg3L.pct.toFixed(1)}%
              </text>
              {Z.wg3L.fga && (
                <text
                  x={60}
                  y={82}
                  textAnchor="middle"
                  fontSize={7.5}
                  fontWeight="700"
                  fill="hsl(var(--foreground))"
                  fillOpacity="0.52"
                  fontFamily="-apple-system,system-ui,sans-serif"
                >
                  {Z.wg3L.fgm}/{Z.wg3L.fga}
                </text>
              )}
            </>
          )}
          {Z.ctr3.pct != null && (
            <>
              <text
                x={HX}
                y={55}
                textAnchor="middle"
                fontSize={11}
                fontWeight="900"
                fill="hsl(var(--foreground))"
                fontFamily="-apple-system,system-ui,sans-serif"
              >
                {Z.ctr3.pct.toFixed(1)}%
              </text>
              {Z.ctr3.fga && (
                <text
                  x={HX}
                  y={67}
                  textAnchor="middle"
                  fontSize={8.5}
                  fontWeight="700"
                  fill="hsl(var(--foreground))"
                  fillOpacity="0.52"
                  fontFamily="-apple-system,system-ui,sans-serif"
                >
                  {Z.ctr3.fgm}/{Z.ctr3.fga}
                </text>
              )}
            </>
          )}
          {Z.wg3R.pct != null && (
            <>
              <text
                x={240}
                y={72}
                textAnchor="middle"
                fontSize={9}
                fontWeight="900"
                fill="hsl(var(--foreground))"
                fontFamily="-apple-system,system-ui,sans-serif"
              >
                {Z.wg3R.pct.toFixed(1)}%
              </text>
              {Z.wg3R.fga && (
                <text
                  x={240}
                  y={82}
                  textAnchor="middle"
                  fontSize={7.5}
                  fontWeight="700"
                  fill="hsl(var(--foreground))"
                  fillOpacity="0.52"
                  fontFamily="-apple-system,system-ui,sans-serif"
                >
                  {Z.wg3R.fgm}/{Z.wg3R.fga}
                </text>
              )}
            </>
          )}
          {Z.c3L.pct != null && (
            <>
              <text
                x={9}
                y={241}
                textAnchor="middle"
                fontSize={8}
                fontWeight="900"
                fill="hsl(var(--foreground))"
                fontFamily="-apple-system,system-ui,sans-serif"
                transform="rotate(-90 9 241)"
              >
                {Z.c3L.pct.toFixed(1)}%
              </text>
              {Z.c3L.fga && (
                <text
                  x={9}
                  y={252}
                  textAnchor="middle"
                  fontSize={6.5}
                  fontWeight="700"
                  fill="hsl(var(--foreground))"
                  fillOpacity="0.52"
                  fontFamily="-apple-system,system-ui,sans-serif"
                  transform="rotate(-90 9 252)"
                >
                  {Z.c3L.fgm}/{Z.c3L.fga}
                </text>
              )}
            </>
          )}
          {Z.c3R.pct != null && (
            <>
              <text
                x={291}
                y={241}
                textAnchor="middle"
                fontSize={8}
                fontWeight="900"
                fill="hsl(var(--foreground))"
                fontFamily="-apple-system,system-ui,sans-serif"
                transform="rotate(90 291 241)"
              >
                {Z.c3R.pct.toFixed(1)}%
              </text>
              {Z.c3R.fga && (
                <text
                  x={291}
                  y={252}
                  textAnchor="middle"
                  fontSize={6.5}
                  fontWeight="700"
                  fill="hsl(var(--foreground))"
                  fillOpacity="0.52"
                  fontFamily="-apple-system,system-ui,sans-serif"
                  transform="rotate(90 291 252)"
                >
                  {Z.c3R.fgm}/{Z.c3R.fga}
                </text>
              )}
            </>
          )}
        </>
      )}
    </svg>
  );
}

function AdvChip({
  label,
  value,
  p95,
  fmt,
}: {
  label: string;
  value: number;
  p95: number | null;
  fmt: (v: number) => string;
}) {
  const title = STAT_FULL[label] ?? label;
  // Percentile bar: 0–100 based on p95 as ceiling
  const pct = p95 != null && p95 > 0 ? Math.min(100, (value / p95) * 100) : null;
  const barColor =
    pct == null
      ? "bg-primary/40"
      : pct >= 75
        ? "bg-green-500"
        : pct >= 40
          ? "bg-amber-500"
          : "bg-destructive/70";

  return (
    <div title={title} className="rounded-xl border border-border bg-card px-2.5 py-2.5 space-y-1.5 cursor-help">
      <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/60">{label}</p>
      <p className="text-sm font-black text-foreground tabular-nums">{fmt(value)}</p>
      {pct != null && (
        <div className="h-1 rounded-full bg-muted/50 overflow-hidden">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

function SplitStat({ label, val }: { label: string; val: number }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-[9px] font-black uppercase tracking-wide text-muted-foreground/50">{label}</p>
      <p className="text-xs font-black tabular-nums text-foreground">{val.toFixed(1)}</p>
    </div>
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

function StatsDesktopPanel(props: {
  playerSheetId: string | null;
  teamSheetId: string | null;
  seasonId: number;
  locale: string;
  returnToTeamId: string | null;
  onClosePlayer: () => void;
  onCloseTeam: () => void;
  onTeamTapFromPlayer: (teamId: string) => void;
  onPlayerTapFromTeam: (id: string) => void;
}) {
  const es = props.locale === "es";
  const zh = props.locale === "zh";

  if (!props.playerSheetId && !props.teamSheetId) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 min-h-[12rem] p-8 text-center gap-3">
        <BarChart3 className="w-10 h-10 text-muted-foreground/40" aria-hidden />
        <p className="text-sm font-semibold text-muted-foreground">
          {es ? "Selecciona un equipo o jugadora" : zh ? "选择球队或球员" : "Select a team or player"}
        </p>
      </div>
    );
  }

  if (props.playerSheetId) {
    return (
      <div className="flex flex-col h-full min-h-0">
        <StatsPlayerSheet
          externalId={props.playerSheetId}
          onClose={props.onClosePlayer}
          onTeamTap={props.onTeamTapFromPlayer}
          returnToTeamId={props.returnToTeamId}
          locale={props.locale}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <StatsTeamSheet
        externalId={props.teamSheetId}
        seasonId={props.seasonId}
        onClose={props.onCloseTeam}
        onPlayerTap={props.onPlayerTapFromTeam}
        locale={props.locale}
      />
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
  const leagueAvgQ = useLeagueAverages();
  const percentilesQ = usePlayerPercentiles();
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

  const leagueAvg = leagueAvgQ.data;

  const playerTovPct = useMemo(() => {
    if (gameLog.length === 0) return null;
    let tov = 0;
    let fga = 0;
    let fta = 0;
    for (const g of gameLog) {
      tov += g.tov ?? 0;
      fga += g.fga ?? 0;
      fta += g.fta ?? 0;
    }
    const poss = fga + 0.44 * fta + tov;
    return poss > 0 ? (tov / poss) * 100 : null;
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
                    <div className="grid grid-cols-2 gap-2">
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

            {/* ── Advanced metrics chips ── */}
            {(player.tsPct != null || player.eFGPct != null || player.pie != null || player.astTovRatio != null || player.usagePct != null) && (
              <div className="space-y-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">
                  {es ? "Métricas avanzadas" : zh ? "进阶数据" : "Advanced metrics"}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {player.tsPct != null && (
                    <AdvChip
                      label="TS%"
                      value={player.tsPct}
                      p95={percentilesQ.data?.p95TsPct ?? null}
                      fmt={(v) => `${v.toFixed(1)}%`}
                    />
                  )}
                  {player.eFGPct != null && (
                    <AdvChip
                      label="eFG%"
                      value={player.eFGPct}
                      p95={percentilesQ.data?.p95EFGPct ?? null}
                      fmt={(v) => `${v.toFixed(1)}%`}
                    />
                  )}
                  {player.pie != null && (
                    <AdvChip
                      label="PIE"
                      value={player.pie}
                      p95={null}
                      fmt={(v) => `${v.toFixed(1)}%`}
                    />
                  )}
                  {player.astTovRatio != null && (
                    <AdvChip
                      label="AST/TOV"
                      value={player.astTovRatio}
                      p95={null}
                      fmt={(v) => v.toFixed(2)}
                    />
                  )}
                  {player.usagePct != null && (
                    <AdvChip
                      label="USG%"
                      value={player.usagePct}
                      p95={null}
                      fmt={(v) => `${v.toFixed(1)}%`}
                    />
                  )}
                </div>
              </div>
            )}

            {/* ── Home / Away split ── */}
            {(player.homeSplit || player.awaySplit) && (
              <div className="space-y-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">
                  {es ? "Casa / Fuera" : zh ? "主场 / 客场" : "Home / Away"}
                </p>
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                  <div className="grid grid-cols-2 divide-x divide-border">
                    {player.homeSplit && (
                      <div className="p-3">
                        <p className="text-[9px] font-black uppercase tracking-wide text-green-600 dark:text-green-400 mb-2">
                          🏠 {es ? "Casa" : zh ? "主场" : "Home"}
                        </p>
                        <div className="space-y-1">
                          <SplitStat label="PPG" val={player.homeSplit.pts} />
                          <SplitStat label="RPG" val={player.homeSplit.reb} />
                          <SplitStat label="APG" val={player.homeSplit.ast} />
                        </div>
                      </div>
                    )}
                    {player.awaySplit && (
                      <div className="p-3">
                        <p className="text-[9px] font-black uppercase tracking-wide text-amber-500 mb-2">
                          ✈️ {es ? "Fuera" : zh ? "客场" : "Away"}
                        </p>
                        <div className="space-y-1">
                          <SplitStat label="PPG" val={player.awaySplit.pts} />
                          <SplitStat label="RPG" val={player.awaySplit.reb} />
                          <SplitStat label="APG" val={player.awaySplit.ast} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

              {advStats && (
                <div className="rounded-2xl border border-border bg-card p-3 space-y-2">
                  <p className="text-xs font-black uppercase tracking-wider text-muted-foreground/70 px-0.5">
                    {es ? "Cuatro Factores vs Liga" : zh ? "四因素 vs 联赛均值" : "Four Factors vs League"}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      {
                        label: "eFG%",
                        val: player.eFGPct ?? advStats.eFGPct,
                        lgVal: leagueAvg?.eFGPct ?? null,
                        higherIsBetter: true,
                        fmt: (v: number) => `${v.toFixed(1)}%`,
                      },
                      {
                        label: "TOV%",
                        val: playerTovPct,
                        lgVal: leagueAvg?.tovPct ?? null,
                        higherIsBetter: false,
                        fmt: (v: number) => `${v.toFixed(1)}%`,
                      },
                      {
                        label: "FT Rate",
                        val: player.ftRate,
                        lgVal: leagueAvg?.ftRate ?? null,
                        higherIsBetter: true,
                        fmt: (v: number) => v.toFixed(2),
                      },
                      {
                        label: "TS%",
                        val: player.tsPct ?? advStats.tsPct,
                        lgVal: leagueAvg?.tsPct ?? null,
                        higherIsBetter: true,
                        fmt: (v: number) => `${v.toFixed(1)}%`,
                      },
                    ].map(({ label, val, lgVal, higherIsBetter, fmt }) => {
                      const better =
                        val != null && lgVal != null
                          ? higherIsBetter
                            ? val > lgVal
                            : val < lgVal
                          : null;
                      const color =
                        better === true
                          ? "text-green-600 dark:text-green-400"
                          : better === false
                            ? "text-destructive"
                            : "text-foreground";
                      const dot =
                        better === true
                          ? "bg-green-500"
                          : better === false
                            ? "bg-destructive"
                            : "bg-muted-foreground/40";
                      return (
                        <div key={label} className="rounded-xl border border-border bg-muted/20 p-2.5">
                          <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/60">
                            {label}
                          </p>
                          <p className={cn("text-lg font-black tabular-nums mt-0.5", color)}>
                            {val != null ? fmt(val) : "—"}
                          </p>
                          {lgVal != null && (
                            <div className="flex items-center gap-1 mt-1">
                              <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", dot)} />
                              <span className="text-[9px] text-muted-foreground">
                                {es ? "Liga" : zh ? "联赛" : "Lg"}: {fmt(lgVal)}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {advStats &&
                gameLog.length >= 3 &&
                (() => {
                  const last5 = [...gameLog]
                    .sort(
                      (a, b) =>
                        new Date(b.gameDate ?? 0).getTime() - new Date(a.gameDate ?? 0).getTime(),
                    )
                    .slice(0, 5);
                  const maxPts = Math.max(...last5.map((g) => g.pts ?? 0), 1);
                  return (
                    <div className="rounded-2xl border border-border bg-card p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-black uppercase tracking-wider text-muted-foreground/70">
                          {es ? "Forma reciente" : zh ? "近期状态" : "Recent form"} · L{last5.length}
                        </p>
                        {advStats.isHot && (
                          <span className="text-[10px] font-black text-green-600 dark:text-green-400">
                            🔥 {es ? "En racha" : zh ? "状态火热" : "Hot streak"}
                          </span>
                        )}
                        {advStats.isCold && (
                          <span className="text-[10px] font-black text-destructive">
                            ❄️ {es ? "Bajón" : zh ? "状态低迷" : "Cold"}
                          </span>
                        )}
                      </div>
                      <div className="flex items-end gap-1.5 h-10">
                        {[...last5].reverse().map((g, i) => (
                          <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                            <div
                              className="w-full rounded-sm bg-primary/40"
                              style={{
                                height: `${Math.round(((g.pts ?? 0) / maxPts) * 100)}%`,
                                minHeight: 4,
                              }}
                            />
                            <span className="text-[8px] font-black text-muted-foreground tabular-nums">
                              {g.pts}
                            </span>
                          </div>
                        ))}
                      </div>
                      {advStats.last5Avg != null && (
                        <p className="text-[10px] text-muted-foreground">
                          {es ? "Media L5" : zh ? "近5场均值" : "L5 avg"}:{" "}
                          <span className="font-black text-foreground">
                            {advStats.last5Avg.toFixed(1)} PTS
                          </span>
                          {" · "}
                          {es ? "temporada" : zh ? "赛季" : "season"}: {advStats.meanPts.toFixed(1)}
                        </p>
                      )}
                    </div>
                  );
                })()}

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
                            <span className="inline-block rounded-full bg-primary/15 text-primary text-[8px] md:text-xs font-black uppercase tracking-wide px-1.5 py-0 leading-4">
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
  const leagueAvgQ = useLeagueAverages(seasonId);
  const leagueAvg = leagueAvgQ.data;

  const team = data?.team;
  const players = data?.players ?? [];
  const teamGameLog: TeamGameLogEntry[] = team?.gameLog ?? [];
  const pointsByZone = team?.pointsByZone ?? null;

  const [activeTab, setActiveTab] = useState<"ficha" | "avanzado" | "partidos">("ficha");
  const [rosterOpen, setRosterOpen] = useState(false);
  const [rosterSort, setRosterSort] = useState<"ppg" | "rpg" | "apg">("ppg");
  const [rosterSortDir, setRosterSortDir] = useState<"asc" | "desc">("desc");

  const activePlayers = [...players.filter((p) => p.games > 0)].sort((a, b) => {
    const diff = (b[rosterSort] ?? 0) - (a[rosterSort] ?? 0);
    return rosterSortDir === "desc" ? diff : -diff;
  });

  const teamName = pickName(team?.nameZh, team?.nameEn, locale) || "—";

  const l5 = teamGameLog.slice(0, 5);
  const l5Avg =
    l5.length > 0
      ? {
          pts: l5.reduce((s, g) => s + g.teamScore, 0) / l5.length,
          opp: l5.reduce((s, g) => s + g.oppScore, 0) / l5.length,
        }
      : null;

  const L = {
    close: es ? "Volver" : zh ? "返回" : "Back",
    error: es ? "Error al cargar" : zh ? "加载失败" : "Failed to load",
    noData: es ? "Sin datos" : zh ? "暂无数据" : "No data",
    roster: es ? "Plantilla" : zh ? "阵容" : "Roster",
    colPlayer: es ? "Jugadora" : zh ? "球员" : "Player",
    colG: es ? "PJ" : zh ? "场" : "G",
    teamNoPlayerStats: es ? "Sin estadísticas disponibles" : zh ? "暂无统计数据" : "No statistics available",
    tabFicha: es ? "Ficha" : zh ? "概况" : "Overview",
    tabAvanzado: es ? "Avanzado" : zh ? "高级" : "Advanced",
    tabPartidos: es ? "Partidos" : zh ? "赛程" : "Games",
    fourFactors: es ? "Cuatro Factores vs Liga" : zh ? "四因素 vs 联赛均值" : "Four Factors vs League",
    homeAway: es ? "Casa vs Fuera" : zh ? "主客场" : "Home / Away",
    form: es ? "Forma reciente · L5" : zh ? "近5场" : "Recent Form · L5",
    efficiency: es ? "Eficiencia global" : zh ? "整体效率" : "Efficiency",
    perPossession: es ? "Por posesión" : zh ? "每次进攻" : "Per Possession",
    reboundsLabel: es ? "Rebotes · Asistencias · Eficiencia" : zh ? "篮板助攻效率" : "Reb · Ast · Efficiency",
    pointsZone: es ? "Puntos por zona" : zh ? "得分区域" : "Points by Zone",
    lineups: es ? "Quintetos · +/−" : zh ? "阵容正负值" : "Lineups +/−",
    piPending: es ? "Disponible cuando Pi sincronice" : zh ? "Pi数据同步后可用" : "Available when Pi syncs",
    showRoster: es ? "Ver plantilla completa" : zh ? "查看完整名单" : "View full roster",
    players14: (n: number) => (es ? `${n} jugadoras` : zh ? `${n}名球员` : `${n} players`),
    lg: es ? "Liga" : zh ? "联赛" : "Lg",
  };

  function FactorChip({
    label,
    val,
    lgVal,
    better,
    fmt,
    center,
  }: {
    label: string;
    val: number | null | undefined;
    lgVal: number | null;
    better: boolean;
    fmt: (v: number) => string;
    center?: boolean;
  }) {
    const isGood = val != null && lgVal != null ? (better ? val > lgVal : val < lgVal) : null;
    const valColor =
      isGood === true
        ? "text-green-600 dark:text-green-400"
        : isGood === false
          ? "text-destructive"
          : "text-foreground";
    const dotColor =
      isGood === true
        ? "bg-green-500"
        : isGood === false
          ? "bg-destructive"
          : "bg-muted-foreground/40";
    return (
      <div className={cn("rounded-xl border border-border bg-muted/20 p-2.5", center && "text-center")}>
        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/60">{label}</p>
        <p className={cn("text-lg font-black tabular-nums mt-0.5", valColor)}>
          {val != null ? fmt(val) : "—"}
        </p>
        {lgVal != null && (
          <div className={cn("flex items-center gap-1 mt-1", center && "justify-center")}>
            <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", dotColor)} />
            <span className="text-[9px] text-muted-foreground">
              {L.lg}: {fmt(lgVal)}
            </span>
          </div>
        )}
      </div>
    );
  }

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
            <img
              src={team.logoUrl}
              alt=""
              className="w-8 h-8 rounded-md object-contain bg-muted/30 shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-md bg-muted/40 shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-base font-black text-foreground truncate">{teamName}</p>
            {team && (
              <p className="text-xs text-muted-foreground">
                {team.wins}-{team.losses}
                {team.net != null && (
                  <span
                    className={cn(
                      "ml-2 font-black",
                      team.net > 0
                        ? "text-green-600 dark:text-green-400"
                        : team.net < 0
                          ? "text-destructive"
                          : "text-muted-foreground",
                    )}
                  >
                    NET {team.net > 0 ? `+${team.net}` : team.net}
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
        {team && (
          <div className="shrink-0">
            <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">
              #{team.rank}
            </p>
          </div>
        )}
      </div>

      <div className="flex border-b border-border shrink-0 bg-card">
        {(["ficha", "avanzado", "partidos"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setActiveTab(t)}
            className={cn(
              "flex-1 py-2.5 text-[11px] font-black uppercase tracking-wide transition-colors border-b-2",
              activeTab === t
                ? "text-primary border-primary"
                : "text-muted-foreground border-transparent",
            )}
          >
            {t === "ficha" ? L.tabFicha : t === "avanzado" ? L.tabAvanzado : L.tabPartidos}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {isError && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm font-bold text-destructive">{L.error}</p>
        </div>
      )}

      {!isLoading && !isError && team && (
        <div className="flex-1 overflow-y-auto">
          {activeTab === "ficha" && (
            <div className="px-4 py-4 space-y-4">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2">
                  {L.efficiency}
                </p>
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                  <div className="grid grid-cols-3 divide-x divide-border">
                    {[
                      { lbl: "PPG", val: team.ppg, net: false },
                      { lbl: "NET", val: team.net, net: true },
                      { lbl: "OPPG", val: team.oppg, net: false },
                    ].map(({ lbl, val, net }) => (
                      <div key={lbl} className="flex flex-col items-center py-3">
                        <p
                          className={cn(
                            "text-2xl font-black tabular-nums leading-none",
                            net && val != null
                              ? val > 0
                                ? "text-green-600 dark:text-green-400"
                                : val < 0
                                  ? "text-destructive"
                                  : "text-foreground"
                              : "text-foreground",
                          )}
                        >
                          {val != null
                            ? net
                              ? val > 0
                                ? `+${val.toFixed(1)}`
                                : val.toFixed(1)
                              : val.toFixed(1)
                            : "—"}
                        </p>
                        <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/60 mt-1">
                          {lbl}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5 border-t border-border">
                    <div>
                      <p className="text-base font-black">
                        {team.wins}–{team.losses}
                      </p>
                      <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/60 mt-0.5">
                        {es ? "Récord" : zh ? "战绩" : "Record"}
                      </p>
                    </div>
                    <div className="text-center">
                      {team.streak != null && team.streak !== 0 && (
                        <>
                          <p
                            className={cn(
                              "text-sm font-black",
                              team.streak > 0
                                ? "text-green-600 dark:text-green-400"
                                : "text-destructive",
                            )}
                          >
                            {team.streak > 0 ? `W${team.streak}` : `L${Math.abs(team.streak)}`}
                          </p>
                          <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/60 mt-0.5">
                            {es ? "Racha" : zh ? "连续" : "Streak"}
                          </p>
                        </>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex gap-1">
                        {l5.map((g, i) => (
                          <div
                            key={i}
                            className={cn(
                              "w-2 h-2 rounded-full",
                              g.result === "W" ? "bg-green-500" : "bg-destructive/60",
                            )}
                          />
                        ))}
                      </div>
                      <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/60">
                        L5
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {(team.eFGPct != null ||
                team.tovPct != null ||
                team.ftRate != null ||
                team.orbPct != null) && (
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2">
                    {L.fourFactors}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <FactorChip
                      label="eFG%"
                      val={team.eFGPct}
                      lgVal={leagueAvg?.eFGPct ?? null}
                      better
                      fmt={(v) => `${v.toFixed(1)}%`}
                    />
                    <FactorChip
                      label="TOV%"
                      val={team.tovPct}
                      lgVal={leagueAvg?.tovPct ?? null}
                      better={false}
                      fmt={(v) => `${v.toFixed(1)}%`}
                    />
                    <FactorChip
                      label="FT Rate"
                      val={team.ftRate}
                      lgVal={leagueAvg?.ftRate ?? null}
                      better
                      fmt={(v) => v.toFixed(2)}
                    />
                    <FactorChip
                      label="ORB%"
                      val={team.orbPct}
                      lgVal={leagueAvg?.orbPct ?? null}
                      better
                      fmt={(v) => `${v.toFixed(1)}%`}
                    />
                  </div>
                  {team.paceEst != null && (
                    <div className="mt-2 rounded-xl border border-border bg-muted/20 px-3 py-2 flex justify-between items-center">
                      <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground/60">
                        {es ? "Pace estimado" : zh ? "节奏" : "Pace"}
                      </p>
                      <p className="text-sm font-black tabular-nums">
                        {team.paceEst.toFixed(1)}{" "}
                        <span className="text-[9px] font-semibold text-muted-foreground">
                          {es ? "pos/pdo" : zh ? "回合/场" : "pos/g"}
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2">
                  {L.homeAway}
                </p>
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                  <div className="grid grid-cols-2 divide-x divide-border">
                    <div className="p-3">
                      <p className="text-[9px] font-black uppercase tracking-wide text-green-600 dark:text-green-400 mb-1">
                        🏠 {es ? "Casa" : zh ? "主场" : "Home"}
                      </p>
                      <p className="text-xl font-black">
                        {team.homeW != null && team.homeL != null
                          ? `${team.homeW}–${team.homeL}`
                          : "—"}
                      </p>
                    </div>
                    <div className="p-3">
                      <p className="text-[9px] font-black uppercase tracking-wide text-amber-500 mb-1">
                        ✈️ {es ? "Fuera" : zh ? "客场" : "Away"}
                      </p>
                      <p className="text-xl font-black">
                        {team.awayW != null && team.awayL != null
                          ? `${team.awayW}–${team.awayL}`
                          : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2 border-t border-border">
                    <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground/60">
                      L10
                    </p>
                    <p className="text-sm font-black">
                      {team.last10W != null && team.last10L != null
                        ? `${team.last10W}–${team.last10L}`
                        : "—"}
                    </p>
                  </div>
                </div>
              </div>

              {l5.length > 0 && (
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2">
                    {L.form}
                  </p>
                  <div className="rounded-2xl border border-border bg-card p-3">
                    <div className="flex gap-2 items-end h-10 mb-2">
                      {l5.map((g, i) => {
                        const maxM = Math.max(...l5.map((x) => Math.abs(x.margin)), 1);
                        const pct = Math.max(20, (Math.abs(g.margin) / maxM) * 100);
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1">
                            <div
                              className="w-full rounded-sm"
                              style={{
                                height: `${pct}%`,
                                background:
                                  g.result === "W"
                                    ? "rgba(16,185,129,0.55)"
                                    : "rgba(239,68,68,0.50)",
                              }}
                            />
                            <p
                              className={cn(
                                "text-[8px] font-black",
                                g.result === "W"
                                  ? "text-green-500"
                                  : "text-destructive/80",
                              )}
                            >
                              {g.result}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                    {l5Avg && (
                      <div className="flex items-center justify-between pt-2 border-t border-border">
                        <p className="text-[9px] text-muted-foreground/70">
                          {es ? "Media L5" : zh ? "近5场均值" : "L5 Avg"}
                        </p>
                        <p className="text-[11px] font-black">
                          PPG {l5Avg.pts.toFixed(1)} · OPPG {l5Avg.opp.toFixed(1)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div>
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setRosterOpen((o) => !o)}
                    className="w-full flex items-center justify-between px-4 py-3 touch-manipulation"
                  >
                    <div className="text-left">
                      <p className="text-sm font-bold">{L.showRoster}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {L.players14(activePlayers.length)}
                      </p>
                    </div>
                    <ChevronDown
                      className={cn(
                        "w-4 h-4 text-muted-foreground transition-transform",
                        rosterOpen && "rotate-180",
                      )}
                    />
                  </button>
                  {rosterOpen && activePlayers.length > 0 && (
                    <div className="border-t border-border">
                      <div className="grid grid-cols-[1.6fr_0.4fr_0.55fr_0.55fr_0.55fr] gap-0 border-b border-border bg-muted/30 px-3 py-2 text-xs font-black uppercase tracking-wider text-muted-foreground">
                        <span>{L.colPlayer}</span>
                        <span className="text-right">{L.colG}</span>
                        {(["ppg", "rpg", "apg"] as const).map((col) => (
                          <button
                            key={col}
                            type="button"
                            onClick={() => {
                              if (rosterSort === col) {
                                setRosterSortDir((d) => (d === "desc" ? "asc" : "desc"));
                              } else {
                                setRosterSort(col);
                                setRosterSortDir("desc");
                              }
                            }}
                            className={cn(
                              "text-right font-black uppercase tracking-wider text-xs touch-manipulation flex items-center justify-end gap-0.5 w-full",
                              rosterSort === col ? "text-primary" : "text-muted-foreground",
                            )}
                          >
                            {col.toUpperCase()}
                            {rosterSort === col && (
                              <span className="text-[7px]">
                                {rosterSortDir === "desc" ? "▼" : "▲"}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                      {activePlayers.map((p: TeamRosterPlayer) => {
                        const name =
                          preferEn && p.nameEn?.trim()
                            ? (toTitleCase(p.nameEn) ?? p.nameEn.trim())
                            : p.nameZh;
                        return (
                          <button
                            key={p.externalId}
                            type="button"
                            onClick={() => onPlayerTap(p.externalId)}
                            className="w-full grid grid-cols-[1.6fr_0.4fr_0.55fr_0.55fr_0.55fr] gap-0 items-center px-3 py-2.5 border-b border-border last:border-b-0 text-xs text-left touch-manipulation hover:bg-muted/30 active:bg-muted/45 transition-colors"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-extrabold text-foreground truncate">
                                {name}
                              </p>
                              {p.jerseyNumber != null && p.jerseyNumber !== "" && (
                                <p className="text-xs text-muted-foreground/60 font-semibold">
                                  #{p.jerseyNumber}
                                </p>
                              )}
                            </div>
                            <p className="text-xs font-black text-foreground tabular-nums text-right">
                              {p.games}
                            </p>
                            <p className="text-xs font-black text-foreground tabular-nums text-right">
                              {p.ppg.toFixed(1)}
                            </p>
                            <p className="text-xs font-black text-foreground tabular-nums text-right">
                              {p.rpg.toFixed(1)}
                            </p>
                            <p className="text-xs font-black text-foreground tabular-nums text-right">
                              {p.apg.toFixed(1)}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "avanzado" && (
            <div className="px-4 py-4 space-y-4">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2">
                  {L.perPossession}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { lbl: "ORTG", val: team.ortg, lgVal: null as number | null, better: true, fmt: (v: number) => v.toFixed(1) },
                    { lbl: "DRTG", val: team.drtg, lgVal: null as number | null, better: false, fmt: (v: number) => v.toFixed(1) },
                    { lbl: "NET RTG", val: team.netRtg, lgVal: null as number | null, better: true, fmt: (v: number) => (v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1)) },
                    { lbl: "PACE", val: team.paceEst, lgVal: null as number | null, better: true, fmt: (v: number) => v.toFixed(1) },
                    { lbl: "PPP Of.", val: team.pppOf, lgVal: null as number | null, better: true, fmt: (v: number) => v.toFixed(2) },
                    { lbl: "PPP Def.", val: team.pppDef, lgVal: null as number | null, better: false, fmt: (v: number) => v.toFixed(2) },
                  ].map(({ lbl, val, lgVal, better, fmt }) => {
                    const isGood =
                      val != null && lgVal != null ? (better ? val > lgVal : val < lgVal) : null;
                    const col =
                      isGood === true
                        ? "text-green-600 dark:text-green-400"
                        : isGood === false
                          ? "text-destructive"
                          : "text-foreground";
                    return (
                      <div
                        key={lbl}
                        className="rounded-xl border border-border bg-muted/20 p-2.5 text-center"
                      >
                        <p className={cn("text-xl font-black tabular-nums leading-none", col)}>
                          {val != null ? fmt(val as number) : "—"}
                        </p>
                        <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/60 mt-1">
                          {lbl}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2">
                  {L.reboundsLabel}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <FactorChip
                    label="OReb%"
                    val={team.orbPct}
                    lgVal={leagueAvg?.orbPct ?? null}
                    better
                    fmt={(v) => `${v.toFixed(1)}%`}
                  />
                  <FactorChip
                    label="DReb%"
                    val={team.drbPct}
                    lgVal={null}
                    better
                    fmt={(v) => `${v.toFixed(1)}%`}
                  />
                  <FactorChip
                    label="eFG%"
                    val={team.eFGPct}
                    lgVal={leagueAvg?.eFGPct ?? null}
                    better
                    fmt={(v) => `${v.toFixed(1)}%`}
                  />
                  <FactorChip
                    label="TOV%"
                    val={team.tovPct}
                    lgVal={leagueAvg?.tovPct ?? null}
                    better={false}
                    fmt={(v) => `${v.toFixed(1)}%`}
                  />
                </div>
              </div>

              {pointsByZone && (
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2">
                    {L.pointsZone}
                  </p>
                  <div className="rounded-2xl border border-border bg-card p-3">
                    <div className="flex items-center gap-4">
                      <svg viewBox="0 0 80 80" width="72" height="72" className="shrink-0">
                        <circle
                          cx="40"
                          cy="40"
                          r="28"
                          fill="none"
                          stroke="hsl(var(--border))"
                          strokeWidth="12"
                        />
                        {(() => {
                          const circ = 2 * Math.PI * 28;
                          const segs = [
                            { key: "paint", color: "#10B981", val: pointsByZone.paint },
                            { key: "fg3", color: "#3A81FE", val: pointsByZone.fg3 },
                            { key: "mid", color: "#F5A623", val: pointsByZone.mid },
                            { key: "ft", color: "#a78bfa", val: pointsByZone.ft },
                          ];
                          let offset = circ * 0.25;
                          return segs.map(({ key, color, val }) => {
                            const dash = circ * val;
                            const el = (
                              <circle
                                key={key}
                                cx="40"
                                cy="40"
                                r="28"
                                fill="none"
                                stroke={color}
                                strokeWidth="12"
                                strokeDasharray={`${dash} ${circ - dash}`}
                                strokeDashoffset={offset}
                                transform="rotate(-90 40 40)"
                              />
                            );
                            offset -= dash;
                            return el;
                          });
                        })()}
                      </svg>
                      <div className="flex flex-col gap-1.5 flex-1">
                        {[
                          { lbl: es ? "Paint" : zh ? "油漆区" : "Paint", color: "bg-emerald-500", val: pointsByZone.paint },
                          { lbl: "3PT", color: "bg-blue-500", val: pointsByZone.fg3 },
                          { lbl: es ? "Mid-range" : zh ? "中距离" : "Mid", color: "bg-amber-500", val: pointsByZone.mid },
                          { lbl: es ? "TL" : zh ? "罚球" : "FT", color: "bg-purple-400", val: pointsByZone.ft },
                        ].map(({ lbl, color, val }) => (
                          <div key={lbl} className="flex items-center gap-2 text-xs">
                            <div className={cn("w-2 h-2 rounded-full shrink-0", color)} />
                            <span className="text-muted-foreground flex-1">{lbl}</span>
                            <span className="font-black">{(val * 100).toFixed(0)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2">
                  {L.lineups}
                </p>
                <div className="rounded-2xl border border-dashed border-border bg-muted/10 px-4 py-6 text-center">
                  <p className="text-xs font-bold text-muted-foreground/60">
                    📡 {L.piPending}
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "partidos" && (
            <div className="px-4 py-4">
              {teamGameLog.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border px-6 py-10 text-center">
                  <p className="text-sm font-bold text-muted-foreground">{L.noData}</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                  {teamGameLog.map((g, i) => (
                    <div
                      key={g.gameId}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5",
                        i < teamGameLog.length - 1 && "border-b border-border/50",
                      )}
                    >
                      <p className="text-[10px] text-muted-foreground/70 w-10 shrink-0 tabular-nums">
                        {g.date.slice(5, 10)}
                      </p>
                      <div
                        className={cn(
                          "w-[22px] h-[22px] rounded-md flex items-center justify-center text-[10px] font-black shrink-0",
                          g.result === "W"
                            ? "bg-green-500/15 text-green-600 dark:text-green-400"
                            : "bg-destructive/12 text-destructive",
                        )}
                      >
                        {g.result}
                      </div>
                      <p className="flex-1 text-[11px] font-bold truncate text-foreground">
                        {g.isHome
                          ? es
                            ? "vs"
                            : zh
                              ? "主"
                              : "vs"
                          : es
                            ? "en"
                            : zh
                              ? "客"
                              : "@"}{" "}
                        {pickName(g.opponentName, g.opponentNameEn, locale)}
                      </p>
                      <p className="text-[11px] font-black tabular-nums text-foreground">
                        {g.teamScore}–{g.oppScore}
                      </p>
                      <p
                        className={cn(
                          "text-[10px] font-black tabular-nums w-8 text-right shrink-0",
                          g.margin > 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-destructive",
                        )}
                      >
                        {g.margin > 0 ? `+${g.margin}` : g.margin}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
