import { useEffect, useMemo, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, ChevronDown, ChevronLeft, ChevronRight, Trophy, Users, Users2 } from "lucide-react";
import { useSearch, useLocation } from "wouter";
import { ModulePageShell } from "./ModulePage";
import { LandscapeHint, useIsLandscape } from "@/components/LandscapeHint";
import { StatsRadar } from "@/components/StatsRadar";
import { useLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { queryClient, apiRequest } from "@/lib/queryClient";
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
  useGameBoxscore,
  usePaceSegments,
  useTeamLineups,
  usePlayerOnOff,
  toTitleCase,
  type PlayerSeasonStats,
  type LineupRow,
  type LeaderRow,
  type StandingsRow,
  type GameLogEntry,
  type TeamDetail,
  type TeamRosterPlayer,
  type TeamGameLogEntry,
  type StatsPhaseType,
} from "@/lib/stats-api";

type MainTab = "liga" | "jugadoras";
type LigaSegment = "clasificacion" | "lideres";
type JugadorasSort = "ppg" | "rpg" | "apg";
type LeaderStatKey = "ppg" | "rpg" | "apg" | "spg" | "bpg" | "fgPct" | "tsPct" | "topg";
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
    case "tsPct":
      return "TS%";
    case "topg":
      return "TOPG";
    default:
      return key;
  }
}

function formatLeaderValue(stat: string, value: unknown): string {
  if (value == null || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  if (stat === "fgPct" || stat === "tsPct") return `${n.toFixed(1)}%`;
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

const WCBA_TEAM_EN: Record<string, string> = {
  "山西": "Shanxi",
  "广东": "Guangdong",
  "内蒙古": "Inner Mongolia",
  "四川": "Sichuan",
  "新疆": "Xinjiang",
  "山东": "Shandong",
  "上海": "Shanghai",
  "江苏": "Jiangsu",
  "武汉": "Wuhan",
  "石家庄": "Shijiazhuang",
  "北京": "Beijing",
  "陕西": "Shaanxi",
  "浙江": "Zhejiang",
  "合肥": "Hefei",
  "河南": "Henan",
  "福建": "Fujian",
  "辽宁": "Liaoning",
  "天津": "Tianjin",
};

function pickName(nameZh: string | null | undefined, nameEn: string | null | undefined, locale: string): string {
  if (locale === "zh") return nameZh ?? nameEn ?? "";
  if (nameEn?.trim()) return nameEn.trim();
  // Fallback: match Chinese name against known WCBA teams
  if (nameZh) {
    for (const [zh, en] of Object.entries(WCBA_TEAM_EN)) {
      if (nameZh.includes(zh)) return en;
    }
  }
  return nameZh ?? "";
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

/** Lineup label: last token of each player name (fits mobile). */
function lineupShortNames(names: string[], locale: string): string {
  return names
    .map((n) => {
      const t = n.trim();
      if (/^\d+$/.test(t)) return `#${t.slice(-4)}`;
      if (locale === "zh") return t.slice(0, 2);
      const parts = t.split(/\s+/).filter(Boolean);
      return parts.length > 1 ? parts[parts.length - 1]! : (parts[0] ?? t);
    })
    .join(" / ");
}

function lineupTotalPoss(row: LineupRow): number {
  return row.offPossessions + row.defPossessions;
}

function fmtLineupRtg(ppp: number | null): string {
  return ppp != null ? (ppp * 100).toFixed(1) : "—";
}

const OWN_TEAM_NAME_FALLBACK = "Inner Mongolia";

function PhaseToggle({
  phaseType,
  onChange,
  locale,
}: {
  phaseType: StatsPhaseType;
  onChange: (p: StatsPhaseType) => void;
  locale: string;
}) {
  const es = locale === "es";
  const zh = locale === "zh";
  return (
    <div className="flex rounded-md overflow-hidden border border-border text-xs">
      {(["regular", "playoff", "all"] as StatsPhaseType[]).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={
            phaseType === v
              ? "bg-primary text-primary-foreground px-2.5 py-1 font-semibold"
              : "px-2.5 py-1 text-muted-foreground hover:bg-muted transition-colors"
          }
        >
          {v === "regular"
            ? es
              ? "Liga"
              : zh
                ? "常规"
                : "Regular"
            : v === "playoff"
              ? es
                ? "Playoff"
                : zh
                  ? "季后"
                  : "Playoff"
              : es
                ? "Todo"
                : zh
                  ? "全部"
                  : "All"}
        </button>
      ))}
    </div>
  );
}

function CompactRosterList({
  players,
  activePlayerId,
  locale,
  onTap,
}: {
  players: TeamRosterPlayer[];
  activePlayerId: string | null;
  locale: string;
  onTap: (id: string) => void;
}) {
  const es = locale === "es";
  const zh = locale === "zh";
  const rows = players.filter((p) => p.games > 0 && (p.nameEn?.trim() || p.nameZh?.trim()));
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="grid grid-cols-[0.45fr_1.4fr_0.55fr_0.55fr] gap-0 border-b border-border bg-muted/30 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
        <span className="text-center">#</span>
        <span>{es ? "Jugadora" : zh ? "球员" : "Player"}</span>
        <span className="text-right">PPG</span>
        <span className="text-right">RPG</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-3 py-8 text-center text-sm font-bold text-muted-foreground">
          {es ? "Sin datos" : zh ? "暂无数据" : "No data"}
        </p>
      ) : (
        rows.map((p) => {
          const name = pickName(p.nameZh, p.nameEn, locale) || "—";
          const isActive = activePlayerId === p.externalId;
          return (
            <button
              key={p.externalId}
              type="button"
              onClick={() => onTap(p.externalId)}
              className={cn(
                "w-full grid grid-cols-[0.45fr_1.4fr_0.55fr_0.55fr] gap-0 items-center px-3 py-2 border-b border-border last:border-b-0 text-left text-xs touch-manipulation transition-colors",
                isActive ? "bg-primary/12 hover:bg-primary/15" : "hover:bg-muted/30",
              )}
            >
              <p className="text-center font-black tabular-nums text-muted-foreground">
                {p.jerseyNumber != null && p.jerseyNumber !== "" ? String(p.jerseyNumber) : "—"}
              </p>
              <p className="font-extrabold text-foreground truncate">{name}</p>
              <p className="text-right font-black tabular-nums text-foreground">{num(p.ppg).toFixed(1)}</p>
              <p className="text-right font-black tabular-nums text-foreground">{num(p.rpg).toFixed(1)}</p>
            </button>
          );
        })
      )}
    </div>
  );
}

