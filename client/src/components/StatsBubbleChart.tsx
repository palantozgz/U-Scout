/**
 * StatsBubbleChart — Scatter plot: X=eFG%, Y=PPG, radius=games
 * Pure SVG, no recharts (safe for iOS/WebKit).
 * Crosshairs at league averages. Tappable bubbles open player sheet.
 */
import { useState, useCallback, useRef } from "react";
import type { PlayerSeasonStats } from "@/lib/stats-api";
import type { LeagueAverages } from "@/lib/stats-api";
import { localName } from "@/lib/utils";

export interface StatsBubbleChartProps {
  players: PlayerSeasonStats[];
  leagueAvg: LeagueAverages | null | undefined;
  onPlayerSelect: (externalId: string) => void;
  locale: string;
  minGames?: number;
}

const W = 340;
const H = 280;
const PAD = { top: 24, right: 16, bottom: 32, left: 36 };

function lerp(val: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  if (inMax === inMin) return (outMin + outMax) / 2;
  return outMin + ((val - inMin) / (inMax - inMin)) * (outMax - outMin);
}

type BubblePoint = {
  x: number;
  y: number;
  r: number;
  player: PlayerSeasonStats;
  name: string;
};

export function StatsBubbleChart({
  players,
  leagueAvg,
  onPlayerSelect,
  locale,
  minGames = 5,
}: StatsBubbleChartProps) {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    player: PlayerSeasonStats;
    name: string;
  } | null>(null);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const es = locale === "es";
  const zh = locale === "zh";

  // Filter: need eFGPct and min games
  const filtered = players.filter(
    (p) => p.eFGPct != null && p.games >= minGames,
  );

  if (filtered.length < 3) {
    return (
      <div className="flex items-center justify-center h-40 text-xs text-muted-foreground">
        {es ? "Datos insuficientes (mín. 5 partidos)" : zh ? "数据不足（最少5场）" : "Insufficient data (min. 5 games)"}
      </div>
    );
  }

  const efgs = filtered.map((p) => p.eFGPct!);
  const ppgs = filtered.map((p) => p.ppg);
  const games = filtered.map((p) => p.games);

  const efgMin = Math.max(0, Math.min(...efgs) - 3);
  const efgMax = Math.min(80, Math.max(...efgs) + 3);
  const ppgMin = Math.max(0, Math.min(...ppgs) - 1);
  const ppgMax = Math.max(...ppgs) + 2;
  const gamesMin = Math.min(...games);
  const gamesMax = Math.max(...games);

  const plotX = (v: number) =>
    lerp(v, efgMin, efgMax, PAD.left, W - PAD.right);
  const plotY = (v: number) =>
    lerp(v, ppgMin, ppgMax, H - PAD.bottom, PAD.top);
  const plotR = (g: number) =>
    lerp(g, gamesMin, gamesMax, 4, 10);

  const points: BubblePoint[] = filtered.map((p) => ({
    x: plotX(p.eFGPct!),
    y: plotY(p.ppg),
    r: plotR(p.games),
    player: p,
    name: localName(p.playerName, p.playerNameEn, locale) ?? p.playerName,
  }));

  // League avg crosshairs
  const avgEfg = leagueAvg?.eFGPct ?? null;
  const avgPpg = leagueAvg?.avgPlayerPpg ?? null;
  const crossX = avgEfg != null ? plotX(avgEfg) : null;
  const crossY = avgPpg != null ? plotY(avgPpg) : null;

  // Axis ticks
  const efgTicks = [Math.round(efgMin / 5) * 5, Math.round((efgMin + efgMax) / 10) * 5, Math.round(efgMax / 5) * 5].filter(
    (v, i, a) => a.indexOf(v) === i && v >= efgMin && v <= efgMax,
  );
  const ppgTicks = [Math.round(ppgMin), Math.round((ppgMin + ppgMax) / 2), Math.round(ppgMax)].filter(
    (v, i, a) => a.indexOf(v) === i,
  );

  const handleBubbleEnter = useCallback(
    (pt: BubblePoint, svgX: number, svgY: number) => {
      if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
      setTooltip({ x: svgX, y: svgY, player: pt.player, name: pt.name });
    },
    [],
  );

  const handleBubbleLeave = useCallback(() => {
    tooltipTimer.current = setTimeout(() => setTooltip(null), 120);
  }, []);

  const handleBubbleTap = useCallback(
    (pt: BubblePoint) => {
      setTooltip(null);
      onPlayerSelect(pt.player.externalId);
    },
    [onPlayerSelect],
  );

  return (
    <div className="relative w-full select-none">
      {/* Axis labels */}
      <div className="flex justify-between px-[36px] mb-0.5">
        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
          eFG%
        </span>
        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
          PPG →
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        className="overflow-visible"
        onMouseLeave={handleBubbleLeave}
      >
        {/* Background */}
        <rect
          x={PAD.left}
          y={PAD.top}
          width={W - PAD.left - PAD.right}
          height={H - PAD.top - PAD.bottom}
          rx={4}
          className="fill-muted/20"
        />

        {/* Grid lines */}
        {ppgTicks.map((t) => {
          const y = plotY(t);
          return (
            <line
              key={`gy-${t}`}
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y}
              y2={y}
              className="stroke-border/50"
              strokeWidth={0.5}
              strokeDasharray="3,3"
            />
          );
        })}
        {efgTicks.map((t) => {
          const x = plotX(t);
          return (
            <line
              key={`gx-${t}`}
              x1={x}
              x2={x}
              y1={PAD.top}
              y2={H - PAD.bottom}
              className="stroke-border/50"
              strokeWidth={0.5}
              strokeDasharray="3,3"
            />
          );
        })}

        {/* League avg crosshairs */}
        {crossX != null && (
          <line
            x1={crossX}
            x2={crossX}
            y1={PAD.top}
            y2={H - PAD.bottom}
            className="stroke-muted-foreground/40"
            strokeWidth={1}
            strokeDasharray="4,2"
          />
        )}
        {crossY != null && (
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={crossY}
            y2={crossY}
            className="stroke-muted-foreground/40"
            strokeWidth={1}
            strokeDasharray="4,2"
          />
        )}
        {crossX != null && crossY != null && (
          <>
            <text
              x={crossX + 3}
              y={PAD.top + 8}
              className="fill-muted-foreground/50"
              fontSize={7}
              fontWeight={700}
            >
              {es ? "⌀ Liga" : zh ? "联赛均" : "Lg avg"}
            </text>
          </>
        )}

        {/* X axis ticks */}
        {efgTicks.map((t) => (
          <text
            key={`tx-${t}`}
            x={plotX(t)}
            y={H - PAD.bottom + 11}
            textAnchor="middle"
            className="fill-muted-foreground"
            fontSize={8}
          >
            {t}%
          </text>
        ))}

        {/* Y axis ticks */}
        {ppgTicks.map((t) => (
          <text
            key={`ty-${t}`}
            x={PAD.left - 4}
            y={plotY(t) + 3}
            textAnchor="end"
            className="fill-muted-foreground"
            fontSize={8}
          >
            {t}
          </text>
        ))}

        {/* Y axis label */}
        <text
          x={10}
          y={H / 2}
          textAnchor="middle"
          className="fill-muted-foreground"
          fontSize={8}
          fontWeight={700}
          transform={`rotate(-90, 10, ${H / 2})`}
        >
          PPG
        </text>

        {/* Bubbles — sorted so smaller bubbles are on top */}
        {[...points]
          .sort((a, b) => b.r - a.r)
          .map((pt) => {
            const isHovered = tooltip?.player.externalId === pt.player.externalId;
            return (
              <g
                key={pt.player.externalId}
                style={{ cursor: "pointer" }}
                onClick={() => handleBubbleTap(pt)}
                onMouseEnter={(e) => {
                  const svg = (e.currentTarget as SVGElement).ownerSVGElement!;
                  const rect = svg.getBoundingClientRect();
                  const scale = rect.width / W;
                  handleBubbleEnter(pt, pt.x * scale, pt.y * scale);
                }}
                onMouseLeave={handleBubbleLeave}
                onTouchStart={(e) => {
                  e.preventDefault();
                  const svg = (e.currentTarget as SVGElement).ownerSVGElement!;
                  const rect = svg.getBoundingClientRect();
                  const scale = rect.width / W;
                  handleBubbleEnter(pt, pt.x * scale, pt.y * scale);
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  handleBubbleTap(pt);
                }}
              >
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? pt.r + 2 : pt.r}
                  className="fill-primary/70 stroke-primary"
                  strokeWidth={isHovered ? 1.5 : 0.5}
                  style={{ transition: "r 0.1s, stroke-width 0.1s" }}
                />
              </g>
            );
          })}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border border-border bg-card/95 backdrop-blur px-2.5 py-1.5 shadow-lg text-left"
          style={{
            left: Math.min(tooltip.x + 8, 260),
            top: Math.max(tooltip.y - 40, 0),
            maxWidth: 160,
          }}
        >
          <p className="text-[11px] font-black text-foreground leading-tight truncate">
            {tooltip.name}
          </p>
          <p className="text-[10px] text-muted-foreground leading-tight truncate">
            {tooltip.player.teamName}
          </p>
          <div className="flex gap-2 mt-1">
            <span className="text-[10px] font-bold text-foreground">
              {tooltip.player.ppg.toFixed(1)}{" "}
              <span className="font-normal text-muted-foreground">PPG</span>
            </span>
            <span className="text-[10px] font-bold text-foreground">
              {tooltip.player.eFGPct!.toFixed(1)}%{" "}
              <span className="font-normal text-muted-foreground">eFG%</span>
            </span>
            <span className="text-[10px] font-bold text-foreground">
              {tooltip.player.games}
              <span className="font-normal text-muted-foreground">
                {es ? "J" : zh ? "场" : "G"}
              </span>
            </span>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-3 px-1 mt-1">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-primary/70 border border-primary" />
          <span className="text-[9px] text-muted-foreground">
            {es ? "Jugadora (tamaño=partidos)" : zh ? "球员（大小=场数）" : "Player (size=games)"}
          </span>
        </div>
        {(crossX != null || crossY != null) && (
          <div className="flex items-center gap-1">
            <div className="w-4 border-t border-dashed border-muted-foreground/40" />
            <span className="text-[9px] text-muted-foreground">
              {es ? "Media liga" : zh ? "联赛均值" : "League avg"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
