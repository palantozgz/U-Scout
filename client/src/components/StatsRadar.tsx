/**
 * StatsRadar — 6-axis radar, dual-mode (compact/full)
 * Normalisation: leagueAvg → 0.65, p95 → 1.0
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

// avg → 0.65, p95 → 1.0. Below avg: linear 0→0.65. Above avg: linear 0.65→1.0.
const AVG_NORM = 0.65;
function norm(val: number, avg: number, p95: number): number {
  if (p95 <= avg) return Math.min(1, Math.max(0, val / (p95 || 1)));
  if (val >= avg) return AVG_NORM + (1 - AVG_NORM) * Math.min(1, (val - avg) / (p95 - avg));
  return AVG_NORM * Math.max(0, val / avg);
}

// Grid rings at these normalised values — 0.65 matches avg
const RINGS = [0.25, AVG_NORM, 0.85, 1.0];

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

function accent(): { stroke: string; dot: string } {
  if (typeof window === "undefined") return { stroke: "#FBBF24", dot: "#FDE68A" };
  const root = document.documentElement;
  if (root.classList.contains("theme-office"))    return { stroke: "#4F46E5", dot: "#818CF8" };
  if (root.classList.contains("theme-oldschool")) return { stroke: "#2DD4BF", dot: "#5EEAD4" };
  return { stroke: "#FBBF24", dot: "#FDE68A" };
}

export interface StatsRadarProps {
  player:            PlayerDetail;
  locale?:           string;
  compact?:          boolean;
  positionLabel?:    string | null;
  /** Controlled toggle state from parent */
  byPosition?:       boolean;
  onTogglePosition?: () => void;
  /** Filtered league data passed from parent when toggle is active */
  leagueAvgData?:    { ppg: number; rpg: number; apg: number; spg: number; bpg: number; fgPct: number | null } | null;
  percentilesData?:  { p95Ppg: number; p95Rpg: number; p95Apg: number; p95Spg: number; p95Bpg: number; p95TsPct: number; p95EFGPct: number } | null;
}

export function StatsRadar({
  player, locale, compact = false, positionLabel,
  byPosition, onTogglePosition,
  leagueAvgData, percentilesData,
}: StatsRadarProps) {
  const es = locale === "es";
  const zh = locale === "zh";

  // Uncontrolled fallback (standalone use)
  const [internalByPos, setInternalByPos] = useState(false);
  const isControlled = byPosition !== undefined;
  const activeByPos  = isControlled ? (byPosition ?? false) : internalByPos;
  const togglePos    = isControlled
    ? (onTogglePosition ?? (() => {}))
    : () => setInternalByPos((v) => !v);

  // When controlled, parent passes league data. When uncontrolled, fetch internally.
  const filterPos = !isControlled && activeByPos ? (player.position ?? null) : null;
  const leagueQ      = useLeagueAverages(undefined, isControlled ? null : filterPos);
  const percentilesQ = usePlayerPercentiles(undefined, isControlled ? null : filterPos);

  // Resolve which data to use: controlled props override internal fetch
  const league      = isControlled ? (leagueAvgData ?? leagueQ.data) : leagueQ.data;
  const percentiles = isControlled ? (percentilesData ?? percentilesQ.data) : percentilesQ.data;

  const [col, setCol] = useState({ grid: "rgba(128,128,128,0.18)", label: "rgba(200,180,140,0.75)", ...accent() });
  useEffect(() => {
    setCol({
      grid:  cssVar("--border").replace("hsl(", "hsla(").replace(")", ", 0.25)"),
      label: cssVar("--foreground").replace("hsl(", "hsla(").replace(")", ", 0.55)"),
      ...accent(),
    });
  }, []);

  const normalized = AXES.map((ax) => {
    const val = ax.getVal(player);
    const avg = league      ? (league[ax.avgKey]      ?? null) : null;
    const p95 = percentiles ? (percentiles[ax.p95Key] ?? null) : null;
    return avg != null && p95 != null
      ? norm(val, avg, p95)
      : Math.min(1, Math.max(0, val / ax.fallbackMax));
  });

  // Geometry
  const R   = compact ? 52 : 72;
  const LP  = compact ? 30 : 42;
  const VF  = compact ? 11 : 14;
  const KF  = compact ? 7.5 : 10;
  const PAD = compact ? 14 : 20;

  const totW = (R + LP + PAD) * 2 + (compact ? 60 : 80);
  const totH = totW;
  const CX   = totW / 2;
  const CY   = totH / 2;

  const rings    = RINGS.map((t) => poly(Array(N).fill(t), R, CX, CY));
  const avgPoly  = poly(Array(N).fill(AVG_NORM), R, CX, CY);
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
      <svg viewBox={`0 0 ${totW} ${totH}`} width="100%" style={{ display: "block" }} aria-label="radar">
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

          {/* Grid rings — uniform subtle style, no special highlight */}
          {rings.map((pts, i) => (
            <polygon key={i} points={pts}
              fill="transparent"
              stroke={col.grid}
              strokeWidth={i === RINGS.length - 1 ? 0.9 : 0.5}
              strokeOpacity={i === RINGS.length - 1 ? 0.4 : 0.18}
              strokeDasharray="none"
            />
          ))}

          {/* avg label */}
          {(() => {
            const [rx, ry] = polar(0, AVG_NORM * R, CX, CY);
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

          {/* League avg polygon — dashed, single line */}
          {league && (
            <polygon points={avgPoly} fill="none"
              stroke={col.stroke} strokeWidth={1.2} strokeDasharray="4 3" strokeOpacity={0.5}/>
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

          {/* Labels */}
          {labels.map(({ key, raw, lx, ly, anchor }) => (
            <g key={key}>
              <text x={lx} y={ly - 4} textAnchor={anchor}
                fill={col.dot} fontSize={KF} fontWeight={700} opacity={0.7}
                letterSpacing="0.06em" fontFamily="Inter,system-ui,sans-serif">
                {key}
              </text>
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
              <line x1="0" y1="2" x2="14" y2="2" stroke={col.stroke} strokeWidth="1.2" strokeDasharray="3 2" opacity="0.6"/>
            </svg>
            <span style={{ color: col.label, opacity: 0.65 }} className="text-[8px] font-bold uppercase tracking-wide">
              {activeByPos
                ? (es ? "Media posición" : zh ? "位置均值" : "Position avg")
                : (es ? "Media liga" : zh ? "均值" : "League avg")}
            </span>
          </div>
        )}
      </div>

      {/* Position filter toggle */}
      {(positionLabel || player.position) && (
        <div className="flex items-center justify-center mt-1 pb-1">
          <button
            type="button"
            onClick={togglePos}
            className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[8px] font-black uppercase tracking-wide transition-colors"
            style={{
              borderColor: activeByPos ? col.stroke : "rgba(128,128,128,0.25)",
              background:  activeByPos ? `${col.stroke}18` : "transparent",
              color:       activeByPos ? col.dot : "rgba(180,160,120,0.5)",
            }}
          >
            <span style={{ fontSize: 9 }}>{activeByPos ? "●" : "○"}</span>
            {activeByPos
              ? (positionLabel ?? (es ? "Misma posición" : zh ? "同位置" : "Same position"))
              : (es ? "Liga completa" : zh ? "全联赛" : "All positions")}
          </button>
        </div>
      )}
    </div>
  );
}