export default function Stats() {
  const { t, locale } = useLocale();
  const es = locale === "es";
  const zh = locale === "zh";
  const preferEnLeaderName = locale === "en" || locale === "es";
  const isDesktop = useIsDesktop();
  const { profile } = useAuth();
  const caps = useCapabilities();
  const canUsePlayerUX = caps.canUsePlayerUX;
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

  const LEADER_STAT_KEYS: LeaderStatKey[] = ["ppg", "rpg", "apg", "spg", "bpg", "fgPct", "tsPct", "topg"];

  const [mainTab, setMainTab] = useState<MainTab>(() => {
    const fromUrl = parseMainTab(search);
    const raw = search.startsWith("?") ? search.slice(1) : search;
    if (new URLSearchParams(raw).has("tab")) return fromUrl;
    return canUsePlayerUX ? "jugadoras" : "liga";
  });
  const [ligaSegment, setLigaSegment] = useState<LigaSegment>("clasificacion");
  const [showCoachDash, setShowCoachDash] = useState(!canUsePlayerUX);
  const [leaderStat, setLeaderStat] = useState<LeaderStatKey>("ppg");
  const [jugadorasSort, setJugadorasSort] = useState<JugadorasSort>("ppg");
  const [jugadorasSortDir, setJugadorasSortDir] = useState<"asc" | "desc">("desc");
  const [jugadorasSearch, setJugadorasSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Filtro rápido de posición
  const [jugadorasPos, setJugadorasPos] = useState<string>("");

  // Filtros avanzados
  const [advFilterOpen, setAdvFilterOpen] = useState(false);
  const [advMinGames, setAdvMinGames] = useState<string>("");
  const [advMinPpg, setAdvMinPpg] = useState<string>("");
  const [advMinRpg, setAdvMinRpg] = useState<string>("");
  const [advMinApg, setAdvMinApg] = useState<string>("");
  const [advMinMpg, setAdvMinMpg] = useState<string>("");

  const hasAdvFilter =
    advMinGames !== "" || advMinPpg !== "" || advMinRpg !== "" || advMinApg !== "" || advMinMpg !== "";

  const clearAllFilters = () => {
    setJugadorasPos("");
    setJugadorasSearch("");
    setAdvMinGames("");
    setAdvMinPpg("");
    setAdvMinRpg("");
    setAdvMinApg("");
    setAdvMinMpg("");
  };
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
  const [returnToPlayerId, setReturnToPlayerId] = useState<string | null>(null);
  const [seasonSheetOpen, setSeasonSheetOpen] = useState(false);
  const [seasonId, setSeasonId] = useState<number | null>(() => {
    const s = localStorage.getItem("stats_seasonId");
    return s ? Number(s) : null;
  });
  const [phaseType, setPhaseType] = useState<StatsPhaseType>(() => {
    const stored = localStorage.getItem("stats-phase-type");
    if (stored === "playoff" || stored === "all") return stored;
    return "regular";
  });

  useEffect(() => {
    localStorage.setItem("stats-phase-type", phaseType);
  }, [phaseType]);

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
  }, [
    jugadorasSort,
    jugadorasSearch,
    jugadorasPos,
    advMinGames,
    advMinPpg,
    advMinRpg,
    advMinApg,
    advMinMpg,
  ]);

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

  const playersQ = usePlayerSeasonStats(phaseType);
  const playersRaw = playersQ.data?.players ?? [];

  const standingsQ = useStandings(effectiveSeasonId, phaseType);
  const leadersQ = useLeaders(effectiveSeasonId, leaderStat, phaseType);

  const seasonMetaLabel = seasons.find((s) => s.seasonId === effectiveSeasonId)?.label;
  const playersForSeason = useMemo(() => {
    if (!seasonMetaLabel) return playersRaw;
    const filtered = playersRaw.filter((p) => p.season === seasonMetaLabel);
    return filtered.length > 0 ? filtered : playersRaw;
  }, [playersRaw, seasonMetaLabel]);

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

    if (jugadorasPos) {
      list = list.filter((p) => {
        const pos = p.position ?? "";
        if (jugadorasPos === "guard") return ["后卫", "控球后卫", "得分后卫"].includes(pos);
        if (jugadorasPos === "forward") return ["前锋", "小前锋", "大前锋"].includes(pos);
        if (jugadorasPos === "center") return pos === "中锋";
        return true;
      });
    }

    const minG = advMinGames !== "" ? Number(advMinGames) : null;
    const minPpg = advMinPpg !== "" ? Number(advMinPpg) : null;
    const minRpg = advMinRpg !== "" ? Number(advMinRpg) : null;
    const minApg = advMinApg !== "" ? Number(advMinApg) : null;
    const minMpg = advMinMpg !== "" ? Number(advMinMpg) : null;
    if (minG != null) list = list.filter((p) => p.games >= minG!);
    if (minPpg != null) list = list.filter((p) => p.ppg >= minPpg!);
    if (minRpg != null) list = list.filter((p) => p.rpg >= minRpg!);
    if (minApg != null) list = list.filter((p) => p.apg >= minApg!);
    if (minMpg != null) list = list.filter((p) => p.mpg >= minMpg!);

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
  }, [
    playersForSeason,
    jugadorasSort,
    debouncedSearch,
    jugadorasSortDir,
    jugadorasPos,
    advMinGames,
    advMinPpg,
    advMinRpg,
    advMinApg,
    advMinMpg,
  ]);

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
    // TODO: use profile.teamName / profile.teamNameEn when UserProfile exposes club team fields
    const profileTeam =
      (profile as { teamNameEn?: string | null; teamName?: string | null })?.teamNameEn?.trim() ||
      (profile as { teamNameEn?: string | null; teamName?: string | null })?.teamName?.trim() ||
      "";
    const ownTeamName = profileTeam || OWN_TEAM_NAME_FALLBACK;
    const own =
      standingsRows.find(
        (r) =>
          (r.teamName ?? "").toLowerCase().includes(ownTeamName.toLowerCase()) ||
          (r.teamNameEn ?? "").toLowerCase().includes(ownTeamName.toLowerCase()),
      ) ?? null;
    return own;
  }, [standingsRows, profile]);

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
    const prevPlayerId = returnToPlayerId;
    const prevTeamId = returnToTeamId;
    setPlayerSheetId(null);
    const raw2 = search.startsWith("?") ? search.slice(1) : search;
    const qs2 = new URLSearchParams(raw2);
    qs2.delete("player");
    const newSearch = qs2.toString();
    setLocation(newSearch ? `/stats?${newSearch}` : "/stats");
    if (prevTeamId) {
      setTeamSheetId(prevTeamId);
      setReturnToTeamId(null);
      // Clear returnToPlayerId after TeamSheet has had time to mount and scroll
      setTimeout(() => setReturnToPlayerId(null), 600);
    } else {
      setReturnToPlayerId(null);
    }
  };

  // Level 3: player opened from team roster — show minimal standings
  const isLevel3 = isDesktop && Boolean(playerSheetId && returnToTeamId);

  const centerView = useMemo((): "default" | "standings" | "roster" | "playerList" => {
    if (!isDesktop) return "default";
    if (playerSheetId && returnToTeamId) return "roster";
    if (playerSheetId && !returnToTeamId) return "playerList";
    if (teamSheetId) return "standings";
    return "default";
  }, [isDesktop, playerSheetId, returnToTeamId, teamSheetId]);

  const rosterCenterQ = useTeamDetail(
    centerView === "roster" ? returnToTeamId : null,
    effectiveSeasonId,
    phaseType,
  );
  const rosterCenterTeam = rosterCenterQ.data?.team;
  const rosterCenterPlayers = rosterCenterQ.data?.players ?? [];

  useEffect(() => {
    if (centerView === "standings") setLigaSegment("clasificacion");
  }, [centerView]);

  const desktopPanel = isDesktop ? (
    <StatsDesktopPanel
      playerSheetId={playerSheetId}
      teamSheetId={teamSheetId}
      seasonId={effectiveSeasonId}
      phaseType={phaseType}
      onPhaseChange={setPhaseType}
      locale={locale}
      returnToTeamId={returnToTeamId}
      returnToPlayerId={returnToPlayerId}
      onClosePlayer={closePlayerSheet}
      onCloseTeam={() => setTeamSheetId(null)}
      onTeamTapFromPlayer={(teamId) => {
        setPlayerSheetId(null);
        setReturnToTeamId(null);
        setTeamSheetId(teamId);
      }}
      onPlayerTapFromTeam={(id) => {
        setReturnToPlayerId(id);
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
      panelMax={isDesktop && Boolean(playerSheetId && returnToTeamId)}
      panelLabel={isDesktop ? (locale === "zh" ? "详情" : locale === "es" ? "DETALLE" : "DETAIL") : undefined}
    >
      <>
      <div className="w-full max-w-5xl mx-auto px-4 md:px-8 flex justify-end items-center gap-2 pt-1 pb-2 shrink-0">
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

      <div className={`px-4 md:px-8 pb-10 mx-auto w-full ${
        isDesktop && playerSheetId && returnToTeamId ? 'max-w-sm'
        : isDesktop && (playerSheetId || teamSheetId) ? 'max-w-2xl'
        : 'max-w-5xl'
      }`}>
        {playersWithGamesForSeason.length === 0 && standingsRows.length === 0 && (
          <div className="mt-3 mb-1 rounded-xl border border-border bg-muted/40 px-4 py-3 flex items-center gap-3">
            <BarChart3 className="w-5 h-5 text-primary/60 shrink-0" />
            <div>
              <p className="text-xs font-bold text-foreground">{locale === "es" ? "Datos WCBA en integración" : locale === "zh" ? "WCBA数据集成中" : "Live WCBA data coming soon"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{locale === "es" ? "Los datos en tiempo real llegarán en breve." : locale === "zh" ? "实时数据即将接入。" : "Real-time stats will appear here automatically."}</p>
            </div>
          </div>
        )}

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

        {centerView === "roster" ? (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setPlayerSheetId(null);
                  setReturnToPlayerId(null);
                  if (returnToTeamId) setTeamSheetId(returnToTeamId);
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted/40"
              >
                <ChevronLeft className="w-4 h-4" />
                {es ? "Equipo" : zh ? "球队" : "Team"}
              </button>
              <p className="text-sm font-black text-foreground truncate flex-1">
                {pickName(rosterCenterTeam?.nameZh, rosterCenterTeam?.nameEn, locale) || "—"}
              </p>
              <PhaseToggle phaseType={phaseType} onChange={setPhaseType} locale={locale} />
            </div>
            {rosterCenterQ.isLoading ? (
              <div className="flex justify-center py-16">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <CompactRosterList
                players={rosterCenterPlayers}
                activePlayerId={playerSheetId}
                locale={locale}
                onTap={(id) => {
                  setReturnToPlayerId(id);
                  setPlayerSheetId(id);
                }}
              />
            )}
          </div>
        ) : (
        <Tabs
          value={centerView === "playerList" ? "jugadoras" : centerView === "standings" ? "liga" : mainTab}
          onValueChange={(v) => {
            if (centerView === "default") setTabAndLocation(v as MainTab);
          }}
          className="w-full"
        >
          {centerView === "default" && (
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
          )}

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

          <TabsContent
            value="liga"
            className={cn("mt-4 space-y-3", showGlobalSpinner && "hidden", centerView === "playerList" && "hidden")}
          >
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
                  {rivalStanding?.teamExternalId ? (
                    <button
                      type="button"
                      onClick={() => setTeamSheetId(String(rivalStanding.teamExternalId))}
                      className="text-lg font-black text-foreground text-left hover:text-primary transition-colors"
                    >
                      {nextMatch.rivalName}
                    </button>
                  ) : (
                    <p className="text-lg font-black text-foreground">{nextMatch.rivalName}</p>
                  )}
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
                  {rivalStanding?.teamExternalId && (
                    <button
                      type="button"
                      onClick={() => setTeamSheetId(String(rivalStanding.teamExternalId))}
                      className="text-[11px] font-bold text-primary mt-2 hover:underline"
                    >
                      {es ? "Ver análisis completo →" : zh ? "查看完整分析 →" : "View full analysis →"}
                    </button>
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

            {centerView === "default" && (
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
            )}

            {!standingsQ.isLoading && !standingsQ.isError && (ligaSegment === "clasificacion" || centerView === "standings") && (
              <>
                {standingsRows.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center text-sm font-bold text-muted-foreground">
                    {L.standingsEmpty}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-border bg-card overflow-hidden">
                    <div className={cn(
                      "gap-1 border-b border-border bg-muted/30 px-2 py-2 text-xs font-black uppercase tracking-wider text-muted-foreground",
                      isLevel3
                        ? "grid grid-cols-[0.3fr_1fr_0.5fr]"
                        : "grid grid-cols-[0.3fr_1fr_0.5fr_0.35fr_0.35fr_0.4fr_auto]"
                    )}>
                      <span className="text-center">{L.colRank}</span>
                      <span>{L.colTeam}</span>
                      <span className="text-right">{L.colWL}</span>
                      {!isLevel3 && <span className="text-right">{L.colPPG}</span>}
                      {!isLevel3 && <span className="text-right">{L.colOPPG}</span>}
                      {!isLevel3 && <span className="text-right">{L.colNET}</span>}
                      {!isLevel3 && <span className="text-right">eFG%</span>}
                    </div>
                    {standingsGroups.groups.map((group, gi) => (
                      <div key={`${group.label ?? "default"}-${gi}`}>
                        {standingsGroups.showHeaders && (
                          <p className="px-2 py-1.5 text-xs font-black uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/15">
                            {group.label
                              ? (locale !== "zh" && (locale as string) !== "zh-CN"
                                  ? (group.label.includes("A组") ? "Group A" : group.label.includes("B组") ? "Group B" : group.label.includes("季后赛") ? "Playoffs" : group.label.includes("常规赛") ? "Regular season" : group.label)
                                  : group.label)
                              : "—"}
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
                            onMouseEnter={() => {
                              const id = String(row.teamExternalId);
                              queryClient.prefetchQuery({
                                queryKey: ["stats-team-detail", id, effectiveSeasonId ?? 2092, phaseType],
                                queryFn: () =>
                                  apiRequest(
                                    "GET",
                                    `/api/stats/team/${id}?seasonId=${effectiveSeasonId ?? 2092}&phaseType=${phaseType}`,
                                  ).then((r) => r.json()),
                                staleTime: 1000 * 60 * 30,
                              });
                            }}
                            onClick={() => {
                              setPlayerSheetId(null);
                              setReturnToTeamId(null);
                              setTeamSheetId(String(row.teamExternalId));
                            }}
                            className={cn(
                              "w-full gap-1 items-center px-2 py-2 border-b border-border last:border-b-0 text-xs text-left touch-manipulation hover:bg-muted/25 active:bg-muted/40 active:opacity-90 transition-colors",
                              isLevel3
                                ? "grid grid-cols-[0.3fr_1fr_0.5fr]"
                                : "grid grid-cols-[0.3fr_1fr_0.5fr_0.35fr_0.35fr_0.4fr_auto]"
                            )}
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
                            {!isLevel3 && <p className="text-right font-black tabular-nums">{row.ppg != null ? num(row.ppg).toFixed(1) : "—"}</p>}
                            {!isLevel3 && <p className="text-right font-black tabular-nums">{row.oppg != null ? num(row.oppg).toFixed(1) : "—"}</p>}
                            {!isLevel3 && <p className={cn(
                              "text-right font-black tabular-nums",
                              netNum == null ? "text-muted-foreground" : netNum > 0 ? "text-green-600 dark:text-green-400" : netNum < 0 ? "text-destructive" : "text-muted-foreground"
                            )}>{netStr}</p>}
                            {!isLevel3 && <p className="text-right font-black tabular-nums text-xs">
                              {row.eFGPct != null ? `${num(row.eFGPct).toFixed(1)}` : "—"}
                            </p>}
                          </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {!leadersQ.isLoading && !leadersQ.isError && ligaSegment === "lideres" && centerView === "default" && (
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
                    <p className="text-xs text-muted-foreground px-0.5 -mt-1">
                      {"Top 10 · " + leaderStatLabel(leaderStat, L)}
                    </p>
                  <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
                    {leadersRows.slice(0, 10).map((row: LeaderRow, idx: number) => (
                      <button
                        key={row.externalId}
                        type="button"
                        onMouseEnter={() => {
                          const id = String(row.externalId);
                          queryClient.prefetchQuery({
                            queryKey: ["stats-player-detail", id, effectiveSeasonId, phaseType],
                            queryFn: () =>
                              apiRequest(
                                "GET",
                                `/api/stats/player/${id}?seasonId=${effectiveSeasonId}&phaseType=${phaseType}`,
                              ).then((r) => r.json()),
                            staleTime: 1000 * 60 * 30,
                          });
                        }}
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

            {!playersQ.isLoading && !playersQ.isError && playersWithGamesForSeason.length > 0 && (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {es ? "Jugadoras" : zh ? "球员" : "Players"}
                  </span>
                  <PhaseToggle phaseType={phaseType} onChange={setPhaseType} locale={locale} />
                </div>
                <div className="flex rounded-xl border border-border bg-muted/20 p-0.5 gap-0.5">
                  {(
                    [
                      ["", es ? "Todas" : zh ? "全部" : "All"],
                      ["guard", es ? "Bases" : zh ? "后卫" : "Guards"],
                      ["forward", es ? "Aleros" : zh ? "前锋" : "Forwards"],
                      ["center", es ? "Pivots" : zh ? "中锋" : "Centers"],
                    ] as [string, string][]
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setJugadorasPos(val)}
                      className={cn(
                        "flex-1 rounded-lg py-1.5 text-[11px] font-black transition-colors",
                        jugadorasPos === val
                          ? "bg-card shadow-sm text-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={es ? "Buscar jugadora..." : zh ? "搜索球员..." : "Search player..."}
                    value={jugadorasSearch}
                    onChange={(e) => setJugadorasSearch(e.target.value)}
                    className="flex-1 h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/50"
                  />
                  <button
                    type="button"
                    onClick={() => setAdvFilterOpen(true)}
                    className={cn(
                      "h-10 px-3 rounded-xl border text-xs font-black transition-colors shrink-0 flex items-center gap-1.5",
                      hasAdvFilter
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/40",
                    )}
                  >
                    {hasAdvFilter && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                    {es ? "Filtros" : zh ? "筛选" : "Filters"}
                  </button>
                  {(jugadorasPos || jugadorasSearch.trim() || hasAdvFilter) && (
                    <button
                      type="button"
                      onClick={clearAllFilters}
                      className="h-10 px-3 rounded-xl border border-border bg-card text-xs font-black text-muted-foreground hover:text-foreground hover:bg-muted/40 shrink-0"
                    >
                      {es ? "Limpiar" : zh ? "清除" : "Clear"}
                    </button>
                  )}
                </div>

                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                  <div className="grid grid-cols-[2fr_0.5fr_0.7fr_0.7fr_0.7fr] gap-0 border-b border-border bg-muted/30 px-3 py-2 text-xs font-black uppercase tracking-wider text-muted-foreground">
                    <span className="text-left">{L.colPlayer}</span>
                    <span className="text-right text-[11px]">{L.colG}</span>
                    {(["ppg", "rpg", "apg"] as const).map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => handleJugadorasSortClick(k)}
                        className={cn(
                          "text-right font-black uppercase tracking-wider text-[11px] touch-manipulation flex items-center justify-end gap-0.5 w-full",
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
                        onMouseEnter={() => {
                          queryClient.prefetchQuery({
                            queryKey: ["stats-player-detail", p.externalId, effectiveSeasonId, phaseType],
                            queryFn: () =>
                              apiRequest(
                                "GET",
                                `/api/stats/player/${p.externalId}?seasonId=${effectiveSeasonId}&phaseType=${phaseType}`,
                              ).then((r) => r.json()),
                            staleTime: 1000 * 60 * 30,
                          });
                        }}
                        onClick={() => setPlayerSheetId(p.externalId)}
                        className={cn(
                          "w-full px-3 py-3 grid grid-cols-[2fr_0.5fr_0.7fr_0.7fr_0.7fr] items-center gap-0 text-left touch-manipulation hover:bg-muted/30 active:bg-muted/45 active:opacity-90 transition-colors border-b border-border last:border-b-0",
                          isDesktop && playerSheetId === p.externalId && "bg-primary/10 ring-1 ring-inset ring-primary/25",
                        )}
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
                        <p className="text-[11px] font-black text-foreground tabular-nums text-right">{p.games}</p>
                        <p className="text-[11px] font-black text-foreground tabular-nums text-right">{num(p.ppg).toFixed(1)}</p>
                        <p className="text-[11px] font-black text-foreground tabular-nums text-right">{num(p.rpg).toFixed(1)}</p>
                        <p className="text-[11px] font-black text-foreground tabular-nums text-right">{num(p.apg).toFixed(1)}</p>
                      </button>
                    );
                  })}
                </div>
                {jugadorasFiltered.length > jugadorasLimit && (
                  <div ref={sentinelRef} className="h-8 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
                  </div>
                )}

                {/* Estado vacío por filtro activo — no bloqueante */}
                {jugadorasFiltered.length === 0 && (jugadorasPos || jugadorasSearch.trim() || hasAdvFilter) && (
                  <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-8 text-center space-y-2">
                    <p className="text-sm font-bold text-muted-foreground">
                      {es ? "Sin resultados con estos filtros" : zh ? "筛选无结果" : "No results for these filters"}
                    </p>
                    <button
                      type="button"
                      onClick={clearAllFilters}
                      className="text-xs font-black text-primary hover:underline"
                    >
                      {es ? "Limpiar filtros" : zh ? "清除筛选" : "Clear filters"}
                    </button>
                  </div>
                )}
              </>
            )}
          </TabsContent>

        </Tabs>
        )}
      </div>

      <Sheet
        modal
        open={!isDesktop && Boolean(playerSheetId)}
        onOpenChange={(open) => {
          if (!open) closePlayerSheet();
        }}
      >
        <SheetContent hideClose side="bottom" className="h-[92svh] rounded-t-2xl p-0 flex flex-col max-w-lg mx-auto w-full pb-[env(safe-area-inset-bottom)]" style={{ zIndex: 95 }}>
          <StatsPlayerSheet
            externalId={playerSheetId}
            seasonId={effectiveSeasonId}
            phaseType={phaseType}
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
        modal
        open={!isDesktop && Boolean(teamSheetId)}
        onOpenChange={(open) => {
          if (!open) setTeamSheetId(null);
        }}
      >
        <SheetContent hideClose side="bottom" className="h-[92svh] rounded-t-2xl p-0 flex flex-col max-w-lg mx-auto w-full pb-[env(safe-area-inset-bottom)]" style={{ zIndex: 95 }}>
          <StatsTeamSheet
            externalId={teamSheetId}
            seasonId={effectiveSeasonId}
            phaseType={phaseType}
            onPhaseChange={setPhaseType}
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

      {/* Advanced filter — floating modal that respects the sidebar */}
      {advFilterOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
            onClick={() => setAdvFilterOpen(false)}
          />
          <div className="fixed z-50 bottom-4 left-4 right-4 md:left-64 mx-auto max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 pt-4 pb-2 flex items-center justify-between border-b border-border/50">
              <p className="text-sm font-black uppercase tracking-wider">
                {es ? 'Filtros avanzados' : zh ? '高级筛选' : 'Advanced filters'}
              </p>
              <button type="button" onClick={() => setAdvFilterOpen(false)} className="p-1 rounded-lg text-muted-foreground hover:text-foreground">
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 pb-5 pt-3 space-y-4 max-h-[55dvh] overflow-y-auto">
            {(
              [
                {
                  key: "advMinGames",
                  label: es ? "Partidos mínimos" : zh ? "最少场次" : "Min. games",
                  state: advMinGames,
                  set: setAdvMinGames,
                  placeholder: es ? "ej. 10" : zh ? "例：10" : "e.g. 10",
                  step: "1",
                },
                { key: "advMinPpg", label: es ? "PPG mínimo" : zh ? "最低得分" : "Min. PPG", state: advMinPpg, set: setAdvMinPpg, placeholder: es ? "ej. 8.0" : zh ? "例：8.0" : "e.g. 8.0", step: "0.5" },
                { key: "advMinRpg", label: es ? "RPG mínimo" : zh ? "最低篮板" : "Min. RPG", state: advMinRpg, set: setAdvMinRpg, placeholder: es ? "ej. 4.0" : zh ? "例：4.0" : "e.g. 4.0", step: "0.5" },
                { key: "advMinApg", label: es ? "APG mínimo" : zh ? "最低助攻" : "Min. APG", state: advMinApg, set: setAdvMinApg, placeholder: es ? "ej. 2.0" : zh ? "例：2.0" : "e.g. 2.0", step: "0.5" },
                {
                  key: "advMinMpg",
                  label: es ? "MPG mínimo" : zh ? "最少上场时间" : "Min. MPG",
                  state: advMinMpg,
                  set: setAdvMinMpg,
                  placeholder: es ? "ej. 15" : zh ? "例：15" : "e.g. 15",
                  step: "0.5",
                },
              ] as {
                key: string;
                label: string;
                state: string;
                set: (v: string) => void;
                placeholder: string;
                step: string;
              }[]
            ).map(({ key, label, state, set, placeholder, step }) => (
              <div key={key} className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  {label}
                </label>
                <input
                  type="number"
                  min="0"
                  step={step}
                  value={state}
                  onChange={(e) => set(e.target.value)}
                  placeholder={placeholder}
                  className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/40"
                />
              </div>
            ))}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setAdvMinGames("");
                  setAdvMinPpg("");
                  setAdvMinRpg("");
                  setAdvMinApg("");
                  setAdvMinMpg("");
                }}
                className="flex-1 h-10 rounded-xl border border-border bg-muted/20 text-sm font-black text-muted-foreground hover:text-foreground transition-colors"
              >
                {es ? "Limpiar" : zh ? "清除" : "Clear"}
              </button>
              <button
                type="button"
                onClick={() => setAdvFilterOpen(false)}
                className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-black transition-colors hover:opacity-90"
              >
                {es ? "Aplicar" : zh ? "应用" : "Apply"}
              </button>
            </div>
            </div>
          </div>
        </>
      )}
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
  phaseType: StatsPhaseType;
  onPhaseChange: (p: StatsPhaseType) => void;
  locale: string;
  returnToTeamId: string | null;
  returnToPlayerId?: string | null;
  onClosePlayer: () => void;
  onCloseTeam: () => void;
  onTeamTapFromPlayer: (teamId: string) => void;
  onPlayerTapFromTeam: (id: string) => void;
}) {
  const es = props.locale === "es";
  const zh = props.locale === "zh";

  const leagueQ = useLeagueAverages(props.seasonId, null, props.phaseType);
  const standingsQ = useStandings(props.seasonId, props.phaseType);
  const lg = leagueQ.data;
  const topStandings = useMemo(() => {
    const rows = standingsQ.data?.standings ?? [];
    return [...rows].sort((a, b) => a.rank - b.rank).slice(0, 5);
  }, [standingsQ.data?.standings]);

  if (!props.playerSheetId && !props.teamSheetId) {
    // 4 Factores de Dean Oliver + ORTG + PPG
    const factors = lg
      ? [
          {
            label: "eFG%",
            value: lg.eFGPct != null ? `${lg.eFGPct.toFixed(1)}%` : "—",
            weight: 40,
            desc: es ? "Eficiencia de tiro (factor #1)" : zh ? "投篮效率 (权重#1)" : "Shooting efficiency (factor #1)",
            color: "bg-amber-500",
          },
          {
            label: "TOV%",
            value: lg.tovPct != null ? `${lg.tovPct.toFixed(1)}%` : "—",
            weight: 25,
            desc: es ? "Pérdidas por posesión (factor #2)" : zh ? "失误率 (权重#2)" : "Turnover rate (factor #2)",
            color: "bg-red-500",
          },
          {
            label: "ORB%",
            value: lg.orbPct != null ? `${lg.orbPct.toFixed(1)}%` : "—",
            weight: 20,
            desc: es ? "Rebote ofensivo (factor #3)" : zh ? "进攻篮板率 (权重#3)" : "Off. rebound rate (factor #3)",
            color: "bg-blue-500",
          },
          {
            label: "FTR",
            value: lg.ftRate != null ? lg.ftRate.toFixed(3) : "—",
            weight: 15,
            desc: es ? "Ratio tiro libre / FGA (factor #4)" : zh ? "罚球率 (权重#4)" : "Free throw rate (factor #4)",
            color: "bg-emerald-500",
          },
        ]
      : [];

    const ratings = lg
      ? [
          {
            label: "ORTG",
            value: lg.ortg?.toFixed(1) ?? "—",
            desc: es ? "Puntos por 100 pos." : zh ? "进攻效率" : "Pts per 100 poss.",
          },
          {
            label: "PPG",
            value: lg.ppg?.toFixed(1) ?? "—",
            desc: es ? "Puntos por partido" : zh ? "场均得分" : "Points per game",
          },
        ]
      : [];

    return (
      <div className="flex flex-col flex-1 min-h-0 p-4 gap-4 overflow-y-auto">
        {/* Placeholder */}
        <div className="flex flex-col items-center gap-2 py-3 text-center">
          <BarChart3 className="w-7 h-7 text-muted-foreground/35" aria-hidden />
          <p className="text-[11px] font-semibold text-muted-foreground/60">
            {es ? "Selecciona un equipo o jugadora" : zh ? "选择球队或球员" : "Select a team or player"}
          </p>
        </div>

        {/* 4 Factores de Dean Oliver */}
        {factors.length > 0 && (
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-[9px] font-black tracking-[2px] uppercase text-muted-foreground/50">
                {es ? "4 Factores · Media de liga" : zh ? "四因素·联赛均值" : "4 Factors · League avg"}
              </p>
              <p className="text-[8px] text-muted-foreground/35 italic">
                {es ? "Dean Oliver 2004" : zh ? "Oliver理论" : "Dean Oliver 2004"}
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              {factors.map((f) => (
                <div
                  key={f.label}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted/20 border border-border/25"
                >
                  <div
                    className="w-1 rounded-full self-stretch"
                    style={{
                      background: `var(--${f.color.replace("bg-", "")}, #888)`,
                      minHeight: 8,
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[10px] text-muted-foreground/70 truncate">{f.desc}</span>
                      <div className="flex items-baseline gap-1 shrink-0 ml-2">
                        <span className="text-[12px] font-black tabular-nums text-foreground">{f.value}</span>
                        <span className="text-[8px] font-bold text-muted-foreground/40">{f.label}</span>
                      </div>
                    </div>
                    <div className="mt-0.5 h-0.5 bg-muted/30 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${f.color} rounded-full opacity-60`}
                        style={{ width: `${f.weight}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ratings secundarios */}
        {ratings.length > 0 && (
          <div>
            <p className="text-[9px] font-black tracking-[2px] uppercase text-muted-foreground/50 mb-1.5">
              {es ? "Contexto de liga" : zh ? "联赛背景" : "League context"}
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {ratings.map((r) => (
                <div
                  key={r.label}
                  className="flex flex-col items-center justify-center px-2 py-2 rounded-lg bg-muted/15 border border-border/20"
                >
                  <span className="text-[13px] font-black tabular-nums text-foreground">{r.value}</span>
                  <span className="text-[8px] font-bold text-muted-foreground/50 mt-0.5">{r.label}</span>
                  <span className="text-[8px] text-muted-foreground/40 text-center leading-tight mt-0.5">
                    {r.desc}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {topStandings.length > 0 && (
          <div>
            <p className="text-[9px] font-black tracking-[2px] uppercase text-muted-foreground/50 mb-1.5">
              {es ? "Clasificación" : zh ? "排名" : "Standings"}
            </p>
            <div className="rounded-xl border border-border/30 overflow-hidden">
              <div className="grid grid-cols-[0.35fr_1fr_0.55fr_0.45fr] gap-1 px-2.5 py-1.5 border-b border-border/30 bg-muted/15 text-[8px] font-black uppercase tracking-wider text-muted-foreground/55">
                <span className="text-center">#</span>
                <span>{es ? "Equipo" : zh ? "球队" : "Team"}</span>
                <span className="text-right">{es ? "V-D" : zh ? "胜-负" : "W-L"}</span>
                <span className="text-right">NET</span>
              </div>
              {topStandings.map((row) => {
                const netNum =
                  row.ppg != null && row.oppg != null && Number.isFinite(num(row.ppg)) && Number.isFinite(num(row.oppg))
                    ? num(row.ppg) - num(row.oppg)
                    : null;
                const netStr = netNum != null ? (netNum > 0 ? `+${netNum.toFixed(1)}` : netNum.toFixed(1)) : "—";
                return (
                  <div
                    key={String(row.teamExternalId)}
                    className="grid grid-cols-[0.35fr_1fr_0.55fr_0.45fr] gap-1 items-center px-2.5 py-1.5 border-b border-border/20 last:border-b-0 text-[11px]"
                  >
                    <span className="text-center font-black tabular-nums text-muted-foreground">{row.rank}</span>
                    <span className="font-bold text-foreground truncate">
                      {pickName(row.teamName, row.teamNameEn ?? null, props.locale) || "—"}
                    </span>
                    <span className="text-right font-black tabular-nums text-foreground">
                      {row.wins}-{row.losses}
                    </span>
                    <span
                      className={cn(
                        "text-right font-black tabular-nums",
                        netNum != null && netNum > 0
                          ? "text-green-600 dark:text-green-400"
                          : netNum != null && netNum < 0
                            ? "text-destructive"
                            : "text-muted-foreground",
                      )}
                    >
                      {netStr}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {leagueQ.isLoading && (
          <div className="flex justify-center py-2">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    );
  }

  if (props.playerSheetId) {
    return (
      <div className="flex flex-col h-full min-h-0">
        <StatsPlayerSheet
          externalId={props.playerSheetId}
          seasonId={props.seasonId}
          phaseType={props.phaseType}
          onClose={props.onClosePlayer}
          onTeamTap={props.onTeamTapFromPlayer}
          returnToTeamId={props.returnToTeamId}
          locale={props.locale}
          isDesktop={true}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <StatsTeamSheet
        externalId={props.teamSheetId}
        seasonId={props.seasonId}
        phaseType={props.phaseType}
        onPhaseChange={props.onPhaseChange}
        onClose={props.onCloseTeam}
        onPlayerTap={props.onPlayerTapFromTeam}
        locale={props.locale}
        scrollToPlayerId={props.returnToPlayerId ?? null}
      />
    </div>
  );
}

function StatsPlayerSheet({
  externalId,
  seasonId,
  phaseType,
  onClose,
  onTeamTap,
  returnToTeamId: _returnToTeamId,
  locale,
  isDesktop = false,
}: {
  externalId: string | null;
  seasonId: number;
  phaseType: StatsPhaseType;
  onClose: () => void;
  onTeamTap?: (teamId: string) => void;
  returnToTeamId?: string | null;
  locale: string;
  isDesktop?: boolean;
}) {
  const es = locale === "es";
  const zh = locale === "zh";

  const { data, isLoading, isError } = usePlayerDetail(externalId, seasonId, phaseType);
  const [byPosition, setByPosition] = useState(false);
  const filterPos = byPosition ? (data?.player?.position ?? null) : null;
  const leagueAvgQ   = useLeagueAverages(seasonId, filterPos, phaseType);
  const percentilesQ = usePlayerPercentiles(seasonId, filterPos, phaseType);

  const player = data?.player;
  const gameLog = data?.gameLog ?? [];
  const leagueAvg = leagueAvgQ.data;
  const onOffQ = usePlayerOnOff(player?.teamExternalId ?? null, externalId, undefined);

  type DeepTab = "forma" | "deep" | "partidos";
  const [deepTab, setDeepTab] = useState<DeepTab>("forma");
  const [showMoreStats, setShowMoreStats] = useState(false);
  const [showAllGames, setShowAllGames] = useState(false);
  type GameLogSortKey = "date" | "pts" | "reb" | "ast";
  const [gameLogSort, setGameLogSort] = useState<GameLogSortKey>("date");
  const [gameLogSortDir, setGameLogSortDir] = useState<"desc" | "asc">("desc");

  const [photoZoomed, setPhotoZoomed] = useState(false);
  const lastTapRef = useRef<number>(0);

  const handlePhotoTap = () => {
    const isPointerFine = window.matchMedia("(pointer: fine)").matches;
    if (isPointerFine) {
      setPhotoZoomed((z) => !z);
      return;
    }
    const now = Date.now();
    if (now - lastTapRef.current < 350) setPhotoZoomed((z) => !z);
    lastTapRef.current = now;
  };

  const [boxscoreGameId, setBoxscoreGameId] = useState<string | null>(null);
  const boxscoreQ = useGameBoxscore(boxscoreGameId);

  const isLandscape = useIsLandscape();

  const advStats = useMemo(() => {
    if (!player || gameLog.length === 0) return null;
    const pts = gameLog.map((g) => g.pts ?? 0);
    const mean = pts.reduce((a, b) => a + b, 0) / pts.length;
    const stdDev = Math.sqrt(
      pts.map((p) => (p - mean) ** 2).reduce((a, b) => a + b, 0) / pts.length,
    );
    const sorted = [...gameLog].sort(
      (a, b) => new Date(b.gameDate ?? 0).getTime() - new Date(a.gameDate ?? 0).getTime(),
    );
    const last5 = sorted.slice(0, 5);
    const last5Avg = last5.length ? last5.reduce((s, g) => s + (g.pts ?? 0), 0) / last5.length : null;
    const isHot = last5Avg != null && last5Avg > mean * 1.15;
    const isCold = last5Avg != null && last5Avg < mean * 0.85;
    const dd = gameLog.filter(
      (g) => (g.pts ?? 0) >= 10 && ((g.reb ?? 0) >= 10 || (g.ast ?? 0) >= 10),
    ).length;
    const td = gameLog.filter(
      (g) => [(g.pts ?? 0), (g.reb ?? 0), (g.ast ?? 0)].filter((v) => v >= 10).length >= 3,
    ).length;
    const fgm = gameLog.reduce((s, g) => s + (g.fgm ?? 0), 0);
    const fga = gameLog.reduce((s, g) => s + (g.fga ?? 0), 0);
    const tpm = gameLog.reduce((s, g) => s + (g.tpm ?? 0), 0);
    const fta = gameLog.reduce((s, g) => s + (g.fta ?? 0), 0);
    const tsPts = gameLog.reduce((s, g) => s + (g.pts ?? 0), 0);
    const tsPct = fga > 0 ? (tsPts / (2 * (fga + 0.44 * fta))) * 100 : null;
    const eFGPct = fga > 0 ? ((fgm + 0.5 * tpm) / fga) * 100 : null;
    const ftRate = fga > 0 ? fta / fga : null;
    const pie = player.pie ?? null;
    return { stdDev, last5Avg, isHot, isCold, dd, td, tsPct, eFGPct, ftRate, pie, meanPts: mean };
  }, [player, gameLog]);

  const playerTovPct = useMemo(() => {
    if (!player || gameLog.length === 0) return null;
    const totTov = gameLog.reduce((s, g) => s + (g.tov ?? 0), 0);
    const totFga = gameLog.reduce((s, g) => s + (g.fga ?? 0), 0);
    const totFta = gameLog.reduce((s, g) => s + (g.fta ?? 0), 0);
    const poss = totFga + 0.44 * totFta + totTov;
    return poss > 0 ? (totTov / poss) * 100 : null;
  }, [player, gameLog]);

  const sortedGameLog = useMemo(
    () =>
      [...gameLog].sort((a, b) => {
        if (gameLogSort === "date") {
          const at = new Date(a.gameDate ?? 0).getTime();
          const bt = new Date(b.gameDate ?? 0).getTime();
          return gameLogSortDir === "desc" ? bt - at : at - bt;
        }
        const av =
          gameLogSort === "pts" ? (a.pts ?? 0) : gameLogSort === "reb" ? (a.reb ?? 0) : (a.ast ?? 0);
        const bv =
          gameLogSort === "pts" ? (b.pts ?? 0) : gameLogSort === "reb" ? (b.reb ?? 0) : (b.ast ?? 0);
        return gameLogSortDir === "desc" ? bv - av : av - bv;
      }),
    [gameLog, gameLogSort, gameLogSortDir],
  );

  const handleGameLogSortClick = (col: GameLogSortKey) => {
    if (gameLogSort === col) setGameLogSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setGameLogSort(col);
      setGameLogSortDir("desc");
    }
  };

  // 3PT volume per game for the insight label
  const tpaPerGame = useMemo(() => {
    if (!player || gameLog.length === 0) return null;
    // g.tpa is per-game attempts, not cumulative — use simple average
    const perGameValues = gameLog.map((g) => g.tpa ?? 0);
    const avg = perGameValues.reduce((s, v) => s + v, 0) / perGameValues.length;
    // Sanity cap: if avg > 20 it's likely cumulative data, use player.games instead
    if (avg > 20 && player.games > 0) {
      const total = gameLog.reduce((s, g) => s + (g.tpa ?? 0), 0);
      return total / player.games;
    }
    return avg;
  }, [player, gameLog]);

  const tpaVolumeLabel = useMemo(() => {
    const tpa = tpaPerGame;
    const pc  = percentilesQ.data;
    if (tpa == null || !pc) return null;
    const es = locale === "es";
    const zh = locale === "zh";
    // Cuánto tira de 3 — volumen de intentos vs la liga
    if (tpa === 0)         return { key: "zero",    adv: es ? "ninguno"        : zh ? "无"       : "none",          gradient: "from-slate-700 to-slate-600",  text: "text-slate-500"   };
    if (tpa < pc.p20Tpa)  return { key: "veryLow", adv: es ? "muy pocos"      : zh ? "极少"     : "very few",      gradient: "from-slate-600 to-slate-500",  text: "text-slate-400"   };
    if (tpa < pc.p40Tpa)  return { key: "low",      adv: es ? "pocos"          : zh ? "较少"     : "few",           gradient: "from-blue-600 to-blue-500",    text: "text-blue-400"    };
    if (tpa < pc.p75Tpa)  return { key: "mid",      adv: es ? "normal"         : zh ? "中等"     : "average",       gradient: "from-emerald-600 to-teal-500", text: "text-emerald-400" };
    if (tpa < pc.p90Tpa)  return { key: "high",     adv: es ? "muchos"         : zh ? "较多"     : "many",          gradient: "from-amber-500 to-yellow-400", text: "text-amber-400"   };
    return                       { key: "veryHigh", adv: es ? "muchísimos"     : zh ? "极多"     : "loads",         gradient: "from-orange-500 to-red-400",   text: "text-orange-400"  };
  }, [tpaPerGame, percentilesQ.data, locale]);

  const statBars = useMemo(() => {
    if (!player) return [];
    type BarColor = "amber" | "green" | "purple" | "blue" | "red" | "muted";
    const rows: { key: string; val: string; rawNum: number; pct: number; color: BarColor }[] = [];
    const p = player;
    const lg = leagueAvg;
    const pc = percentilesQ.data;

    function barColor(v: number, lgv: number | null | undefined, higherBetter = true): BarColor {
      if (lgv == null || Number.isNaN(lgv) || lgv <= 0) return "muted";
      const diff = v - lgv;
      if (higherBetter) return diff > lgv * 0.05 ? "green" : diff < -lgv * 0.05 ? "red" : "amber";
      return diff < -lgv * 0.05 ? "green" : diff > lgv * 0.05 ? "red" : "amber";
    }
    function barPct(v: number, p95: number | null | undefined): number {
      return p95 && p95 > 0 ? Math.min(100, (v / p95) * 100) : Math.min(100, (v / 35) * 100);
    }

    rows.push({
      key: "PPG",
      val: p.ppg.toFixed(1),
      rawNum: p.ppg,
      pct: barPct(p.ppg, pc?.p95Ppg),
      color: barColor(p.ppg, lg?.avgPlayerPpg ?? null),
    });
    rows.push({
      key: "RPG",
      val: p.rpg.toFixed(1),
      rawNum: p.rpg,
      pct: barPct(p.rpg, pc?.p95Rpg),
      color: barColor(p.rpg, lg?.avgPlayerRpg ?? null),
    });
    if (p.fgPct != null)
      rows.push({
        key: "FG%",
        val: `${p.fgPct.toFixed(1)}%`,
        rawNum: p.fgPct,
        pct: barPct(p.fgPct, 65),
        color: barColor(p.fgPct, lg?.fgPct),
      });
    if (p.tsPct != null)
      rows.push({
        key: "TS%",
        val: `${p.tsPct.toFixed(1)}%`,
        rawNum: p.tsPct,
        pct: barPct(p.tsPct, pc?.p95TsPct),
        color: barColor(p.tsPct, lg?.tsPct),
      });
    if (p.eFGPct != null)
      rows.push({
        key: "eFG%",
        val: `${p.eFGPct.toFixed(1)}%`,
        rawNum: p.eFGPct,
        pct: barPct(p.eFGPct, pc?.p95EFGPct),
        color: barColor(p.eFGPct, lg?.eFGPct),
      });
    rows.push({
      key: "APG",
      val: p.apg.toFixed(1),
      rawNum: p.apg,
      pct: barPct(p.apg, pc?.p95Apg),
      color: barColor(p.apg, lg?.avgPlayerApg ?? null),
    });

    // 3P% siempre visible
    // Si fg3Pct es null pero hay game log, inferir 0.0% (no ha metido ninguno)
    const fg3 = p.fg3Pct ?? (gameLog.length > 0 ? 0 : null);
    rows.push({
      key: "3P%",
      val: fg3 != null ? `${fg3.toFixed(1)}%` : "—",
      rawNum: fg3 ?? 0,
      pct: fg3 != null && fg3 > 0 ? barPct(fg3, 55) : 0,
      color: fg3 != null && fg3 > 0 ? barColor(fg3, lg?.fg3Pct ?? null) : "muted",
    });

    return rows.slice(0, 7);
  }, [player, leagueAvg, percentilesQ.data, gameLog]);

  const vsPills = useMemo(() => {
    if (!player || !leagueAvg) return [];
    const pills: { label: string; up: boolean }[] = [];
    if (player.fgPct != null && leagueAvg.fgPct != null && player.fgPct > leagueAvg.fgPct * 1.05)
      pills.push({ label: "↑ FG%", up: true });
    if (player.fgPct != null && leagueAvg.fgPct != null && player.fgPct < leagueAvg.fgPct * 0.95)
      pills.push({ label: "↓ FG%", up: false });
    const lgPpg = leagueAvg.avgPlayerPpg ?? null;
    const lgApg = leagueAvg.avgPlayerApg ?? null;
    if (lgPpg != null && player.ppg > lgPpg * 1.05) pills.push({ label: "↑ PPG", up: true });
    if (lgApg != null && player.apg < lgApg * 0.95) pills.push({ label: "↓ APG", up: false });
    return pills.slice(0, 3);
  }, [player, leagueAvg]);

  const barColorClass: Record<string, string> = {
    amber: "bg-gradient-to-r from-amber-500 to-amber-400",
    green: "bg-gradient-to-r from-emerald-500 to-emerald-400",
    purple: "bg-gradient-to-r from-violet-500 to-violet-400",
    blue: "bg-gradient-to-r from-blue-500 to-blue-400",
    red: "bg-gradient-to-r from-red-500 to-red-400",
    muted: "bg-muted-foreground/30",
  };

  const L = {
    close: es ? "Volver" : zh ? "返回" : "Back",
    error: es ? "Error al cargar" : zh ? "加载失败" : "Failed to load",
    noData: es ? "Sin partidos disponibles" : zh ? "暂无比赛数据" : "No game data",
    tabForma: es ? "Forma" : zh ? "状态" : "Form",
    tabDeep: es ? "Deep stats" : zh ? "深度数据" : "Deep stats",
    tabGames: es ? "Partidos" : zh ? "赛程" : "Games",
    dateCol: es ? "Fecha" : zh ? "日期" : "Date",
    rivalCol: es ? "Rival" : zh ? "对手" : "Rival",
    ptsCol: "PTS",
    rebCol: "REB",
    astCol: "AST",
    minCol: "MIN",
    gameLogTitle: es ? "Registro de partidos" : zh ? "比赛记录" : "Game log",
    starter: es ? "Titular" : zh ? "首发" : "Starter",
    vsLeague: es ? "vs liga" : zh ? "vs联赛" : "vs league",
    noLeagueData: es ? "Sin datos de liga" : zh ? "暂无联赛数据" : "No league data",
    onOffTitle: "On/Off",
    onCourt: es ? "En cancha" : zh ? "在场" : "On court",
    offCourt: es ? "Fuera" : zh ? "下场" : "Off court",
    impact: es ? "Impacto" : zh ? "影响" : "Impact",
    onOffInsufficient: (n: number) =>
      es
        ? `Muestra insuficiente (${n} pos.)`
        : zh
          ? `样本不足（${n}回合）`
          : `Insufficient sample (${n} poss.)`,
  };

  const pos = player ? translatePosition(player.position, locale) : null;

  return (
    <div className="flex flex-col h-full bg-card">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 -ml-1 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          aria-label={L.close}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        {player?.photoUrl ? (
          <button
            type="button"
            onClick={handlePhotoTap}
            style={{ background: "none", border: "none", padding: 0 }}
            className="shrink-0 rounded-full focus:outline-none"
          >
            <img
              src={player.photoUrl}
              className="rounded-full object-cover object-top border-2 border-primary/25 transition-all duration-300 ease-in-out"
              style={{
                width: photoZoomed ? 140 : 44,
                height: photoZoomed ? 140 : 44,
                cursor: photoZoomed ? "zoom-out" : "zoom-in",
              }}
              alt=""
            />
          </button>
        ) : (
          <div className="w-11 h-11 rounded-full bg-muted/40 shrink-0 flex items-center justify-center text-sm font-black text-muted-foreground border-2 border-primary/20">
            {player
              ? (pickName(player.nameZh, player.nameEn, locale) || "?")[0].toUpperCase()
              : "?"}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className={cn("font-black truncate", isDesktop ? "text-lg" : "text-base")}>
            {player ? pickName(player.nameZh, player.nameEn, locale) || "—" : "—"}
          </p>
          <div className="flex items-center gap-1.5 flex-wrap">
            {player?.jerseyNumber != null && player.jerseyNumber !== "" && (
              <span className="text-[10px] text-muted-foreground font-bold">#{player.jerseyNumber}</span>
            )}
            {pickName(player?.teamName, player?.teamNameEn, locale) &&
              (onTeamTap && player?.teamExternalId ? (
                <button
                  type="button"
                  onClick={() => onTeamTap(String(player.teamExternalId))}
                  className="text-[10px] text-primary font-bold hover:underline truncate max-w-[90px]"
                >
                  {pickName(player.teamName, player.teamNameEn, locale)}
                </button>
              ) : (
                <span className="text-[10px] text-muted-foreground font-bold truncate max-w-[90px]">
                  {pickName(player?.teamName, player?.teamNameEn, locale)}
                </span>
              ))}
            {pos && (
              <span className="text-[8px] font-black uppercase tracking-wide bg-primary/10 border border-primary/25 text-primary px-1.5 py-0.5 rounded-full">
                {pos}
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          {player && (
            <p className={cn("font-black text-muted-foreground/60", isDesktop ? "text-sm" : "text-xs")}>
              {player.games}G
            </p>
          )}
          {advStats?.isHot && (
            <p className="text-[9px] font-black text-amber-500">
              {es ? "🔥 Racha" : zh ? "🔥 热手" : "🔥 Hot"}
            </p>
          )}
          {advStats?.isCold && (
            <p className="text-[9px] font-black text-blue-400">
              {es ? "❄️ Baja" : zh ? "❄️ 低迷" : "❄️ Cold"}
            </p>
          )}
        </div>
      </div>

      {/* ── Loading / Error ── */}
      {isLoading && (
        <div className="flex justify-center py-16 shrink-0">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {isError && (
        <div className="px-4 py-6 shrink-0">
          <p className="text-sm font-bold text-destructive text-center">{L.error}</p>
        </div>
      )}

      {/* ── Main content ── */}
      {!isLoading && !isError && player && player.games > 0 && (
        <div className="flex-1 min-h-0 overflow-y-auto">

          {/* HERO: radar + stat bars */}
          <div className="grid grid-cols-2 border-b border-border">

            {/* Radar side */}
            <div
              className={cn(
                "border-r border-border flex flex-col items-center justify-center",
                isDesktop ? "p-3" : "p-2",
              )}
            >
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground/60 mb-1 self-start px-1">
                {es ? "Perfil visual" : zh ? "视觉概况" : "Visual profile"}
              </p>
              <StatsRadar
                player={player}
                locale={locale}
                compact={!isDesktop}
                positionLabel={translatePosition(player.position, locale)}
                byPosition={byPosition}
                onTogglePosition={() => setByPosition((v) => !v)}
                leagueAvgData={leagueAvgQ.data ?? null}
                percentilesData={percentilesQ.data ?? null}
              />
            </div>

            {/* Stat bars side */}
            <div className={cn("flex flex-col justify-center", isDesktop ? "p-4" : "p-3", statBars.length >= 7 ? "gap-1.5" : "gap-2")}>
              {statBars.map((bar) => (
                <div key={bar.key} className="flex flex-col gap-[3px]">
                  <div className="flex justify-between items-baseline">
                    <span
                      className={cn(
                        "font-black uppercase tracking-wide text-foreground/65",
                        isDesktop ? "text-xs" : "text-[11px]",
                      )}
                    >
                      {bar.key}
                    </span>
                    <span
                      className={cn(
                        "font-black tabular-nums",
                        isDesktop ? "text-lg" : "text-base",
                        bar.color === "green"
                          ? "text-emerald-400"
                          : bar.color === "red"
                            ? "text-red-400"
                            : bar.color === "purple"
                              ? "text-violet-400"
                              : "text-primary",
                      )}
                    >
                      {bar.val}
                    </span>
                  </div>
                  <div className="h-[3px] rounded-full bg-muted/40 overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", barColorClass[bar.color])}
                      style={{ width: `${bar.pct}%` }}
                    />
                  </div>
                  {bar.key === "3P%" && tpaVolumeLabel && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <div className={cn("h-1.5 w-6 rounded-full bg-gradient-to-r shrink-0", tpaVolumeLabel.gradient)} />
                      <span className="text-[8px] font-bold text-muted-foreground/50">
                        {es ? "Intentos de 3:" : zh ? "三分出手:" : "3s attempted:"}
                      </span>
                      <span className={cn("text-[8px] font-black", tpaVolumeLabel.text)}>
                        {tpaVolumeLabel.adv}
                      </span>
                    </div>
                  )}
                </div>
              ))}
              {vsPills.length > 0 && (
                <div className="flex items-center gap-1.5 pt-1 mt-0.5 border-t border-border/50 flex-wrap">
                  <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground/65">
                    {L.vsLeague}
                  </span>
                  {vsPills.map((p) => (
                    <span
                      key={p.label}
                      className={cn(
                        "text-[9px] font-black px-1.5 py-0.5 rounded border",
                        p.up
                          ? "bg-emerald-500/12 text-emerald-500 border-emerald-500/20"
                          : "bg-red-500/10 text-red-400 border-red-500/18",
                      )}
                    >
                      {p.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-px bg-border border-b border-border">
            {[
              { l: "PPG", v: player.ppg.toFixed(1), hero: true },
              { l: "RPG", v: player.rpg.toFixed(1), hero: true },
              { l: "APG", v: player.apg.toFixed(1), hero: true },
            ].map(({ l, v, hero }) => (
              <div key={l} className={cn("bg-card text-center py-3", hero && "bg-muted/10")}>
                <p
                  className={cn(
                    "font-black text-primary tabular-nums leading-none",
                    isDesktop ? "text-2xl" : "text-xl",
                  )}
                >
                  {v}
                </p>
                <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/70 mt-1">
                  {l}
                </p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-px bg-border border-b border-border">
            {[
              { l: "SPG", v: player.spg.toFixed(1) },
              { l: "BPG", v: player.bpg.toFixed(1) },
              { l: "TOPG", v: player.topg.toFixed(1) },
              { l: "MPG", v: player.mpg.toFixed(1) },
            ].map(({ l, v }) => (
              <div key={l} className="bg-card text-center py-2.5">
                <p
                  className={cn(
                    "font-black tabular-nums leading-none text-foreground",
                    isDesktop ? "text-base" : "text-sm",
                  )}
                >
                  {v}
                </p>
                <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/70 mt-1">
                  {l}
                </p>
              </div>
            ))}
          </div>

          {/* Home / Away */}
          {(player.homeSplit || player.awaySplit) && (
            <div className="border-b border-border">
              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground/60 px-4 pt-3 pb-1">
                {es ? "Casa / Fuera" : zh ? "主场 / 客场" : "Home / Away"}
              </p>
              <div className="grid grid-cols-2 gap-px bg-border">
                {[
                  {
                    split: player.homeSplit,
                    label: es ? "🏠 Casa" : zh ? "🏠 主场" : "🏠 Home",
                    color: "text-emerald-500",
                  },
                  {
                    split: player.awaySplit,
                    label: es ? "✈️ Fuera" : zh ? "✈️ 客场" : "✈️ Away",
                    color: "text-amber-500",
                  },
                ].map(({ split, label, color }) => (
                  <div key={label} className="bg-card px-4 py-3">
                    <p className={cn("text-[8px] font-black uppercase tracking-wide mb-2", color)}>{label}</p>
                    {split ? (
                      <div className="space-y-1.5">
                        {[
                          { k: "PPG", v: split.pts },
                          { k: "RPG", v: split.reb },
                          { k: "APG", v: split.ast },
                        ].map(({ k, v }) => (
                          <div key={k} className="flex justify-between">
                            <span className="text-[10px] font-black uppercase text-muted-foreground/65">{k}</span>
                            <span
                              className={cn(
                                "font-black tabular-nums",
                                isDesktop ? "text-base" : "text-sm",
                              )}
                            >
                              {v.toFixed(1)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[9px] text-muted-foreground/40">—</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab bar */}
          <div className="flex border-b border-border sticky top-0 bg-card z-10 shadow-sm">
            {(
              [
                ["forma", L.tabForma],
                ["deep", L.tabDeep],
                ["partidos", L.tabGames],
              ] as [DeepTab, string][]
            ).map(([t, label]) => (
              <button
                key={t}
                type="button"
                onClick={() => setDeepTab(t)}
                className={cn(
                  "flex-1 py-3 text-[11px] font-black uppercase tracking-wider transition-all border-b-2",
                  deepTab === t
                    ? "text-primary border-primary bg-primary/5"
                    : "text-muted-foreground/50 border-transparent hover:text-muted-foreground hover:bg-muted/20",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Tab: Forma */}
          {deepTab === "forma" && (
            <div className={cn("space-y-4", isDesktop ? "p-4" : "p-3")}>
              {advStats &&
                (() => {
                  const last5 = [...gameLog]
                    .sort(
                      (a, b) =>
                        new Date(b.gameDate ?? 0).getTime() - new Date(a.gameDate ?? 0).getTime(),
                    )
                    .slice(0, 5);
                  const maxPts = Math.max(...last5.map((g) => g.pts ?? 0), 1);
                  return (
                    <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/70">
                          {es ? "Forma reciente · L5" : zh ? "近5场" : "Recent form · L5"}
                        </p>
                        {advStats.isHot && (
                          <span className="text-[9px] font-black text-amber-500">
                            🔥 {es ? "En racha" : zh ? "状态火热" : "Hot"}
                          </span>
                        )}
                        {advStats.isCold && (
                          <span className="text-[9px] font-black text-blue-400">
                            ❄️ {es ? "Bajón" : zh ? "低迷" : "Cold"}
                          </span>
                        )}
                      </div>
                      <div className="flex items-end gap-1.5 h-10">
                        {[...last5].reverse().map((g, i) => (
                          <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                            <div
                              className="w-full rounded-sm"
                              style={{
                                height: `${Math.round(((g.pts ?? 0) / maxPts) * 100)}%`,
                                minHeight: 4,
                                background:
                                  (g.pts ?? 0) >= advStats.meanPts * 1.1
                                    ? "rgba(16,185,129,0.6)"
                                    : "rgba(245,158,11,0.45)",
                              }}
                            />
                            <span className="text-[7px] font-black text-muted-foreground tabular-nums">
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

            </div>
          )}

          {/* Tab: Deep stats */}
          {deepTab === "deep" && (
            <div className={cn("space-y-4", isDesktop ? "p-4" : "p-3")}>
              {(player.usagePct != null ||
                player.pie != null ||
                player.ftRate != null ||
                player.astTovRatio != null) && (
                <div className="grid grid-cols-2 gap-2">
                  {player.usagePct != null && (
                    <AdvChip
                      label="USG%"
                      value={player.usagePct}
                      p95={null}
                      fmt={(v) => `${v.toFixed(1)}%`}
                    />
                  )}
                  {player.pie != null && (
                    <AdvChip label="PIE" value={player.pie} p95={null} fmt={(v) => `${v.toFixed(1)}`} />
                  )}
                  {player.ftRate != null && (
                    <AdvChip label="FT Rate" value={player.ftRate} p95={null} fmt={(v) => v.toFixed(3)} />
                  )}
                  {player.astTovRatio != null && (
                    <AdvChip
                      label="AST/TOV"
                      value={player.astTovRatio}
                      p95={null}
                      fmt={(v) => v.toFixed(2)}
                    />
                  )}
                </div>
              )}

              <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/70">
                  {L.onOffTitle}
                </p>
                {onOffQ.isLoading && (
                  <div className="flex justify-center py-3">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                {!onOffQ.isLoading && (() => {
                  const onOff = onOffQ.data?.onOff;
                  const possOn = onOff?.possessionsOn ?? 0;
                  if (!onOff || possOn < 20) {
                    return (
                      <p className="text-xs font-bold text-muted-foreground">{L.onOffInsufficient(possOn)}</p>
                    );
                  }
                  const fmtNetLine = (ppp: number | null) => {
                    if (ppp == null) return "—";
                    const net = ppp * 100;
                    return `NET ${net >= 0 ? "+" : ""}${net.toFixed(1)}`;
                  };
                  const netClass = (ppp: number | null) =>
                    ppp == null
                      ? "text-foreground"
                      : ppp * 100 >= 0
                        ? "text-emerald-400"
                        : "text-red-400";
                  const impactNet = onOff.impact != null ? onOff.impact * 100 : null;
                  return (
                    <div className="space-y-1.5 text-xs font-bold tabular-nums">
                      <p className={netClass(onOff.onOffPpp)}>
                        {L.onCourt}: {fmtNetLine(onOff.onOffPpp)}
                      </p>
                      <p className={netClass(onOff.offOffPpp)}>
                        {L.offCourt}: {fmtNetLine(onOff.offOffPpp)}
                      </p>
                      <p
                        className={cn(
                          "text-sm font-black pt-1 border-t border-border/50",
                          impactNet != null && impactNet >= 0 ? "text-primary" : "text-destructive",
                        )}
                      >
                        {L.impact}:{" "}
                        {impactNet != null
                          ? `${impactNet >= 0 ? "+" : ""}${impactNet.toFixed(1)}`
                          : "—"}
                      </p>
                    </div>
                  );
                })()}
              </div>

              {advStats && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/60 mb-2">
                    {es ? "Perfil de temporada" : zh ? "赛季概况" : "Season profile"}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-border bg-muted/10 p-3">
                      <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/55 mb-0.5">
                        {es ? "Doble-dobles" : zh ? "两双" : "Double-doubles"}
                      </p>
                      <p className={cn("font-black tabular-nums", isDesktop ? "text-xl" : "text-lg")}>{advStats.dd}</p>
                      <p className="text-[8px] text-muted-foreground/40 mt-1">
                        {es ? "≥10 en 2 categorías" : zh ? "2项达到两位数" : "10+ in 2 categories"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border bg-muted/10 p-3">
                      <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/55 mb-0.5">
                        {es ? "Triple-dobles" : zh ? "三双" : "Triple-doubles"}
                      </p>
                      <p className={cn("font-black tabular-nums", isDesktop ? "text-xl" : "text-lg")}>{advStats.td}</p>
                      <p className="text-[8px] text-muted-foreground/40 mt-1">
                        {es ? "≥10 en 3 categorías" : zh ? "3项达到两位数" : "10+ in 3 categories"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border bg-muted/10 p-3">
                      <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/55 mb-0.5">
                        {es ? "Consistencia" : zh ? "稳定性" : "Consistency"}
                      </p>
                      <p className={cn("font-black tabular-nums", isDesktop ? "text-xl" : "text-lg")}>{advStats.stdDev.toFixed(1)}</p>
                      <p className="text-[8px] text-muted-foreground/40 mt-1">
                        {es ? "Desv. típica en puntos — cuanto menor, más regular" : zh ? "得分标准差——越低越稳定" : "Scoring std dev — lower = more consistent"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border bg-muted/10 p-3">
                      <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/55 mb-0.5">
                        {es ? "Impacto global" : zh ? "综合影响力" : "Player impact"}
                      </p>
                      <p className={cn("font-black tabular-nums", isDesktop ? "text-xl" : "text-lg")}>
                        {advStats.pie != null ? `${advStats.pie.toFixed(1)}%` : "—"}
                      </p>
                      <p className="text-[8px] text-muted-foreground/40 mt-1">
                        {es ? "PIE — contribución al resultado del partido" : zh ? "PIE——对比赛结果的贡献度" : "PIE — contribution to game outcome"}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {advStats && (
                <div>
                  <p className="text-[8px] font-black uppercase tracking-wider text-muted-foreground/50 mb-2">
                    {es ? "Cuatro Factores vs Liga" : zh ? "四因素 vs 联赛均值" : "Four Factors vs League"}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      {
                        label: "eFG%",
                        val: player.eFGPct ?? advStats.eFGPct,
                        lgVal: leagueAvg?.eFGPct,
                        better: true,
                        fmt: (v: number) => `${v.toFixed(1)}%`,
                      },
                      {
                        label: "TOV%",
                        val: playerTovPct,
                        lgVal: leagueAvg?.tovPct,
                        better: false,
                        fmt: (v: number) => `${v.toFixed(1)}%`,
                      },
                      {
                        label: "FT Rate",
                        val: player.ftRate ?? advStats.ftRate,
                        lgVal: leagueAvg?.ftRate,
                        better: true,
                        fmt: (v: number) => v.toFixed(2),
                      },
                      {
                        label: "TS%",
                        val: player.tsPct ?? advStats.tsPct,
                        lgVal: leagueAvg?.tsPct,
                        better: true,
                        fmt: (v: number) => `${v.toFixed(1)}%`,
                      },
                    ].map(({ label, val, lgVal, better, fmt }) => {
                      const isGood =
                        val != null && lgVal != null ? (better ? val > lgVal : val < lgVal) : null;
                      return (
                        <div key={label} className="rounded-xl border border-border bg-muted/10 p-2.5">
                          <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/50">
                            {label}
                          </p>
                          <p
                            className={cn(
                              "font-black tabular-nums mt-0.5",
                              isDesktop ? "text-lg" : "text-base",
                              isGood === true
                                ? "text-emerald-400"
                                : isGood === false
                                  ? "text-red-400"
                                  : "text-foreground",
                            )}
                          >
                            {val != null ? fmt(val) : "—"}
                          </p>
                          {lgVal != null && (
                            <div className="flex items-center gap-1 mt-1">
                              <span
                                className={cn(
                                  "w-1.5 h-1.5 rounded-full",
                                  isGood === true
                                    ? "bg-emerald-500"
                                    : isGood === false
                                      ? "bg-red-500"
                                      : "bg-muted-foreground/40",
                                )}
                              />
                              <span className="text-[8px] text-muted-foreground">
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
              <div>
                <p className="text-[8px] font-black uppercase tracking-wider text-muted-foreground/50 mb-2">
                  {es ? "Más estadísticas" : zh ? "更多数据" : "More stats"}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { l: "3P%", v: player.fg3Pct != null ? `${player.fg3Pct.toFixed(1)}%` : "—" },
                    { l: "FT%", v: player.ftPct != null ? `${player.ftPct.toFixed(1)}%` : "—" },
                    { l: "AST/TOV", v: player.astTovRatio != null ? player.astTovRatio.toFixed(2) : "—" },
                    { l: "USG%", v: player.usagePct != null ? `${player.usagePct.toFixed(1)}%` : "—" },
                    { l: "eFG%", v: player.eFGPct != null ? `${player.eFGPct.toFixed(1)}%` : "—" },
                    { l: "PIE", v: player.pie != null ? `${player.pie.toFixed(1)}%` : "—" },
                  ].map(({ l, v }) => (
                    <div key={l} className="rounded-xl border border-border bg-muted/10 p-2 text-center">
                      <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/70">
                        {l}
                      </p>
                      <p className={cn("font-black tabular-nums mt-0.5", isDesktop ? "text-base" : "text-sm")}>
                        {v}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              {isLandscape && (
                <div className="rounded-xl border border-border bg-card p-3">
                  <p className="text-[8px] font-black uppercase tracking-wider text-muted-foreground/50 mb-2">
                    Shot Zones
                  </p>
                  <div className="w-full max-w-[280px] mx-auto">
                    <ShotZoneChart fgPct={player.fgPct ?? null} fg3Pct={player.fg3Pct ?? null} />
                  </div>
                </div>
              )}
              {!isLandscape && <LandscapeHint />}
            </div>
          )}

          {/* Tab: Partidos */}
          {deepTab === "partidos" && (
            <div className={cn(isDesktop ? "p-4" : "p-3")}>
              {gameLog.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center">
                  <p className="text-sm font-bold text-muted-foreground">{L.noData}</p>
                </div>
              ) : (
                <>
                  <div className="rounded-2xl border border-border bg-card overflow-hidden">
                    <div className="grid grid-cols-[0.5fr_1.15fr_0.5fr_0.5fr_0.5fr_0.5fr] gap-0 border-b border-border bg-muted/30 pl-2.5 pr-3 py-2 text-[8px] font-black uppercase tracking-wider text-muted-foreground">
                      <button
                        type="button"
                        onClick={() => handleGameLogSortClick("date")}
                        className={cn(
                          "text-left font-black uppercase tracking-wider text-xs touch-manipulation flex items-center gap-0.5",
                          gameLogSort === "date" ? "text-primary" : "text-muted-foreground",
                        )}
                      >
                        {es ? "Fecha" : zh ? "日期" : "Date"}
                        {gameLogSort === "date" && (
                          <span className="text-[8px]">{gameLogSortDir === "desc" ? "▼" : "▲"}</span>
                        )}
                      </button>
                      <span>{L.rivalCol}</span>
                      {(["pts", "reb", "ast"] as const).map((col) => (
                        <button
                          key={col}
                          type="button"
                          onClick={() => handleGameLogSortClick(col)}
                          className={cn(
                            "text-right font-black uppercase tracking-wider text-[8px] touch-manipulation flex items-center justify-end gap-0.5 w-full",
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
                        <button
                          key={g.gameId}
                          type="button"
                          onClick={() => setBoxscoreGameId(String(g.gameId))}
                          className={cn(
                            "w-full grid grid-cols-[0.5fr_1.15fr_0.5fr_0.5fr_0.5fr_0.5fr] gap-0 items-center pl-2 pr-3 py-2.5 border-b border-border last:border-b-0 text-xs border-l-[3px] text-left cursor-pointer hover:bg-muted/30 transition-colors",
                            g.plusMinus > 0
                              ? "border-l-emerald-500/50"
                              : g.plusMinus < 0
                                ? "border-l-red-500/40"
                                : "border-l-transparent",
                          )}
                        >
                          {/* W/L + date */}
                          <div className="flex flex-col items-start gap-0.5 min-w-0">
                            <span
                              className={cn(
                                "text-[9px] font-black w-5 h-5 rounded flex items-center justify-center shrink-0",
                                g.plusMinus > 0
                                  ? "bg-emerald-500/20 text-emerald-400"
                                  : g.plusMinus < 0
                                    ? "bg-red-500/15 text-red-400"
                                    : "bg-muted/30 text-muted-foreground",
                              )}
                            >
                              {g.plusMinus > 0 ? "W" : g.plusMinus < 0 ? "L" : "—"}
                            </span>
                            <p className="font-bold text-muted-foreground/60 tabular-nums text-[9px]">{date}</p>
                          </div>
                          {/* vs/en Rival */}
                          <div className="min-w-0">
                            <p className="font-bold text-foreground text-[11px] truncate">
                              {g.isHome !== undefined
                                ? g.isHome
                                  ? "vs"
                                  : "@"
                                : "vs"}{" "}
                              {pickName(g.rivalName, g.rivalNameEn ?? null, locale) || "—"}
                            </p>
                            {g.isStart && (
                              <span className="inline-block rounded-full bg-primary/15 text-primary text-[7px] font-black uppercase tracking-wide px-1.5 py-0 leading-4">
                                {L.starter}
                              </span>
                            )}
                          </div>
                          <p className="text-right font-black tabular-nums text-foreground">{g.pts}</p>
                          <p className="text-right font-black tabular-nums text-foreground">{g.reb}</p>
                          <p className="text-right font-black tabular-nums text-foreground">{g.ast}</p>
                          <p className="text-right font-semibold tabular-nums text-muted-foreground">
                            {minutesToDisplay(g.minutes != null ? String(g.minutes) : null)}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                  {!showAllGames && sortedGameLog.length > 10 && (
                    <button
                      type="button"
                      onClick={() => setShowAllGames(true)}
                      className="w-full mt-2 rounded-xl border border-border bg-card py-2.5 text-xs font-black text-primary touch-manipulation hover:bg-muted/30 transition-colors"
                    >
                      {es
                        ? `Ver ${sortedGameLog.length - 10} más`
                        : zh
                          ? `显示全部 ${sortedGameLog.length} 场`
                          : `See all ${sortedGameLog.length} games`}
                    </button>
                  )}
                </>
              )}
            </div>
          )}

        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && player && player.games === 0 && (
        <div className="flex-1 flex items-center justify-center px-6">
          <p className="text-sm font-bold text-muted-foreground text-center">{L.noData}</p>
        </div>
      )}

      <Sheet
        open={Boolean(boxscoreGameId)}
        onOpenChange={(o) => {
          if (!o) setBoxscoreGameId(null);
        }}
      >
        <SheetContent hideClose side="bottom" className="h-[80svh] overflow-y-auto pb-[env(safe-area-inset-bottom)] md:ml-12 lg:ml-48">
          <SheetHeader>
            <SheetTitle>
              {boxscoreQ.data ? (
                <span>
                  {pickName(boxscoreQ.data.game.home.nameZh, boxscoreQ.data.game.home.nameEn, locale)}{" "}
                  {boxscoreQ.data.game.homeScore}–{boxscoreQ.data.game.awayScore}{" "}
                  {pickName(boxscoreQ.data.game.away.nameZh, boxscoreQ.data.game.away.nameEn, locale)}
                </span>
              ) : (
                "..."
              )}
            </SheetTitle>
          </SheetHeader>
          {boxscoreQ.isLoading && (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {boxscoreQ.data &&
            (() => {
              const { game, players } = boxscoreQ.data;
              const homeExtId = game.home.extId;
              const homePlayers = players.filter((p) => p.teamExtId === homeExtId);
              const awayPlayers = players.filter((p) => p.teamExtId !== homeExtId);
              const renderTeam = (ps: typeof players) => (
                <div className="mb-4">
                  <div className="grid grid-cols-[2fr_0.5fr_0.5fr_0.5fr_0.5fr_0.5fr_0.7fr] text-[9px] font-black uppercase tracking-wide text-muted-foreground px-2 py-1 border-b border-border">
                    <span>Jugadora</span>
                    <span className="text-right">PTS</span>
                    <span className="text-right">REB</span>
                    <span className="text-right">AST</span>
                    <span className="text-right">STL</span>
                    <span className="text-right">BLK</span>
                    <span className="text-right">FG</span>
                  </div>
                  {ps.map((p) => (
                    <div
                      key={p.externalId}
                      className="grid grid-cols-[2fr_0.5fr_0.5fr_0.5fr_0.5fr_0.5fr_0.7fr] items-center px-2 py-2 border-b border-border/40 last:border-0 text-xs"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        {p.isStart && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                        <span className="truncate font-bold">
                          {locale === "zh" ? p.nameZh : (p.nameEn ?? p.nameZh)}
                        </span>
                      </div>
                      <span className="text-right font-black">{p.pts}</span>
                      <span className="text-right">{p.reb}</span>
                      <span className="text-right">{p.ast}</span>
                      <span className="text-right">{p.stl}</span>
                      <span className="text-right">{p.blk}</span>
                      <span className="text-right text-muted-foreground">
                        {p.fgm}/{p.fga}
                      </span>
                    </div>
                  ))}
                </div>
              );
              return (
                <div>
                  <p className="text-xs font-black text-primary mb-1 px-2">
                    {pickName(game.home.nameZh, game.home.nameEn, locale)} — {game.homeScore}
                  </p>
                  {game.homeQ1 != null && (
                    <p className="text-[10px] text-muted-foreground font-mono px-2 mb-2">
                      Q1 {game.homeQ1}–{game.awayQ1} · 
                      Q2 {game.homeQ2}–{game.awayQ2} · 
                      Q3 {game.homeQ3}–{game.awayQ3} · 
                      Q4 {game.homeQ4}–{game.awayQ4}
                    </p>
                  )}
                  {renderTeam(homePlayers)}
                  <p className="text-xs font-black text-primary mb-1 px-2 mt-2">
                    {pickName(game.away.nameZh, game.away.nameEn, locale)} — {game.awayScore}
                  </p>
                  {renderTeam(awayPlayers)}
                </div>
              );
            })()}
        </SheetContent>
      </Sheet>
    </div>
  );
}


function StatsTeamSheet({
  externalId,
  seasonId,
  phaseType,
  onPhaseChange,
  onClose,
  onPlayerTap,
  locale,
  scrollToPlayerId,
}: {
  externalId: string | null;
  seasonId: number;
  phaseType: StatsPhaseType;
  onPhaseChange: (p: StatsPhaseType) => void;
  onClose: () => void;
  onPlayerTap: (id: string) => void;
  locale: string;
  scrollToPlayerId?: string | null;
}) {
  const es = locale === "es";
  const zh = locale === "zh";
  const { data, isLoading, isError } = useTeamDetail(externalId, seasonId, phaseType);
  const leagueAvgQ = useLeagueAverages(seasonId, null, phaseType);
  const leagueAvg = leagueAvgQ.data;

  const team = data?.team;
  const paceQ = usePaceSegments(team?.externalId, seasonId, phaseType);
  const lineupsQ = useTeamLineups(team?.externalId, seasonId, phaseType);
  const lineups = lineupsQ.data?.lineups ?? [];
  const showLineupsTab = !lineupsQ.isLoading && lineups.length > 0;
  const topLineups = useMemo(() => {
    const filtered = [...lineups].filter((row) => lineupTotalPoss(row) >= 20);
    const getVal = (row: LineupRow): number => {
      switch (lineupSort) {
        case "g":    return row.gamesPlayed ?? 0;
        case "min":  return row.minutesPlayed ?? 0;
        case "ortg": return row.ortg ?? (row.offPpp != null ? row.offPpp * 100 : 0);
        case "drtg": return row.drtg ?? (row.defPpp != null ? row.defPpp * 100 : 0);
        case "net":  return row.netRtg ?? (row.netPpp != null ? row.netPpp * 100 : 0);
        case "tov":  return row.tovPct ?? 0;
        default:     return lineupTotalPoss(row);
      }
    };
    filtered.sort((a, b) => lineupSortDir === "desc" ? getVal(b) - getVal(a) : getVal(a) - getVal(b));
    return filtered.slice(0, 15);
  }, [lineups, lineupSort, lineupSortDir]);
  const players = data?.players ?? [];
  const teamGameLog: TeamGameLogEntry[] = team?.gameLog ?? [];
  const pointsByZone = team?.pointsByZone ?? null;

  const [activeTab, setActiveTab] = useState<"ficha" | "avanzado" | "partidos" | "roster" | "quintetos">("ficha");
  const [rosterSort, setRosterSort] = useState<"ppg" | "rpg" | "apg" | "pos" | "jersey">("ppg");
  const [rosterSortDir, setRosterSortDir] = useState<"asc" | "desc">("desc");
  const [lineupSort, setLineupSort] = useState<"poss" | "g" | "min" | "ortg" | "drtg" | "net" | "tov">("poss");
  const [lineupSortDir, setLineupSortDir] = useState<"asc" | "desc">("desc");
  const [boxscoreGameId, setBoxscoreGameId] = useState<string | null>(null);
  const boxscoreQ = useGameBoxscore(boxscoreGameId);

  const POS_ORDER: Record<string, number> = {
    "控球后卫": 1, "得分后卫": 2, "后卫": 3,
    "小前锋": 4, "大前锋": 5, "前锋": 6,
    "中锋": 7,
  };
  const rosterFiltered = players.filter((p) => p.nameEn?.trim() || p.nameZh?.trim());
  const activePlayers = [...rosterFiltered.filter((p) => p.games > 0)].sort((a, b) => {
    if (rosterSort === "pos") {
      const pa = POS_ORDER[a.position ?? ""] ?? 99;
      const pb2 = POS_ORDER[b.position ?? ""] ?? 99;
      return rosterSortDir === "desc" ? pb2 - pa : pa - pb2;
    }
    if (rosterSort === "jersey") {
      const an = parseInt(String(a.jerseyNumber ?? "999"), 10);
      const bn = parseInt(String(b.jerseyNumber ?? "999"), 10);
      return rosterSortDir === "desc" ? bn - an : an - bn;
    }
    const diff = (b[rosterSort] ?? 0) - (a[rosterSort] ?? 0);
    return rosterSortDir === "desc" ? diff : -diff;
  });

  useEffect(() => {
    if (!scrollToPlayerId || isLoading || activePlayers.length === 0) return;
    setActiveTab("roster");
    setTimeout(() => {
      const el = document.querySelector(`[data-player-id="${scrollToPlayerId}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 250);
  }, [scrollToPlayerId, isLoading, activePlayers.length]);

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
    tabQuintetos: es ? "Quintetos" : zh ? "阵容" : "Lineups",
    colLineup: es ? "Quinteto" : zh ? "阵容" : "Lineup",
    colPoss: es ? "Poss" : zh ? "回合" : "Poss",
    lineupsEmpty: es
      ? "Sin datos de quintetos para esta temporada"
      : zh
        ? "本赛季暂无阵容数据"
        : "No lineup data for this season",
    lineupsInsufficient: es
      ? "Datos insuficientes (mín. 20 posesiones)"
      : zh
        ? "数据不足（至少20回合）"
        : "Insufficient data (min. 20 possessions)",
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
    colorBySign,
  }: {
    label: string;
    val: number | null | undefined;
    lgVal: number | null;
    better: boolean;
    fmt: (v: number) => string;
    center?: boolean;
    colorBySign?: boolean;
  }) {
    const isGood = colorBySign
      ? val != null ? (val > 0 ? true : val < 0 ? false : null) : null
      : val != null && lgVal != null ? (better ? val > lgVal : val < lgVal) : null;
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

      <div className="flex justify-end px-4 py-2 border-b border-border/50 bg-card shrink-0">
        <PhaseToggle phaseType={phaseType} onChange={onPhaseChange} locale={locale} />
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
        {showLineupsTab && (
          <button
            type="button"
            onClick={() => setActiveTab("quintetos")}
            className={cn(
              "flex-1 py-2.5 text-[11px] font-black uppercase tracking-wide transition-colors border-b-2",
              activeTab === "quintetos"
                ? "text-primary border-primary"
                : "text-muted-foreground border-transparent",
            )}
          >
            {L.tabQuintetos}
          </button>
        )}
        <button
          type="button"
          onClick={() => setActiveTab("roster")}
          className={cn(
            "flex-1 py-2.5 text-[11px] font-black uppercase tracking-wide transition-colors border-b-2 flex items-center justify-center gap-1",
            activeTab === "roster"
              ? "text-primary border-primary"
              : "text-muted-foreground border-transparent",
          )}
        >
          <Users2 className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">{L.roster}</span>
        </button>
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

            </div>
          )}

          {activeTab === "avanzado" && (
            <div className="px-4 py-4 space-y-4">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2">
                  {L.perPossession}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <FactorChip
                    label="ORTG"
                    val={team.ortg}
                    lgVal={leagueAvg?.ortg ?? null}
                    better
                    center
                    fmt={(v) => v.toFixed(1)}
                  />
                  <FactorChip
                    label="DRTG"
                    val={team.drtg}
                    lgVal={leagueAvg?.drtg ?? null}
                    better={false}
                    center
                    fmt={(v) => v.toFixed(1)}
                  />
                  <FactorChip
                    label="NET RTG"
                    val={team.netRtg}
                    lgVal={null}
                    better
                    center
                    colorBySign
                    fmt={(v) => (v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1))}
                  />
                  <FactorChip
                    label="PACE"
                    val={team.paceEst}
                    lgVal={leagueAvg?.pace ?? null}
                    better
                    center
                    fmt={(v) => v.toFixed(1)}
                  />
                  <FactorChip
                    label="PPP Of."
                    val={team.pppOf}
                    lgVal={leagueAvg?.ppp ?? null}
                    better
                    center
                    fmt={(v) => v.toFixed(2)}
                  />
                  <FactorChip
                    label="PPP Def."
                    val={team.pppDef}
                    lgVal={leagueAvg?.ppp ?? null}
                    better={false}
                    center
                    fmt={(v) => v.toFixed(2)}
                  />
                </div>
              </div>

              {paceQ.data && !paceQ.data.insufficient_data && (
                <div className="px-4 py-3 border-t border-border/50">
                  <p className="text-[10px] font-black tracking-widest uppercase text-muted-foreground mb-1">
                    {locale === "zh" ? "进攻节奏" : locale === "es" ? "Ritmo ofensivo" : "Offensive Pace"}
                  </p>
                  <p className="text-[9px] text-muted-foreground/50 mb-3 leading-snug">
                    {locale === "es"
                      ? "Calculado desde posesiones PBP procesadas."
                      : locale === "zh"
                        ? "基于PBP处理后的回合数据计算。"
                        : "Calculated from processed PBP possessions."}
                  </p>
                  {[
                    {
                      label: locale === "zh" ? "快攻" : locale === "es" ? "Transition" : "Transition",
                      sublabel: "",
                      pct: paceQ.data.transition?.pct,
                      league: paceQ.data.lg?.transition.pct,
                      ppp: paceQ.data.transition?.ppp,
                      leaguePpp: paceQ.data.lg?.transition.ppp,
                      color: "bg-emerald-500",
                    },
                    {
                      label: locale === "zh" ? "早期进攻" : locale === "es" ? "Early Offense" : "Early Offense",
                      sublabel: "",
                      pct: paceQ.data.early?.pct,
                      league: paceQ.data.lg?.early.pct,
                      ppp: paceQ.data.early?.ppp,
                      leaguePpp: paceQ.data.lg?.early.ppp,
                      color: "bg-amber-500",
                    },
                    {
                      label: locale === "zh" ? "阵地战" : locale === "es" ? "Halfcourt" : "Halfcourt",
                      sublabel: "",
                      pct: paceQ.data.halfcourt?.pct,
                      league: paceQ.data.lg?.halfcourt.pct,
                      ppp: paceQ.data.halfcourt?.ppp,
                      leaguePpp: paceQ.data.lg?.halfcourt.ppp,
                      color: "bg-blue-500",
                    },
                  ].map((row) => (
                    <div key={row.label} className="mb-3">
                      <div className="flex items-baseline justify-between mb-1">
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-bold text-foreground text-[11px]">{row.label}</span>
                          <span className="text-[9px] text-muted-foreground/50 font-mono">{row.sublabel}</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="font-black tabular-nums text-[11px]">
                            {row.pct?.toFixed(1)}%
                            {row.league != null && (
                              <span className="text-muted-foreground font-normal ml-1 text-[9px]">
                                (liga {row.league.toFixed(1)}%)
                              </span>
                            )}
                          </span>
                          {row.ppp != null && (
                            <span className={cn(
                              "text-[10px] font-black tabular-nums px-1.5 py-0.5 rounded border",
                              row.leaguePpp != null && row.ppp > row.leaguePpp
                                ? "bg-emerald-500/12 text-emerald-500 border-emerald-500/20"
                                : row.leaguePpp != null && row.ppp < row.leaguePpp
                                  ? "bg-red-500/10 text-red-400 border-red-500/18"
                                  : "bg-muted/20 text-muted-foreground border-border/40"
                            )}>
                              {row.ppp.toFixed(2)} PPP
                              {row.leaguePpp != null && (
                                <span className="font-normal ml-1 opacity-60">
                                  / {row.leaguePpp.toFixed(2)}
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${row.color} rounded-full`}
                          style={{ width: `${row.pct ?? 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  <p className="text-[10px] text-muted-foreground mt-2">
                    {locale === "zh"
                      ? `均 ${paceQ.data.avg_possession_time}s/攻`
                      : locale === "es"
                        ? `Media ${paceQ.data.avg_possession_time}s/pos.`
                        : `Avg ${paceQ.data.avg_possession_time}s/poss.`}
                    {paceQ.data.lg && (
                      <span> · liga {paceQ.data.lg.avg_possession_time}s</span>
                    )}
                  </p>
                </div>
              )}
              {paceQ.data?.insufficient_data && (
                <div className="px-4 py-2 border-t border-border/50">
                  <p className="text-[10px] text-muted-foreground">
                    {locale === "zh" ? "PBP数据不足" : "Datos PBP insuficientes para ritmo"} (
                    {paceQ.data.possessions} pos.)
                  </p>
                </div>
              )}

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
                    lgVal={leagueAvg?.drbPct ?? null}
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

            </div>
          )}

          {activeTab === "quintetos" && (
            <div className="px-4 py-4">
              {topLineups.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border px-6 py-10 text-center">
                  <p className="text-sm font-bold text-muted-foreground">
                    {lineups.length > 0 ? L.lineupsInsufficient : L.lineupsEmpty}
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                  <div className="grid grid-cols-[1.5fr_0.32fr_0.36fr_0.36fr_0.4fr_0.4fr_0.4fr_0.36fr] gap-0 px-3 py-2 border-b border-border bg-muted/20 text-[9px] font-black uppercase tracking-wider text-muted-foreground">
                    <span>{L.colLineup}</span>
                    {(["g","min","poss","ortg","drtg","net","tov"] as const).map((col, idx) => {
                      const labels: Record<string, string> = { g: L.colG, min: "MIN", poss: L.colPoss, ortg: "ORTG", drtg: "DRTG", net: "NET", tov: "TOV%" };
                      const active = lineupSort === col;
                      return (
                        <button
                          key={col}
                          type="button"
                          onClick={() => {
                            if (active) setLineupSortDir(d => d === "desc" ? "asc" : "desc");
                            else { setLineupSort(col); setLineupSortDir("desc"); }
                          }}
                          className={cn(
                            "text-right tabular-nums flex items-center justify-end gap-0.5 hover:text-foreground transition-colors",
                            active && "text-foreground"
                          )}
                        >
                          {labels[col]}
                          {active && <span className="text-[8px]">{lineupSortDir === "desc" ? "↓" : "↑"}</span>}
                        </button>
                      );
                    })}
                  </div>
                  {topLineups.map((row, i) => {
                    const poss = lineupTotalPoss(row);
                    const netVal = row.netRtg ?? (row.netPpp != null ? row.netPpp * 100 : null);
                    const min = row.minutesPlayed != null ? row.minutesPlayed.toFixed(0) : "—";
                    const pm = row.plusMinus;
                    return (
                      <div
                        key={row.lineupId}
                        className={cn(
                          "grid grid-cols-[1.5fr_0.32fr_0.36fr_0.36fr_0.4fr_0.4fr_0.4fr_0.36fr] gap-0 items-center px-3 py-2.5 text-xs",
                          i < topLineups.length - 1 && "border-b border-border/50",
                        )}
                      >
                        <p className="text-[10px] font-bold text-foreground leading-snug truncate pr-1">
                          {locale === "zh"
                            ? lineupShortNames(row.playerNamesZh, locale)
                            : lineupShortNames(row.playerNamesEn, locale)}
                        </p>
                        <p className="text-right font-black tabular-nums text-foreground">{row.gamesPlayed}</p>
                        <p className="text-right tabular-nums text-muted-foreground text-[10px]">{min}</p>
                        <p className="text-right font-black tabular-nums text-foreground">{poss}</p>
                        <p className="text-right font-black tabular-nums text-foreground">
                          {row.ortg != null ? row.ortg.toFixed(1) : fmtLineupRtg(row.offPpp)}
                        </p>
                        <p className="text-right font-black tabular-nums text-foreground">
                          {row.drtg != null ? row.drtg.toFixed(1) : fmtLineupRtg(row.defPpp)}
                        </p>
                        <p
                          className={cn(
                            "text-right font-black tabular-nums",
                            netVal != null
                              ? netVal > 0
                                ? "text-green-600 dark:text-green-400"
                                : netVal < 0
                                  ? "text-destructive"
                                  : "text-foreground"
                              : "text-muted-foreground",
                          )}
                        >
                          {netVal != null
                            ? (netVal > 0 ? `+${netVal.toFixed(1)}` : netVal.toFixed(1))
                            : "—"}
                        </p>
                        <p className="text-right font-black tabular-nums text-foreground text-[10px]">
                          {row.offPossessions >= 40 && row.tovPct != null
                            ? `${row.tovPct.toFixed(1)}%`
                            : "—"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
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
                    <button
                      key={g.gameId}
                      type="button"
                      onClick={() => setBoxscoreGameId(String(g.gameId))}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 text-left touch-manipulation hover:bg-muted/25 active:bg-muted/40 transition-colors",
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
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "roster" && (
            <div className="px-4 py-4">
              {activePlayers.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border px-6 py-10 text-center">
                  <p className="text-sm font-bold text-muted-foreground">{L.noData}</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                  <div className="grid grid-cols-[1.2fr_0.5fr_0.4fr_0.55fr_0.55fr_0.55fr] gap-0 border-b border-border bg-muted/30 px-3 py-2 text-xs font-black uppercase tracking-wider text-muted-foreground">
                    <button
                      type="button"
                      onClick={() => {
                        if (rosterSort === "jersey") setRosterSortDir((d) => d === "desc" ? "asc" : "desc");
                        else { setRosterSort("jersey"); setRosterSortDir("asc"); }
                      }}
                      className={cn(
                        "text-left font-black uppercase tracking-wider text-xs touch-manipulation flex items-center gap-0.5",
                        rosterSort === "jersey" ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {L.colPlayer}
                      {rosterSort === "jersey" && <span className="text-[7px]">{rosterSortDir === "asc" ? "▲" : "▼"}</span>}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (rosterSort === "pos") setRosterSortDir((d) => d === "desc" ? "asc" : "desc");
                        else { setRosterSort("pos"); setRosterSortDir("asc"); }
                      }}
                      className={cn(
                        "text-left font-black uppercase tracking-wider text-xs touch-manipulation flex items-center gap-0.5",
                        rosterSort === "pos" ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {es ? "Pos" : zh ? "位置" : "Pos"}
                      {rosterSort === "pos" && <span className="text-[7px]">{rosterSortDir === "desc" ? "▼" : "▲"}</span>}
                    </button>
                    <span className="text-right">{L.colG}</span>
                    {(["ppg", "rpg", "apg"] as const).map((col) => (
                      <button
                        key={col}
                        type="button"
                        onClick={() => {
                          if (rosterSort === col) setRosterSortDir((d) => (d === "desc" ? "asc" : "desc"));
                          else { setRosterSort(col); setRosterSortDir("desc"); }
                        }}
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
                    const name = p.nameEn?.trim() || p.nameZh || "—";
                    return (
                      <button
                        key={p.externalId}
                        type="button"
                        data-player-id={p.externalId}
                        onClick={() => onPlayerTap(p.externalId)}
                        className="w-full grid grid-cols-[1.2fr_0.5fr_0.4fr_0.55fr_0.55fr_0.55fr] gap-0 items-center px-3 py-2.5 border-b border-border last:border-b-0 text-xs text-left touch-manipulation hover:bg-muted/30 active:bg-muted/45 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-extrabold text-foreground truncate">{name}</p>
                          {p.jerseyNumber != null && p.jerseyNumber !== "" && (
                            <p className="text-xs text-muted-foreground/60 font-semibold">#{p.jerseyNumber}</p>
                          )}
                        </div>
                        <p className="text-[9px] font-black uppercase tracking-wide text-muted-foreground/70 truncate">
                          {p.position ? translatePosition(p.position, locale) : "—"}
                        </p>
                        <p className="text-xs font-black text-foreground tabular-nums text-right">{p.games}</p>
                        <p className="text-xs font-black text-foreground tabular-nums text-right">{p.ppg.toFixed(1)}</p>
                        <p className="text-xs font-black text-foreground tabular-nums text-right">{p.rpg.toFixed(1)}</p>
                        <p className="text-xs font-black text-foreground tabular-nums text-right">{p.apg.toFixed(1)}</p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <Sheet
        open={Boolean(boxscoreGameId)}
        onOpenChange={(o) => {
          if (!o) setBoxscoreGameId(null);
        }}
      >
        <SheetContent hideClose side="bottom" className="h-[80svh] overflow-y-auto pb-[env(safe-area-inset-bottom)] md:ml-12 lg:ml-48">
          <SheetHeader>
            <SheetTitle>
              {boxscoreQ.data ? (
                <span>
                  {pickName(boxscoreQ.data.game.home.nameZh, boxscoreQ.data.game.home.nameEn, locale)}{" "}
                  {boxscoreQ.data.game.homeScore}–{boxscoreQ.data.game.awayScore}{" "}
                  {pickName(boxscoreQ.data.game.away.nameZh, boxscoreQ.data.game.away.nameEn, locale)}
                </span>
              ) : (
                "..."
              )}
            </SheetTitle>
          </SheetHeader>
          {boxscoreQ.isLoading && (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {boxscoreQ.data &&
            (() => {
              const { game, players } = boxscoreQ.data;
              const homeExtId = game.home.extId;
              const homePlayers = players.filter((p) => p.teamExtId === homeExtId);
              const awayPlayers = players.filter((p) => p.teamExtId !== homeExtId);
              const renderTeam = (ps: typeof players) => (
                <div className="mb-4">
                  <div className="grid grid-cols-[2fr_0.5fr_0.5fr_0.5fr_0.5fr_0.5fr_0.7fr] text-[9px] font-black uppercase tracking-wide text-muted-foreground px-2 py-1 border-b border-border">
                    <span>Jugadora</span>
                    <span className="text-right">PTS</span>
                    <span className="text-right">REB</span>
                    <span className="text-right">AST</span>
                    <span className="text-right">STL</span>
                    <span className="text-right">BLK</span>
                    <span className="text-right">FG</span>
                  </div>
                  {ps.map((p) => (
                    <div
                      key={p.externalId}
                      className="grid grid-cols-[2fr_0.5fr_0.5fr_0.5fr_0.5fr_0.5fr_0.7fr] items-center px-2 py-2 border-b border-border/40 last:border-0 text-xs"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        {p.isStart && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                        <span className="truncate font-bold">
                          {locale === "zh" ? p.nameZh : (p.nameEn ?? p.nameZh)}
                        </span>
                      </div>
                      <span className="text-right font-black">{p.pts}</span>
                      <span className="text-right">{p.reb}</span>
                      <span className="text-right">{p.ast}</span>
                      <span className="text-right">{p.stl}</span>
                      <span className="text-right">{p.blk}</span>
                      <span className="text-right text-muted-foreground">
                        {p.fgm}/{p.fga}
                      </span>
                    </div>
                  ))}
                </div>
              );
              return (
                <div>
                  <p className="text-xs font-black text-primary mb-1 px-2">
                    {pickName(game.home.nameZh, game.home.nameEn, locale)} — {game.homeScore}
                  </p>
                  {game.homeQ1 != null && (
                    <p className="text-[10px] text-muted-foreground font-mono px-2 mb-2">
                      Q1 {game.homeQ1}–{game.awayQ1} · 
                      Q2 {game.homeQ2}–{game.awayQ2} · 
                      Q3 {game.homeQ3}–{game.awayQ3} · 
                      Q4 {game.homeQ4}–{game.awayQ4}
                    </p>
                  )}
                  {renderTeam(homePlayers)}
                  <p className="text-xs font-black text-primary mb-1 px-2 mt-2">
                    {pickName(game.away.nameZh, game.away.nameEn, locale)} — {game.awayScore}
                  </p>
                  {renderTeam(awayPlayers)}
                </div>
              );
            })()}
        </SheetContent>
      </Sheet>
    </div>
  );
}
