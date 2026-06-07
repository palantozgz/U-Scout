/**
 * StatsPlayerComparator — side-by-side radar + stat table for two players.
 * Uses PlayerSeasonStats (bulk endpoint) — no extra fetches needed.
 * Opens as a bottom sheet on mobile, inline panel on desktop.
 */
import { useState, useMemo } from "react";
import { X, Search } from "lucide-react";
import type { PlayerSeasonStats } from "@/lib/stats-api";
import { localName } from "@/lib/utils";
import { cn } from "@/lib/utils";

// ── Minimal radar (SVG, no recharts) ────────────────────────────────────────

const RADAR_AXES = [
  { key: "PPG", getVal: (p: PlayerSeasonStats) => p.ppg,        fallbackMax: 35 },
  { key: "RPG", getVal: (p: PlayerSeasonStats) => p.rpg,        fallbackMax: 15 },
  { key: "APG", getVal: (p: PlayerSeasonStats) => p.apg,        fallbackMax: 10 },
  { key: "SPG", getVal: (p: PlayerSeasonStats) => p.spg,        fallbackMax: 4  },
  { key: "BPG", getVal: (p: PlayerSeasonStats) => p.bpg,        fallbackMax: 4  },
  { key: "FG%", getVal: (p: PlayerSeasonStats) => p.fgPct ?? 0, fallbackMax: 65 },
] as const;
const N = RADAR_AXES.length;

function polar(deg: number, r: number, cx: number, cy: number): [number, number] {
  const a = (deg - 90) * (Math.PI / 180);
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}
function poly(vals: number[], r: number, cx: number, cy: number): string {
  return vals.map((v, i) => {
    const [x, y] = polar((360 / N) * i, v * r, cx, cy);
    return `${x},${y}`;
  }).join(" ");
}

function MiniRadar({
  player,
  maxVals,
  color,
}: {
  player: PlayerSeasonStats;
  maxVals: number[];
  color: string;
}) {
  const R = 52; const CX = 88; const CY = 88;
  const normalized = RADAR_AXES.map((ax, i) =>
    maxVals[i] > 0 ? Math.min(1, ax.getVal(player) / maxVals[i]) : 0,
  );
  const rings = [0.25, 0.5, 0.75, 1.0];
  const plrPoly = poly(normalized, R, CX, CY);
  const axisTips = RADAR_AXES.map((_, i) => polar((360 / N) * i, R, CX, CY));
  const labels = RADAR_AXES.map((ax, i) => {
    const [lx, ly] = polar((360 / N) * i, R + 22, CX, CY);
    const dx = lx - CX;
    const anchor: "middle" | "start" | "end" =
      Math.abs(dx) < 8 ? "middle" : dx > 0 ? "start" : "end";
    return { key: ax.key, lx, ly, anchor };
  });

  return (
    <svg viewBox="0 0 176 176" width="100%" style={{ display: "block" }}>
      {rings.map((t, i) => (
        <polygon
          key={i}
          points={poly(Array(N).fill(t), R, CX, CY)}
          fill="transparent"
          stroke="rgba(128,128,128,0.2)"
          strokeWidth={0.5}
        />
      ))}
      {axisTips.map(([x2, y2], i) => (
        <line key={i} x1={CX} y1={CY} x2={x2} y2={y2}
          stroke="rgba(128,128,128,0.2)" strokeWidth={0.5} />
      ))}
      <polygon points={plrPoly}
        fill={`${color}28`}
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {labels.map(({ key, lx, ly, anchor }) => (
        <text key={key} x={lx} y={ly} textAnchor={anchor}
          fill="rgba(160,140,100,0.7)" fontSize={8} fontWeight={700}
          fontFamily="Inter,system-ui,sans-serif">
          {key}
        </text>
      ))}
    </svg>
  );
}

// ── Stat comparison table ────────────────────────────────────────────────────

