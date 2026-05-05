/**
 * StatsRadar — 6-axis radar chart for player season stats
 * Uses recharts RadarChart. Designed for portrait, 280px wide max.
 * Axes: PPG · RPG · APG · SPG · BPG · FG%
 *
 * Usage:
 *   <StatsRadar player={playerDetail} locale="es" />
 */
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";
import type { PlayerDetail } from "@/lib/stats-api";

// League reference maximums for normalization (WCBA season context).
// These cap each axis at 100 so all players are comparable on the same scale.
// Adjust if data shows outliers beyond these ceilings.
const AXIS_MAX: Record<string, number> = {
  PPG: 35,
  RPG: 15,
  APG: 10,
  SPG: 4,
  BPG: 4,
  "FG%": 65,
};

function normalize(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(100, Math.max(0, (value / max) * 100));
}

interface RadarDataPoint {
  axis: string;
  value: number;     // normalized 0–100
  rawValue: string;  // display string for tooltip
}

function buildRadarData(player: PlayerDetail): RadarDataPoint[] {
  return [
    {
      axis: "PPG",
      value: normalize(player.ppg, AXIS_MAX.PPG),
      rawValue: player.ppg.toFixed(1),
    },
    {
      axis: "RPG",
      value: normalize(player.rpg, AXIS_MAX.RPG),
      rawValue: player.rpg.toFixed(1),
    },
    {
      axis: "APG",
      value: normalize(player.apg, AXIS_MAX.APG),
      rawValue: player.apg.toFixed(1),
    },
    {
      axis: "SPG",
      value: normalize(player.spg, AXIS_MAX.SPG),
      rawValue: player.spg.toFixed(1),
    },
    {
      axis: "BPG",
      value: normalize(player.bpg, AXIS_MAX.BPG),
      rawValue: player.bpg.toFixed(1),
    },
    {
      axis: "FG%",
      value: normalize(player.fgPct ?? 0, AXIS_MAX["FG%"]),
      rawValue: player.fgPct != null ? `${player.fgPct.toFixed(1)}%` : "—",
    },
  ];
}

// Custom tick renders axis label + raw value below it.
interface CustomTickProps {
  x?: number;
  y?: number;
  payload?: { value: string };
  data: RadarDataPoint[];
  cx?: number;
  cy?: number;
}

function CustomTick({ x = 0, y = 0, payload, data, cx = 0, cy = 0 }: CustomTickProps) {
  if (!payload) return null;
  const point = data.find((d) => d.axis === payload.value);
  if (!point) return null;

  // Determine text anchor based on position relative to center
  const dx = x - cx;
  const anchor = Math.abs(dx) < 10 ? "middle" : dx > 0 ? "start" : "end";

  // Shift label outward from chart edge
  const offsetX = dx > 10 ? 4 : dx < -10 ? -4 : 0;
  const offsetY = y < cy ? -4 : 4;

  return (
    <g transform={`translate(${x + offsetX},${y + offsetY})`}>
      <text
        textAnchor={anchor}
        dominantBaseline="middle"
        className="fill-muted-foreground"
        style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.05em", textTransform: "uppercase" }}
      >
        {point.axis}
      </text>
      <text
        y={11}
        textAnchor={anchor}
        dominantBaseline="middle"
        className="fill-foreground"
        style={{ fontSize: 10, fontWeight: 900 }}
      >
        {point.rawValue}
      </text>
    </g>
  );
}

interface StatsRadarProps {
  player: PlayerDetail;
  locale?: string;
}

export function StatsRadar({ player, locale }: StatsRadarProps) {
  const es = locale === "es";
  const zh = locale === "zh";
  const data = buildRadarData(player);

  const label = es
    ? "Perfil estadístico"
    : zh
    ? "统计雷达图"
    : "Statistical profile";

  return (
    <div className="rounded-2xl border border-border bg-card p-3 space-y-1">
      <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground px-0.5">
        {label}
      </p>
      <div className="w-full" style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart
            data={data}
            margin={{ top: 20, right: 30, bottom: 20, left: 30 }}
            outerRadius="62%"
          >
            <PolarGrid
              gridType="polygon"
              stroke="var(--border)"
              strokeOpacity={0.6}
            />
            <PolarAngleAxis
              dataKey="axis"
              tick={(props) => (
                <CustomTick
                  {...props}
                  data={data}
                  cx={props.cx}
                  cy={props.cy}
                />
              )}
            />
            <Radar
              name={player.nameZh}
              dataKey="value"
              stroke="var(--primary)"
              fill="var(--primary)"
              fillOpacity={0.18}
              strokeWidth={2}
              dot={false}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
