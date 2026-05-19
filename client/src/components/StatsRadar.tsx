/**
 * StatsRadar — 6-axis radar, dual-mode (compact/full)
 * Normalisation: leagueAvg → 0.5 (regular hexagon), p95 → 1.0
 * Accent colours per theme: gamenight=amber, office=indigo, oldschool=teal
 */
import { useEffect, useState } from "react";
import type { PlayerDetail } from "@/lib/stats-api";
import { useLeagueAverages, usePlayerPercentiles } from "@/lib/stats-api";

const AXES = [
  { key: "PPG" as const, fallbackMax: 35, getVal: (p: PlayerDetail) => p.ppg, getRaw: (p: PlayerDetail) => p.ppg.toFixed(1), avgKey: "ppg" as const, p95Key: "p95Ppg" as const },
  { key: "RPG" as const, fallbackMax: 15, getVal: (p: PlayerDetail) => p.rpg, getRaw: (p: PlayerDetail) => p.rpg.toFixed(1), avgKey: "rpg" as const, p95Key: "p95Rpg" as const },
  { key: "APG" as const, fallbackMax: 10, getVal: (p: PlayerDetail) => p.apg, getRaw: (p: PlayerDetail) => p.apg.toFixed(1), avgKey: "apg" as const, p95Key: "p95Apg" as const },
  { key: "SPG" as const, fallbackMax: 4,  getVal: (p: PlayerDetail) => p.spg, getRaw: (p: PlayerDetail) => p.spg.toFixed(1), avgKey: "spg" as const, p95Key: "p95Spg" as const },
  { key: "BPG" as const, fallbackMax: 4,  getVal: (p: PlayerDetail) => p.bpg, getRaw: (p: PlayerDetail) => p.bpg.toFixed(1), avgKey: "bpg" as const, p95Key: "p95Bpg" as const },
  { key: "FG%" as const, fallbackMax: 65, getVal: (p: PlayerDetail) => p.fgPct ?? 0, getRaw: (p: PlayerDetail) => p.fgPct != null ? `${p.fgPct.toFixed(1)}%` : "—", avgKey: "fgPct" as const, p95Key: "p95EFGPct" as const },
] as const;

const N = AXES.length;

function norm(val: number, avg: number, p95: number): number {
  if (p95 <= avg) return Math.min(1, Math.max(0, val / (p95 || 1)));
  if (val >= avg) return 0.5 + 0.5 * Math.min(1, (val - avg) / (p95 - avg));
  return 0.5 * Math.max(0, val / avg);
}

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

function cssVar(n: string): string {
  if (typeof window === "undefined") return "#888";
  const raw = getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  return raw ? `hsl(${raw})` : "#888";
}

function accent(): { stroke: string; dot: string; labelColor: string } {
  if (typeof window === "undefined") return { stroke: "#FBBF24", dot: "#FDE68A", labelColor: "#FDE68A" };
  const root = document.documentElement;
  if (root.classList.contains("theme-office"))    return { stroke: "#4F46E5", dot: "#818CF8", labelColor: "#818CF8" };
  if (root.classList.contains("theme-oldschool")) return { stroke: "#2DD4BF", dot: "#5EEAD4", labelColor: "#5EEAD4" };
  return { stroke: "#FBBF24", dot: "#FDE68A", labelColor: "#FDE68A" };
}

export interface StatsRadarProps {
  player:   PlayerDetail;
  locale?:  string;
  compact?: boolean;
  /** Position label already translated (e.g. "Center", "Guard") */
  positionLabel?: string | null;
}