const STAT_ROWS: Array<{
  label: string;
  getVal: (p: PlayerSeasonStats) => number | null;
  fmt: (v: number) => string;
}> = [
  { label: "PPG",  getVal: p => p.ppg,         fmt: v => v.toFixed(1) },
  { label: "RPG",  getVal: p => p.rpg,         fmt: v => v.toFixed(1) },
  { label: "APG",  getVal: p => p.apg,         fmt: v => v.toFixed(1) },
  { label: "SPG",  getVal: p => p.spg,         fmt: v => v.toFixed(1) },
  { label: "BPG",  getVal: p => p.bpg,         fmt: v => v.toFixed(1) },
  { label: "FG%",  getVal: p => p.fgPct,       fmt: v => `${v.toFixed(1)}%` },
  { label: "eFG%", getVal: p => p.eFGPct,      fmt: v => `${v.toFixed(1)}%` },
  { label: "FT%",  getVal: p => p.ftPct,       fmt: v => `${v.toFixed(1)}%` },
  { label: "3P%",  getVal: p => p.fg3Pct,      fmt: v => `${v.toFixed(1)}%` },
  { label: "MPG",  getVal: p => p.mpg,         fmt: v => v.toFixed(1) },
  { label: "G",    getVal: p => p.games,       fmt: v => String(Math.round(v)) },
];

// ── Player search / selector ─────────────────────────────────────────────────

