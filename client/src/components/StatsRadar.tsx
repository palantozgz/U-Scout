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

function accent(): { stroke: string; dot: string } {
  if (typeof window === "undefined") return { stroke: "#FBBF24", dot: "#FDE68A" };
  const root = document.documentElement;
  if (root.classList.contains("theme-office"))    return { stroke: "#4F46E5", dot: "#818CF8" };
  if (root.classList.contains("theme-oldschool")) return { stroke: "#2DD4BF", dot: "#5EEAD4" };
  return { stroke: "#FBBF24", dot: "#FDE68A" };
}

export interface StatsRadarProps {
  player:   PlayerDetail;
  locale?:  string;
  /** compact=true for iOS (375px), false for desktop panel */
  compact?: boolean;
}

export function StatsRadar({ player, locale, compact = false }: StatsRadarProps) {
  const es = locale === "es";
  const zh = locale === "zh";
  const leagueQ      = useLeagueAverages();
  const percentilesQ = usePlayerPercentiles();

  const [col, setCol] = useState({ grid: "rgba(128,128,128,0.18)", label: "rgba(180,160,120,0.65)", value: "#f0e8d8", ...accent() });

  useEffect(() => {
    setCol({
      grid:   cssVar("--border").replace("hsl(", "hsla(").replace(")", ", 0.22)"),
      label:  cssVar("--muted-foreground").replace("hsl(", "hsla(").replace(")", ", 0.65)"),
      value:  cssVar("--foreground"),
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

  // Geometry — two sizes
  const R  = compact ? 72 : 108;
  const CX = compact ? 90 : 130;
  const CY = compact ? 90 : 130;
  const LP = compact ? 30 : 42;   // label pad
  const VF = compact ? 10 : 15;   // value font
  const KF = compact ? 7.5 : 10;  // key font

  const totW = (CX + R + LP + (compact ? 30 : 44)) * 2;
  const totH = totW;
  const ox = totW / 2 - CX;
  const oy = totH / 2 - CY;

  const rings   = [0.25, 0.5, 0.75, 1.0].map((t) => poly(Array(N).fill(t), R, CX, CY));
  const avgPoly = poly(Array(N).fill(0.5), R, CX, CY);
  const plrPoly = poly(normalized, R, CX, CY);
  const axisTips = AXES.map((_, i) => polar((360 / N) * i, R, CX, CY));
  const dots     = normalized.map((v, i) => { const [x,y] = polar((360/N)*i, v*R, CX, CY); return {x,y}; });
  const labels   = AXES.map((ax, i) => {
    const [lx, ly] = polar((360/N)*i, R + LP, CX, CY);
    const dx = lx - CX;
    const anchor: "middle"|"start"|"end" = Math.abs(dx) < 10 ? "middle" : dx > 0 ? "start" : "end";
    return { key: ax.key, raw: ax.getRaw(player), lx, ly, anchor };
  });

  const gId = "rg"; const fId = "rf"; const bId = "rb";

  return (
    <div className="flex flex-col w-full">
      <svg viewBox={`0 0 ${totW} ${totH}`} width="100%" style={{ display:"block", overflow:"visible" }} aria-label="radar">
        <defs>
          <filter id={gId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={compact ? 4 : 6} result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <radialGradient id={fId} cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor={col.stroke} stopOpacity="0.22"/>
            <stop offset="100%" stopColor={col.stroke} stopOpacity="0.02"/>
          </radialGradient>
          <radialGradient id={bId} cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor={col.stroke} stopOpacity="0.05"/>
            <stop offset="100%" stopColor={col.stroke} stopOpacity="0"/>
          </radialGradient>
        </defs>
        <g transform={`translate(${ox},${oy})`}>
          <circle cx={CX} cy={CY} r={R*0.92} fill={`url(#${bId})`}/>
          {rings.map((pts, i) => (
            <polygon key={i} points={pts}
              fill={i%2===0 ? `${col.stroke}08` : "transparent"}
              stroke={i===1 ? col.stroke : col.grid}
              strokeWidth={i===1 ? 1.2 : i===3 ? 1 : 0.6}
              strokeOpacity={i===1 ? 0.45 : i===3 ? 0.5 : 0.18}
              strokeDasharray={i===1 ? "4 3" : "none"}
            />
          ))}
          {/* avg label near top axis */}
          {(() => { const [rx,ry] = polar(0, 0.5*R, CX, CY); return (
            <text x={rx+4} y={ry} textAnchor="start" dominantBaseline="middle"
              fill={col.stroke} fontSize={compact ? 6 : 7} fontWeight={700} opacity={0.55}
              fontFamily="Inter,system-ui,sans-serif">
              {es ? "media" : zh ? "均值" : "avg"}
            </text>
          ); })()}
          {axisTips.map(([x2,y2],i) => (
            <line key={i} x1={CX} y1={CY} x2={x2} y2={y2} stroke={col.grid} strokeWidth={0.7} strokeOpacity={0.28}/>
          ))}
          {league && (
            <polygon points={avgPoly} fill="none" stroke={col.stroke} strokeWidth={1} strokeDasharray="3 4" strokeOpacity={0.38}/>
          )}
          <polygon points={plrPoly} fill={`url(#${fId})`} stroke="none"/>
          <polygon points={plrPoly} fill="none" stroke={col.stroke} strokeWidth={compact ? 1.8 : 2.2}
            strokeLinejoin="round" filter={`url(#${gId})`} opacity={0.95}/>
          {dots.map((d,i) => (
            <g key={i}>
              <circle cx={d.x} cy={d.y} r={compact ? 6 : 8} fill={col.dot} opacity={0.14}/>
              <circle cx={d.x} cy={d.y} r={compact ? 3 : 4} fill={col.dot}/>
            </g>
          ))}
          {labels.map(({key,raw,lx,ly,anchor}) => (
            <g key={key}>
              <text x={lx} y={ly-5} textAnchor={anchor} fill={col.label}
                fontSize={KF} fontWeight={700} letterSpacing="0.1em" opacity={0.7}
                fontFamily="Inter,system-ui,sans-serif">{key}</text>
              <text x={lx} y={ly+(compact?8:11)} textAnchor={anchor} fill={col.dot}
                fontSize={VF} fontWeight={900}
                fontFamily="Inter,system-ui,sans-serif">{raw}</text>
            </g>
          ))}
          <circle cx={CX} cy={CY} r={2.5} fill={col.stroke} opacity={0.45}/>
        </g>
      </svg>
      {/* Legend */}
      <div className="flex items-center justify-center gap-4 -mt-1 pb-1">
        <div className="flex items-center gap-1.5">
          <svg width="14" height="4"><line x1="0" y1="2" x2="14" y2="2" stroke={col.stroke} strokeWidth="2" strokeLinecap="round"/></svg>
          <span style={{color:col.label}} className="text-[7px] font-bold uppercase tracking-wide">
            {es?"Jugadora":zh?"球员":"Player"}
          </span>
        </div>
        {league && (
          <div className="flex items-center gap-1.5">
            <svg width="14" height="4"><line x1="0" y1="2" x2="14" y2="2" stroke={col.stroke} strokeWidth="1" strokeDasharray="2 2" opacity="0.5"/></svg>
            <span style={{color:col.label,opacity:0.6}} className="text-[7px] font-bold uppercase tracking-wide">
              {es?"Liga avg":zh?"均值":"Liga avg"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