export function StatsRadar({ player, locale, compact = false, positionLabel }: StatsRadarProps) {
  const es = locale === "es";
  const zh = locale === "zh";

  // Position filter toggle: null = all league, player.position = same position only
  const [byPosition, setByPosition] = useState(false);
  const filterPos = byPosition ? (player.position ?? null) : null;

  const leagueQ      = useLeagueAverages(undefined, filterPos);
  const percentilesQ = usePlayerPercentiles(undefined, filterPos);

  const [col, setCol] = useState({
    grid: "rgba(128,128,128,0.18)",
    label: "rgba(200,180,140,0.75)",
    ...accent(),
  });

  useEffect(() => {
    setCol({
      grid:  cssVar("--border").replace("hsl(", "hsla(").replace(")", ", 0.25)"),
      label: cssVar("--foreground").replace("hsl(", "hsla(").replace(")", ", 0.55)"),
      ...accent(),
    });
  }, []);

  const league      = leagueQ.data;
  const percentiles = percentilesQ.data;

  const normalized = AXES.map((ax) => {
    const val = ax.getVal(player);
    const avg = league      ? (league[ax.avgKey]      ?? null) : null;
    const p95 = percentiles ? (percentiles[ax.p95Key] ?? null) : null;
    return avg != null && p95 != null
      ? norm(val, avg, p95)
      : Math.min(1, Math.max(0, val / ax.fallbackMax));
  });

  // ── Geometry ──────────────────────────────────────────────────────────────
  // ALL labels must fit inside the viewBox — no overflow.
  // totW is the full SVG canvas including label space.
  const R   = compact ? 52 : 72;    // radar polygon radius
  const LP  = compact ? 30 : 42;    // label pad beyond R
  const VF  = compact ? 11 : 14;    // value font size
  const KF  = compact ? 7.5 : 10;   // key font size
  const PAD = compact ? 14 : 20;    // outer padding beyond label text

  // Centre is always at the midpoint of the canvas
  const totW = (R + LP + PAD) * 2 + (compact ? 60 : 80); // extra for side labels
  const totH = totW;
  const CX   = totW / 2;
  const CY   = totH / 2;
  const ox   = 0;
  const oy   = 0;

  const rings    = [0.25, 0.5, 0.75, 1.0].map((t) => poly(Array(N).fill(t), R, CX, CY));
  const avgPoly  = poly(Array(N).fill(0.5), R, CX, CY);
  const plrPoly  = poly(normalized, R, CX, CY);
  const axisTips = AXES.map((_, i) => polar((360 / N) * i, R, CX, CY));
  const dots     = normalized.map((v, i) => { const [x,y] = polar((360/N)*i, v*R, CX, CY); return {x,y}; });
  const labels   = AXES.map((ax, i) => {
    const [lx, ly] = polar((360/N)*i, R + LP, CX, CY);
    const dx = lx - CX;
    const anchor: "middle"|"start"|"end" = Math.abs(dx) < 8 ? "middle" : dx > 0 ? "start" : "end";
    return { key: ax.key, raw: ax.getRaw(player), lx, ly, anchor };
  });

  const gId = "rg"; const fId = "rf"; const bId = "rb";

  return (
    <div className="flex flex-col w-full">
      <svg
        viewBox={`0 0 ${totW} ${totH}`}
        width="100%"
        style={{ display: "block" }}
        aria-label="radar"
      >
        <defs>
          <filter id={gId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={compact ? 3 : 5} result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <radialGradient id={fId} cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor={col.stroke} stopOpacity="0.20"/>
            <stop offset="100%" stopColor={col.stroke} stopOpacity="0.02"/>
          </radialGradient>
          <radialGradient id={bId} cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor={col.stroke} stopOpacity="0.04"/>
            <stop offset="100%" stopColor={col.stroke} stopOpacity="0"/>
          </radialGradient>
        </defs>

        <g>
          <circle cx={CX} cy={CY} r={R * 0.92} fill={`url(#${bId})`}/>

          {/* Grid rings */}
          {rings.map((pts, i) => (
            <polygon key={i} points={pts}
              fill="transparent"
              stroke={i === 1 ? col.stroke : col.grid}
              strokeWidth={i === 1 ? 1.2 : i === 3 ? 0.9 : 0.5}
              strokeOpacity={i === 1 ? 0.5 : i === 3 ? 0.45 : 0.18}
              strokeDasharray={i === 1 ? "4 3" : "none"}
            />
          ))}

          {/* avg label */}
          {(() => {
            const [rx, ry] = polar(0, 0.5 * R, CX, CY);
            return (
              <text x={rx + 4} y={ry} textAnchor="start" dominantBaseline="middle"
                fill={col.stroke} fontSize={compact ? 6 : 8} fontWeight={700} opacity={0.6}
                fontFamily="Inter,system-ui,sans-serif">
                {es ? "media" : zh ? "均值" : "avg"}
              </text>
            );
          })()}

          {/* Axis lines */}
          {axisTips.map(([x2, y2], i) => (
            <line key={i} x1={CX} y1={CY} x2={x2} y2={y2}
              stroke={col.grid} strokeWidth={0.7} strokeOpacity={0.25}/>
          ))}

          {/* League avg polygon */}
          {league && (
            <polygon points={avgPoly} fill="none"
              stroke={col.stroke} strokeWidth={1} strokeDasharray="3 4" strokeOpacity={0.4}/>
          )}

          {/* Player fill */}
          <polygon points={plrPoly} fill={`url(#${fId})`} stroke="none"/>

          {/* Player stroke with glow */}
          <polygon points={plrPoly} fill="none"
            stroke={col.stroke} strokeWidth={compact ? 1.8 : 2.2}
            strokeLinejoin="round" filter={`url(#${gId})`} opacity={0.95}/>

          {/* Dots */}
          {dots.map((d, i) => (
            <g key={i}>
              <circle cx={d.x} cy={d.y} r={compact ? 5 : 7} fill={col.dot} opacity={0.14}/>
              <circle cx={d.x} cy={d.y} r={compact ? 2.5 : 3.5} fill={col.dot}/>
            </g>
          ))}

          {/* Labels — key above, value below */}
          {labels.map(({ key, raw, lx, ly, anchor }) => (
            <g key={key}>
              {/* key label */}
              <text x={lx} y={ly - 4} textAnchor={anchor}
                fill={col.dot} fontSize={KF} fontWeight={700} opacity={0.7}
                letterSpacing="0.06em" fontFamily="Inter,system-ui,sans-serif">
                {key}
              </text>
              {/* value */}
              <text x={lx} y={ly + (compact ? 9 : 13)} textAnchor={anchor}
                fill={col.dot} fontSize={VF} fontWeight={900}
                fontFamily="Inter,system-ui,sans-serif">
                {raw}
              </text>
            </g>
          ))}

          <circle cx={CX} cy={CY} r={2} fill={col.stroke} opacity={0.4}/>
        </g>
      </svg>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 -mt-1 pb-1">
        <div className="flex items-center gap-1.5">
          <svg width="14" height="4">
            <line x1="0" y1="2" x2="14" y2="2" stroke={col.stroke} strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <span style={{ color: col.label }} className="text-[8px] font-bold uppercase tracking-wide">
            {es ? "Jugadora" : zh ? "球员" : "Player"}
          </span>
        </div>
        {league && (
          <div className="flex items-center gap-1.5">
            <svg width="14" height="4">
              <line x1="0" y1="2" x2="14" y2="2" stroke={col.stroke} strokeWidth="1" strokeDasharray="2 2" opacity="0.5"/>
            </svg>
            <span style={{ color: col.label, opacity: 0.6 }} className="text-[8px] font-bold uppercase tracking-wide">
              {es ? "Media liga" : zh ? "均值" : "League avg"}
            </span>
          </div>
        )}
      </div>

      {/* Position filter toggle */}
      {(positionLabel || player.position) && (
        <div className="flex items-center justify-center mt-1 pb-1">
          <button
            type="button"
            onClick={() => setByPosition((v) => !v)}
            className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[8px] font-black uppercase tracking-wide transition-colors"
            style={{
              borderColor: byPosition ? col.stroke : "rgba(128,128,128,0.25)",
              background:  byPosition ? `${col.stroke}18` : "transparent",
              color:       byPosition ? col.dot : "rgba(180,160,120,0.5)",
            }}
          >
            <span style={{ fontSize: 9 }}>{byPosition ? "●" : "○"}</span>
            {byPosition
              ? (positionLabel ?? (es ? "Misma posición" : zh ? "同位置" : "Same position"))
              : (es ? "Liga completa" : zh ? "全联赛" : "All positions")}
          </button>
        </div>
      )}
    </div>
  );
}