function PlayerPicker({
  all,
  selected,
  onSelect,
  locale,
  placeholder,
}: {
  all: PlayerSeasonStats[];
  selected: PlayerSeasonStats | null;
  onSelect: (p: PlayerSeasonStats) => void;
  locale: string;
  placeholder: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all.slice(0, 20);
    return all
      .filter(p => {
        const n = (p.playerName + " " + (p.playerNameEn ?? "")).toLowerCase();
        return n.includes(q);
      })
      .slice(0, 20);
  }, [all, query]);

  if (selected) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/5 px-3 py-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-foreground truncate">
            {localName(selected.playerName, selected.playerNameEn, locale) ?? selected.playerName}
          </p>
          <p className="text-[10px] text-muted-foreground truncate">{selected.teamName}</p>
        </div>
        <button
          type="button"
          onClick={() => { setQuery(""); setOpen(false); onSelect(null as any); }}
          className="shrink-0 p-1 rounded-lg text-muted-foreground hover:text-foreground"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
        <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/50 outline-none"
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-xl border border-border bg-card shadow-lg overflow-hidden max-h-48 overflow-y-auto">
          {filtered.map(p => (
            <button
              key={p.externalId}
              type="button"
              onClick={() => { onSelect(p); setOpen(false); setQuery(""); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-foreground truncate">
                  {localName(p.playerName, p.playerNameEn, locale) ?? p.playerName}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">{p.teamName}</p>
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0">{p.ppg.toFixed(1)} PPG</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export interface StatsPlayerComparatorProps {
  allPlayers: PlayerSeasonStats[];
  initialA?: PlayerSeasonStats | null;
  initialB?: PlayerSeasonStats | null;
  locale: string;
  onClose?: () => void;
}

export function StatsPlayerComparator({
  allPlayers,
  initialA = null,
  initialB = null,
  locale,
  onClose,
}: StatsPlayerComparatorProps) {
  const [playerA, setPlayerA] = useState<PlayerSeasonStats | null>(initialA);
  const [playerB, setPlayerB] = useState<PlayerSeasonStats | null>(initialB);

  const es = locale === "es";
  const zh = locale === "zh";

  // Max vals for radar normalisation = max across all players
  const maxVals = useMemo(
    () =>
      RADAR_AXES.map(ax =>
        Math.max(...allPlayers.map(p => ax.getVal(p)), 1),
      ),
    [allPlayers],
  );

  const COLOR_A = "#FBBF24"; // amber (matches gamenight theme)
  const COLOR_B = "#60A5FA"; // blue

  const playerName = (p: PlayerSeasonStats) =>
    localName(p.playerName, p.playerNameEn, locale) ?? p.playerName;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div>
          <p className="text-sm font-black text-foreground">
            {es ? "Comparar jugadoras" : zh ? "球员对比" : "Compare Players"}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {es ? "Radar + estadísticas" : zh ? "雷达图 + 数据" : "Radar + stats"}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 px-4 py-3 space-y-4">
        {/* Player selectors */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLOR_A }} />
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                {es ? "Jugadora A" : zh ? "球员 A" : "Player A"}
              </span>
            </div>
            <PlayerPicker
              all={allPlayers}
              selected={playerA}
              onSelect={p => setPlayerA(p || null)}
              locale={locale}
              placeholder={es ? "Buscar..." : zh ? "搜索..." : "Search..."}
            />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLOR_B }} />
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                {es ? "Jugadora B" : zh ? "球员 B" : "Player B"}
              </span>
            </div>
            <PlayerPicker
              all={allPlayers}
              selected={playerB}
              onSelect={p => setPlayerB(p || null)}
              locale={locale}
              placeholder={es ? "Buscar..." : zh ? "搜索..." : "Search..."}
            />
          </div>
        </div>

        {/* Radars */}
        {(playerA || playerB) && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-card p-2">
              {playerA ? (
                <>
                  <p className="text-[10px] font-black text-center text-foreground truncate mb-1 px-1">
                    {playerName(playerA)}
                  </p>
                  <MiniRadar player={playerA} maxVals={maxVals} color={COLOR_A} />
                </>
              ) : (
                <div className="flex items-center justify-center h-32 text-[10px] text-muted-foreground">
                  {es ? "Sin selección" : zh ? "未选择" : "Not selected"}
                </div>
              )}
            </div>
            <div className="rounded-xl border border-border bg-card p-2">
              {playerB ? (
                <>
                  <p className="text-[10px] font-black text-center text-foreground truncate mb-1 px-1">
                    {playerName(playerB)}
                  </p>
                  <MiniRadar player={playerB} maxVals={maxVals} color={COLOR_B} />
                </>
              ) : (
                <div className="flex items-center justify-center h-32 text-[10px] text-muted-foreground">
                  {es ? "Sin selección" : zh ? "未选择" : "Not selected"}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stat table */}
        {playerA && playerB && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {/* Header row */}
            <div className="grid grid-cols-[1fr_2fr_1fr] bg-muted/30 px-3 py-2 border-b border-border">
              <span className="text-[10px] font-black text-foreground truncate text-right pr-2">
                {playerName(playerA)}
              </span>
              <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground text-center" />
              <span className="text-[10px] font-black text-foreground truncate text-left pl-2">
                {playerName(playerB)}
              </span>
            </div>
            {STAT_ROWS.map(({ label, getVal, fmt }) => {
              const va = getVal(playerA);
              const vb = getVal(playerB);
              const aWins = va != null && vb != null && va > vb;
              const bWins = va != null && vb != null && vb > va;
              return (
                <div
                  key={label}
                  className="grid grid-cols-[1fr_2fr_1fr] px-3 py-2 border-b border-border/40 last:border-0 items-center"
                >
                  <span
                    className={cn(
                      "text-xs font-black text-right pr-2 tabular-nums",
                      aWins ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {va != null ? fmt(va) : "—"}
                    {aWins && <span className="ml-1 text-[9px]">◀</span>}
                  </span>
                  <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground text-center">
                    {label}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-black text-left pl-2 tabular-nums",
                      bWins ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {bWins && <span className="mr-1 text-[9px]">▶</span>}
                    {vb != null ? fmt(vb) : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {!playerA && !playerB && (
          <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center space-y-1">
            <p className="text-sm font-semibold text-muted-foreground">
              {es ? "Selecciona dos jugadoras para comparar" : zh ? "选择两名球员进行比较" : "Select two players to compare"}
            </p>
            <p className="text-xs text-muted-foreground/60">
              {es ? "Busca por nombre en los selectores de arriba" : zh ? "在上方搜索框中搜索" : "Search by name above"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
