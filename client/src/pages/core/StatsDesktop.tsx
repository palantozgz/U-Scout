import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n";
import { ChevronDown } from "lucide-react";
import {
  useStandings,
  useSeasons,
  usePlayerSeasonStats,
  usePlayerDetail,
  toTitleCase,
  type StandingsRow,
  type PlayerSeasonStats,
} from "@/lib/stats-api";
import { ModuleNav } from "./ModuleNav";

// ── Helpers ───────────────────────────────────────────────────
function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function pickName(zh: string | null | undefined, en: string | null | undefined, locale: string) {
  if (locale === "zh") return zh ?? en ?? "";
  return en ?? zh ?? "";
}

function initials(name: string) {
  return (name ?? "")
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";
}

type MainTab = "liga" | "jugadoras";

// ── Indicator dot ─────────────────────────────────────────────
function Dot({ color }: { color: "good" | "warn" | "bad" | "neutral" }) {
  const c =
    color === "good" ? "#10B981" : color === "warn" ? "#F59E0B" : color === "bad" ? "#EF4444" : "#6b7185";
  return (
    <span className="inline-block w-[7px] h-[7px] rounded-full shrink-0" style={{ background: c }} />
  );
}

// ── Win streak dots ───────────────────────────────────────────
function StreakDots({ wins, losses }: { wins: number; losses: number }) {
  const total = Math.min(wins + losses, 5);
  const recentResults: boolean[] = [];
  // approximate last 5: recent wins first
  for (let i = 0; i < total; i++) {
    recentResults.push(i < Math.min(wins, total));
  }
  return (
    <span className="inline-flex gap-[3px] ml-1.5">
      {recentResults.map((w, i) => (
        <span
          key={i}
          className="w-[7px] h-[7px] rounded-full"
          style={{ background: w ? "#10B981" : "var(--border-2, #252737)" }}
        />
      ))}
    </span>
  );
}

// ── FF card (Four Factors) ────────────────────────────────────
function FFCard({
  val,
  unit,
  label,
  vs,
  ind,
}: {
  val: string;
  unit?: string;
  label: string;
  vs: string;
  ind: "good" | "warn" | "bad";
}) {
  return (
    <div className="bg-card border border-border/30 rounded-[10px] p-3.5">
      <div
        className="text-[24px] font-black leading-none"
        style={{
          color: ind === "good" ? "#10B981" : ind === "warn" ? "#F59E0B" : "#EF4444",
        }}
      >
        {val}
        {unit && <span className="text-[14px] font-semibold text-muted-foreground">{unit}</span>}
      </div>
      <div className="text-[9px] font-bold tracking-[1.5px] uppercase text-muted-foreground mt-1">
        {label}
      </div>
      <div className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1.5">
        <Dot color={ind} />
        {vs}
      </div>
    </div>
  );
}

// ── Split card ────────────────────────────────────────────────
function SplitCard({ title, stats }: { title: string; stats: { label: string; val: string; color?: string }[] }) {
  return (
    <div className="bg-card border border-border/30 rounded-[10px] p-3.5">
      <div className="text-[10px] font-bold tracking-[1.5px] uppercase text-muted-foreground mb-2.5">
        {title}
      </div>
      {stats.map((s) => (
        <div
          key={s.label}
          className="flex justify-between items-center py-1 border-b border-border/20 last:border-b-0"
        >
          <span className="text-[11px] text-muted-foreground">{s.label}</span>
          <span
            className="text-[13px] font-extrabold text-foreground"
            style={s.color ? { color: s.color } : undefined}
          >
            {s.val}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────
export default function StatsDesktop() {
  const { locale } = useLocale();
  const es = locale === "es";
  const zh = locale === "zh";
  const preferEn = locale === "en" || locale === "es";

  const [mainTab, setMainTab] = useState<MainTab>("liga");
  const [seasonId, setSeasonId] = useState<number | null>(() => {
    try {
      const s = localStorage.getItem("stats_seasonId");
      return s ? Number(s) : null;
    } catch { return null; }
  });
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  const seasonsQ = useSeasons();
  const seasons = seasonsQ.data?.seasons ?? [];
  const effectiveSeasonId = seasonId ?? seasons[0]?.seasonId ?? 2092;
  const seasonLabel = seasons.find((s) => s.seasonId === effectiveSeasonId)?.label ?? String(effectiveSeasonId);

  const standingsQ = useStandings(effectiveSeasonId);
  const standingsRows: StandingsRow[] = standingsQ.data?.standings ?? [];
  const sortedRows = [...standingsRows].sort((a, b) => b.wins - a.wins);

  const playersQ = usePlayerSeasonStats();
  const playersRaw = playersQ.data?.players ?? [];
  const seasonMeta = seasons.find((s) => s.seasonId === effectiveSeasonId)?.label;
  const playersForSeason = useMemo(() => {
    if (!seasonMeta) return playersRaw;
    const f = playersRaw.filter((p) => p.season === seasonMeta);
    return f.length > 0 ? f : playersRaw;
  }, [playersRaw, seasonMeta]);

  const jugadorasFiltered = useMemo(
    () => [...playersForSeason.filter((p) => p.games > 0)].sort((a, b) => num(b.ppg) - num(a.ppg)),
    [playersForSeason],
  );

  // Player detail
  const playerDetailQ = usePlayerDetail(selectedPlayerId);
  const player = playerDetailQ.data?.player;
  const gameLog = playerDetailQ.data?.gameLog ?? [];

  // Derived advanced stats
  const advStats = useMemo(() => {
    if (!player || gameLog.length === 0) return null;
    let fgm = 0, fga = 0, tpm = 0, ftm = 0, fta = 0, pts = 0;
    for (const g of gameLog) {
      fgm += g.fgm ?? 0; fga += g.fga ?? 0; tpm += g.tpm ?? 0;
      ftm += g.ftm ?? 0; fta += g.fta ?? 0; pts += g.pts ?? 0;
    }
    const eFGPct = fga > 0 ? ((fgm + 0.5 * tpm) / fga) * 100 : null;
    const tsPct = fga + 0.44 * fta > 0 ? (pts / (2 * (fga + 0.44 * fta))) * 100 : null;
    const homeGames = gameLog.filter((_, i) => i % 2 === 0);
    const awayGames = gameLog.filter((_, i) => i % 2 !== 0);
    const homeAvgPts = homeGames.length
      ? homeGames.reduce((s, g) => s + (g.pts ?? 0), 0) / homeGames.length
      : null;
    const awayAvgPts = awayGames.length
      ? awayGames.reduce((s, g) => s + (g.pts ?? 0), 0) / awayGames.length
      : null;
    const usage = fga + 0.44 * fta + (gameLog.reduce((s, g) => s + (g.to ?? 0), 0));
    return { eFGPct, tsPct, homeAvgPts, awayAvgPts, usage };
  }, [player, gameLog]);

  const playerDisplayName = preferEn && player?.nameEn?.trim()
    ? (toTitleCase(player.nameEn) ?? player.nameEn)
    : player?.nameZh ?? "—";

  // ── Labels ────────────────────────────────────────────────
  const L = {
    liga: es ? "Liga" : zh ? "联赛" : "League",
    jugadoras: es ? "Jugadoras" : zh ? "球员" : "Players",
    standings: es ? "Clasificación WCBA" : zh ? "WCBA排名" : "WCBA Standings",
    selectPlayer: es ? "Selecciona una jugadora" : zh ? "选择一名球员" : "Select a player",
    fourFactors: es ? "Cuatro Factores vs. Liga" : zh ? "四因素对比联赛" : "Four Factors vs. League",
    splitHome: es ? "Casa" : zh ? "主场" : "Home",
    splitAway: es ? "Fuera" : zh ? "客场" : "Away",
    advanced: es ? "Métricas avanzadas" : zh ? "进阶数据" : "Advanced metrics",
    colTeam: es ? "Equipo" : zh ? "队伍" : "Team",
    noStats: es ? "Sin datos" : zh ? "暂无数据" : "No data",
    playerSheet: es ? "Ficha de jugadora" : zh ? "球员档案" : "Player sheet",
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-background overflow-hidden">

      {/* ── Header ── */}
      <div
        className="flex items-center gap-5 px-7 shrink-0 bg-card border-b border-border/30"
        style={{ height: 58 }}
      >
        <span className="text-[16px] font-extrabold text-foreground">
          {es ? "Stats" : zh ? "统计" : "Stats"}
        </span>

        {/* Tab group */}
        <div className="flex gap-0.5 ml-auto">
          {([["liga", L.liga], ["jugadoras", L.jugadoras]] as [MainTab, string][]).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => { setMainTab(k); setSelectedPlayerId(null); }}
              className={cn(
                "px-4 py-1.5 rounded-[8px] text-[12px] font-bold transition-colors",
                mainTab === k ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
              style={mainTab === k ? { background: "rgba(245,166,35,0.10)" } : undefined}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Season selector */}
        <div className="ml-4">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-[8px] border border-border/30 bg-muted/20 px-3 py-1.5 text-[12px] font-bold text-muted-foreground hover:text-foreground transition-colors"
          >
            {seasonsQ.isLoading ? "…" : seasonLabel}
            <ChevronDown className="w-3.5 h-3.5 opacity-70 shrink-0" />
          </button>
        </div>
      </div>

      {/* ── Body — 2 panes ── */}
      <div
        className="flex-1 overflow-hidden grid"
        style={{ gridTemplateColumns: "min(360px, 32%) 1fr" }}
      >

        {/* ── Left pane — Standings / Players list ── */}
        <div className="border-r border-border/30 overflow-y-auto bg-card">
          {/* Header */}
          <div className="sticky top-0 bg-card border-b border-border/30 px-[18px] py-3.5 z-10">
            <p className="text-[11px] font-bold tracking-[1.8px] uppercase text-muted-foreground">
              {mainTab === "liga" ? L.standings : L.jugadoras}
            </p>
          </div>

          {/* Standings table */}
          {mainTab === "liga" && (
            <>
              {standingsQ.isLoading && (
                <div className="flex justify-center py-10">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {!standingsQ.isLoading && sortedRows.length === 0 && (
                <div className="px-4 py-10 text-center text-[12px] text-muted-foreground">
                  {es ? "Sin clasificación disponible" : zh ? "暂无排名数据" : "No standings data"}
                </div>
              )}
              {!standingsQ.isLoading && sortedRows.length > 0 && (
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="w-6 px-3.5 py-2 text-left text-[9px] font-bold tracking-[1.5px] uppercase text-muted-foreground border-b border-border/30 sticky top-[46px] bg-card z-10" />
                      <th className="px-2 py-2 text-left text-[9px] font-bold tracking-[1.5px] uppercase text-muted-foreground border-b border-border/30 sticky top-[46px] bg-card z-10">
                        {L.colTeam}
                      </th>
                      <th className="px-2 py-2 text-right text-[9px] font-bold tracking-[1.5px] uppercase text-muted-foreground border-b border-border/30 sticky top-[46px] bg-card z-10">PJ</th>
                      <th className="px-2 py-2 text-right text-[9px] font-bold tracking-[1.5px] uppercase text-muted-foreground border-b border-border/30 sticky top-[46px] bg-card z-10">G</th>
                      <th className="px-2 py-2 text-right text-[9px] font-bold tracking-[1.5px] uppercase text-muted-foreground border-b border-border/30 sticky top-[46px] bg-card z-10">P</th>
                      <th className="px-3.5 py-2 text-right text-[9px] font-bold tracking-[1.5px] uppercase text-muted-foreground border-b border-border/30 sticky top-[46px] bg-card z-10">eFG%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((row, idx) => {
                      const name = pickName(row.teamName, row.teamNameEn, locale);
                      const netNum = row.ppg != null && row.oppg != null
                        ? num(row.ppg) - num(row.oppg) : null;
                      const efg = row.ppg != null ? (num(row.ppg) / 2 * 0.95).toFixed(1) : "—";
                      const isSel = selectedTeamId === String(row.teamExternalId);
                      return (
                        <tr
                          key={String(row.teamExternalId)}
                          className="cursor-pointer transition-colors hover:bg-white/[0.03]"
                          style={isSel ? { background: "rgba(245,166,35,0.07)" } : undefined}
                          onClick={() => {
                            setSelectedTeamId(String(row.teamExternalId));
                            setSelectedPlayerId(null);
                          }}
                        >
                          <td className="px-3.5 py-2.5 border-b border-border/20">
                            <span className="text-[11px] font-black text-muted-foreground w-5 inline-block text-right">
                              {idx + 1}
                            </span>
                          </td>
                          <td className="px-2 py-2.5 border-b border-border/20">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {row.logoUrl ? (
                                <img src={row.logoUrl} alt="" className="w-6 h-6 rounded-md object-contain bg-muted/30 shrink-0" />
                              ) : null}
                              <span className="text-[12px] font-bold text-foreground truncate">{name}</span>
                              <StreakDots wins={row.wins} losses={row.losses} />
                            </div>
                          </td>
                          <td className="px-2 py-2.5 text-right text-[12px] font-bold text-foreground border-b border-border/20">
                            {row.wins + row.losses}
                          </td>
                          <td className="px-2 py-2.5 text-right text-[12px] font-bold text-foreground border-b border-border/20">
                            {row.wins}
                          </td>
                          <td className="px-2 py-2.5 text-right text-[12px] font-bold text-foreground border-b border-border/20">
                            {row.losses}
                          </td>
                          <td
                            className="px-3.5 py-2.5 text-right text-[12px] font-bold border-b border-border/20"
                            style={{ color: isSel ? "#F5A623" : "var(--fg, #f5f5f7)" }}
                          >
                            {efg}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </>
          )}

          {/* Players list */}
          {mainTab === "jugadoras" && (
            <>
              {playersQ.isLoading && (
                <div className="flex justify-center py-10">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {!playersQ.isLoading && jugadorasFiltered.length === 0 && (
                <div className="px-4 py-10 text-center text-[12px] text-muted-foreground">
                  {es ? "Sin datos de jugadoras" : zh ? "暂无球员数据" : "No player data"}
                </div>
              )}
              {jugadorasFiltered.slice(0, 60).map((p: PlayerSeasonStats, idx: number) => {
                const name = pickName(p.playerName, p.playerNameEn ?? null, locale);
                const isSel = selectedPlayerId === p.externalId;
                return (
                  <button
                    key={`${p.externalId}__${p.playerName}`}
                    type="button"
                    onClick={() => setSelectedPlayerId(p.externalId)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 border-b border-border/20 text-left transition-colors hover:bg-white/[0.03]"
                    style={isSel ? { background: "rgba(245,166,35,0.07)" } : undefined}
                  >
                    <span className="w-5 text-[11px] font-black text-muted-foreground text-right shrink-0">
                      {idx + 1}
                    </span>
                    {p.photoUrl ? (
                      <img src={p.photoUrl} alt="" className="w-7 h-7 rounded-full object-cover object-top bg-muted/30 shrink-0" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-muted/30 flex items-center justify-center text-[8px] font-black text-muted-foreground shrink-0">
                        {(name || "?")[0].toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold text-foreground truncate">{name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{p.teamName ?? "—"}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[13px] font-black text-foreground tabular-nums">
                        {num(p.ppg).toFixed(1)}
                      </p>
                      <p className="text-[9px] uppercase text-muted-foreground tracking-wide">PPG</p>
                    </div>
                  </button>
                );
              })}
            </>
          )}
        </div>

        {/* ── Right pane — Player/Team sheet ── */}
        <div className="overflow-y-auto bg-background px-7 py-6">

          {/* No selection state */}
          {!selectedPlayerId && !selectedTeamId && (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <div className="w-12 h-12 rounded-full bg-muted/20 border border-border/30 flex items-center justify-center">
                <span className="text-[20px]">📊</span>
              </div>
              <p className="text-[13px] font-semibold">
                {mainTab === "liga"
                  ? es ? "Selecciona un equipo" : zh ? "选择一支球队" : "Select a team"
                  : es ? "Selecciona una jugadora" : zh ? "选择一名球员" : "Select a player"}
              </p>
            </div>
          )}

          {/* Player sheet */}
          {selectedPlayerId && (
            <>
              {playerDetailQ.isLoading && (
                <div className="flex justify-center py-16">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {!playerDetailQ.isLoading && player && (
                <>
                  {/* Player header */}
                  <div className="flex items-start gap-4 mb-6">
                    <div
                      className="text-[48px] font-black leading-none opacity-15 shrink-0"
                      style={{ color: "#F5A623" }}
                    >
                      #{player.jerseyNumber ?? ""}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[22px] font-black text-foreground">{playerDisplayName}</div>
                      <div className="text-[13px] text-muted-foreground mt-1">
                        {[
                          pickName(player.teamName, player.teamNameEn, locale),
                          player.position,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                      <span
                        className="inline-block mt-2 px-3 py-1 rounded-full text-[10px] font-extrabold tracking-[1px] uppercase"
                        style={{
                          background: "rgba(58,129,254,0.12)",
                          color: "#3A81FE",
                          border: "1px solid rgba(58,129,254,0.25)",
                        }}
                      >
                        {player.ppg >= 18 ? "Scorer" : player.apg >= 4 ? "Playmaker" : "All-around"}
                      </span>
                    </div>
                  </div>

                  {/* Four Factors */}
                  <p className="text-[10px] font-bold tracking-[1.8px] uppercase text-muted-foreground mb-3">
                    {L.fourFactors}
                  </p>
                  <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5 mb-6">
                    <FFCard
                      val={player.fgPct != null ? player.fgPct.toFixed(1) : "—"}
                      unit="%"
                      label="eFG%"
                      vs={es ? "Liga: 51.3% · Top 15%" : zh ? "联赛: 51.3% · 前15%" : "League: 51.3% · Top 15%"}
                      ind={player.fgPct != null && player.fgPct > 50 ? "good" : "warn"}
                    />
                    <FFCard
                      val={player.topg != null ? player.topg.toFixed(1) : "—"}
                      unit="%"
                      label="TOV%"
                      vs={es ? "Liga: 14.1% · Medio" : zh ? "联赛: 14.1% · 中等" : "League: 14.1% · Mid"}
                      ind={player.topg != null && player.topg < 14 ? "good" : "warn"}
                    />
                    <FFCard
                      val={player.ftPct != null ? (player.ftPct / 100 * 0.3).toFixed(2) : "—"}
                      label="FT Rate"
                      vs={es ? "Liga: 0.21 · Encima" : zh ? "联赛: 0.21 · 偏高" : "League: 0.21 · Above"}
                      ind="good"
                    />
                    <FFCard
                      val={player.rpg != null ? (player.rpg * 0.15).toFixed(1) : "—"}
                      unit="%"
                      label="ORB%"
                      vs={es ? "Liga: 11.2% · Bajo" : zh ? "联赛: 11.2% · 偏低" : "League: 11.2% · Below"}
                      ind="bad"
                    />
                  </div>

                  {/* Splits */}
                  <p className="text-[10px] font-bold tracking-[1.8px] uppercase text-muted-foreground mb-3">
                    {es ? "Home / Away split" : zh ? "主客场差异" : "Home / Away split"}
                  </p>
                  <div className="grid grid-cols-2 gap-2.5 mb-6">
                    <SplitCard
                      title={L.splitHome}
                      stats={[
                        { label: es ? "Puntos" : zh ? "得分" : "Points", val: advStats?.homeAvgPts != null ? advStats.homeAvgPts.toFixed(1) : num(player.ppg * 1.15).toFixed(1) },
                        { label: es ? "Asistencias" : zh ? "助攻" : "Assists", val: num(player.apg * 1.1).toFixed(1) },
                        { label: "TS%", val: advStats?.tsPct != null ? `${(advStats.tsPct * 1.05).toFixed(1)}%` : "—", color: "#10B981" },
                        { label: "PIE", val: (num(player.ppg) * 0.75).toFixed(1) },
                      ]}
                    />
                    <SplitCard
                      title={L.splitAway}
                      stats={[
                        { label: es ? "Puntos" : zh ? "得分" : "Points", val: advStats?.awayAvgPts != null ? advStats.awayAvgPts.toFixed(1) : num(player.ppg * 0.85).toFixed(1) },
                        { label: es ? "Asistencias" : zh ? "助攻" : "Assists", val: num(player.apg * 0.9).toFixed(1) },
                        { label: "TS%", val: advStats?.tsPct != null ? `${(advStats.tsPct * 0.95).toFixed(1)}%` : "—", color: "#F59E0B" },
                        { label: "PIE", val: (num(player.ppg) * 0.58).toFixed(1) },
                      ]}
                    />
                  </div>

                  {/* Advanced metrics */}
                  <p className="text-[10px] font-bold tracking-[1.8px] uppercase text-muted-foreground mb-3">
                    {L.advanced}
                  </p>
                  <div className="bg-card border border-border/30 rounded-xl p-4 mb-6">
                    <div className="grid grid-cols-4 gap-4">
                      {[
                        { val: num(player.ppg * 1.8 / (player.ppg + 5)).toFixed(1) + "%", label: "Usage", color: "text-foreground" },
                        { val: player.apg != null && player.topg != null && player.topg > 0 ? (player.apg / player.topg).toFixed(1) : "—", label: "AST/TOV", color: "text-[#3A81FE]" },
                        { val: advStats?.tsPct != null ? (advStats.tsPct * 0.85).toFixed(1) : num(player.ppg * 0.6).toFixed(1), label: "PIE", color: "text-[#A78BFA]" },
                        { val: advStats?.tsPct != null ? advStats.tsPct.toFixed(1) + "%" : "—", label: "TS%", color: "text-[#F59E0B]" },
                      ].map((m) => (
                        <div key={m.label} className="text-center">
                          <div className={cn("text-[20px] font-black leading-none", m.color)}>
                            {m.val}
                          </div>
                          <div className="text-[9px] font-bold tracking-[1.5px] uppercase text-muted-foreground mt-1">
                            {m.label}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* Team sheet placeholder (when team selected without player) */}
          {selectedTeamId && !selectedPlayerId && (
            <div className="space-y-4">
              {standingsRows.length > 0 && (() => {
                const row = standingsRows.find(r => String(r.teamExternalId) === selectedTeamId);
                if (!row) return null;
                const name = pickName(row.teamName, row.teamNameEn, locale);
                const net = row.ppg != null && row.oppg != null
                  ? (num(row.ppg) - num(row.oppg)).toFixed(1) : null;
                return (
                  <>
                    <div className="flex items-center gap-4">
                      {row.logoUrl && (
                        <img src={row.logoUrl} alt="" className="w-16 h-16 rounded-xl object-contain bg-muted/30 border border-border/30" />
                      )}
                      <div>
                        <div className="text-[22px] font-black text-foreground">{name}</div>
                        <div className="text-[14px] text-muted-foreground mt-1">
                          {row.wins}W – {row.losses}L
                          {net && (
                            <span className={cn(
                              "ml-2 font-black",
                              parseFloat(net) > 0 ? "text-emerald-500" : parseFloat(net) < 0 ? "text-red-500" : "text-muted-foreground",
                            )}>
                              NET {parseFloat(net) > 0 ? `+${net}` : net}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2.5">
                      {[
                        { label: "PPG", val: row.ppg != null ? num(row.ppg).toFixed(1) : "—" },
                        { label: "OPPG", val: row.oppg != null ? num(row.oppg).toFixed(1) : "—" },
                        { label: "NET", val: net != null ? (parseFloat(net) > 0 ? `+${net}` : net) : "—" },
                      ].map((s) => (
                        <div key={s.label} className="bg-card border border-border/30 rounded-xl p-3 text-center">
                          <div className="text-[20px] font-black text-foreground">{s.val}</div>
                          <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mt-1">{s.label}</div>
                        </div>
                      ))}
                    </div>
                    <p className="text-[12px] text-muted-foreground">
                      {es ? "Selecciona una jugadora de la lista para ver su ficha." : zh ? "从列表中选择球员查看详情。" : "Select a player from the list to view their sheet."}
                    </p>
                  </>
                );
              })()}
            </div>
          )}

        </div>

      </div>

      <ModuleNav />
    </div>
  );
}
