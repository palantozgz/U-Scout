/**
 * StatsRadar — 6-axis radar chart for player season stats
 * SVG puro, sin Recharts, para control total de colores y tipografía.
 * Axes: PPG · RPG · APG · SPG · BPG · FG%
 * Lee CSS variables en runtime via getComputedStyle para compatibilidad
 * con los 3 temas (dark/office/oldschool).
 */
import { useRef, useEffect, useState } from "react";
import type { PlayerDetail } from "@/lib/stats-api";

const AXES = [
  { key: "PPG", max: 35,  label: "PPG",  sub: "Puntos" },
  { key: "RPG", max: 15,  label: "RPG",  sub: "Rebotes" },
  { key: "APG", max: 10,  label: "APG",  sub: "Asist." },
  { key: "SPG", max: 4,   label: "SPG",  sub: "Robos" },
  { key: "BPG", max: 4,   label: "BPG",  sub: "Tapones" },
  { key: "FG%", max: 65,  label: "FG%",  sub: "Tiro" },
] as const;

type AxisKey = typeof AXES[number]["key"];

function getValue(player: PlayerDetail, key: AxisKey): number {
  switch (key) {
    case "PPG": return player.ppg;
    case "RPG": return player.rpg;
    case "APG": return player.apg;
    case "SPG": return player.spg;
    case "BPG": return player.bpg;
    case "FG%": return player.fgPct ?? 0;
  }
}

function getRaw(player: PlayerDetail, key: AxisKey): string {
  switch (key) {
    case "FG%": return player.fgPct != null ? `${player.fgPct.toFixed(1)}%` : "—";
    default:     return getValue(player, key).toFixed(1);
  }
}

function normalize(value: number, max: number): number {
  return Math.min(1, Math.max(0, value / max));
}

// Lee una CSS variable del root como string hsl() utilizable en SVG
function cssVar(name: string): string {
  if (typeof window === "undefined") return "#888";
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(name).trim();
  return raw ? `hsl(${raw})` : "#888";
}

const N = AXES.length;
const CX = 110;
const CY = 110;
const R  = 78;   // outer radius of radar
const RINGS = 4;  // concentric grid rings

function polarToXY(angle: number, r: number): [number, number] {
  // angle 0 = top, clockwise
  const a = (angle - 90) * (Math.PI / 180);
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}

function buildPolygon(values: number[]): string {
  return values
    .map((v, i) => {
      const [x, y] = polarToXY((360 / N) * i, v * R);
      return `${x},${y}`;
    })
    .join(" ");
}

interface StatsRadarProps {
  player: PlayerDetail;
  locale?: string;
}

export function StatsRadar({ player, locale }: StatsRadarProps) {
  const es = locale === "es";
  const zh = locale === "zh";
  const ref = useRef<SVGSVGElement>(null);
  const [colors, setColors] = useState({
    primary:  "#3A81FE",
    grid:     "rgba(128,128,128,0.25)",
    gridFill: "rgba(128,128,128,0.04)",
    label:    "rgba(128,128,128,0.9)",
    value:    "#e5e5e5",
    fill:     "rgba(58,129,254,0.22)",
    stroke:   "#3A81FE",
    dot:      "#3A81FE",
    bg:       "transparent",
  });

  useEffect(() => {
    // Leer colores del tema activo después del mount
    const primary = cssVar("--primary");
    const fg      = cssVar("--foreground");
    const muted   = cssVar("--muted-foreground");
    const border  = cssVar("--border");
    setColors({
      primary,
      grid:     border,
      gridFill: "transparent",
      label:    muted,
      value:    fg,
      fill:     primary.replace("hsl(", "hsla(").replace(")", ", 0.20)"),
      stroke:   primary,
      dot:      primary,
      bg:       "transparent",
    });
  }, []);

  const normalized = AXES.map((ax) => normalize(getValue(player, ax.key), ax.max));
  const polygon    = buildPolygon(normalized);

  // Grid rings polygons
  const rings = Array.from({ length: RINGS }, (_, i) => {
    const t = (i + 1) / RINGS;
    return buildPolygon(Array(N).fill(t));
  });

  // Axis lines (center → tip)
  const axisLines = AXES.map((_, i) => {
    const [x, y] = polarToXY((360 / N) * i, R);
    return { x2: x, y2: y };
  });

  // Dot positions on radar
  const dots = normalized.map((v, i) => {
    const [x, y] = polarToXY((360 / N) * i, v * R);
    return { x, y };
  });

  // Label positions (slightly outside R)
  const labelPad = 22;
  const labels = AXES.map((ax, i) => {
    const angle = (360 / N) * i;
    const [lx, ly] = polarToXY(angle, R + labelPad);
    const dx = lx - CX;
    const anchor: "middle" | "start" | "end" =
      Math.abs(dx) < 8 ? "middle" : dx > 0 ? "start" : "end";
    return { ax, lx, ly, anchor, raw: getRaw(player, ax.key) };
  });

  const svgSize = (CX + R + labelPad + 28) * 2;
  const viewBox = `0 0 ${svgSize} ${svgSize}`;
  const ox = (svgSize / 2) - CX;
  const oy = (svgSize / 2) - CY;

  const title = es ? "Perfil estadístico" : zh ? "统计雷达图" : "Statistical profile";
  const subtitle = es
    ? "Normalizado vs máx. temporada WCBA"
    : zh
    ? "相对WCBA赛季最高值归一化"
    : "Normalized vs WCBA season max";

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
      {/* Header */}
      <div className="flex items-baseline justify-between px-0.5">
        <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
        <p className="text-[9px] text-muted-foreground/50 font-medium">
          {subtitle}
        </p>
      </div>

      {/* SVG radar */}
      <svg
        ref={ref}
        viewBox={viewBox}
        width="100%"
        style={{ display: "block", overflow: "visible" }}
        aria-label={title}
      >
        <g transform={`translate(${ox},${oy})`}>
          {/* Grid rings */}
          {rings.map((pts, i) => (
            <polygon
              key={i}
              points={pts}
              fill={i === RINGS - 1 ? colors.gridFill : "transparent"}
              stroke={colors.grid}
              strokeWidth={i === RINGS - 1 ? 1.5 : 0.8}
              strokeOpacity={i === RINGS - 1 ? 0.7 : 0.35}
            />
          ))}

          {/* Axis lines */}
          {axisLines.map((l, i) => (
            <line
              key={i}
              x1={CX} y1={CY}
              x2={l.x2} y2={l.y2}
              stroke={colors.grid}
              strokeWidth={0.8}
              strokeOpacity={0.4}
            />
          ))}

          {/* Filled radar area */}
          <polygon
            points={polygon}
            fill={colors.fill}
            stroke={colors.stroke}
            strokeWidth={2}
            strokeLinejoin="round"
          />

          {/* Dots on each axis */}
          {dots.map((d, i) => (
            <circle
              key={i}
              cx={d.x} cy={d.y}
              r={3.5}
              fill={colors.dot}
              stroke={colors.bg === "transparent" ? "hsl(var(--card))" : colors.bg}
              strokeWidth={1.5}
            />
          ))}

          {/* Labels: axis name + raw value */}
          {labels.map(({ ax, lx, ly, anchor, raw }) => (
            <g key={ax.key}>
              {/* Axis abbreviation */}
              <text
                x={lx} y={ly - 5}
                textAnchor={anchor}
                dominantBaseline="auto"
                fill={colors.label}
                fontSize={9}
                fontWeight={700}
                fontFamily="Inter, system-ui, sans-serif"
                letterSpacing="0.08em"
                style={{ textTransform: "uppercase" }}
              >
                {ax.key}
              </text>
              {/* Raw value — large, high contrast */}
              <text
                x={lx} y={ly + 9}
                textAnchor={anchor}
                dominantBaseline="auto"
                fill={colors.value}
                fontSize={13}
                fontWeight={900}
                fontFamily="Inter, system-ui, sans-serif"
              >
                {raw}
              </text>
              {/* Sub-label description */}
              <text
                x={lx} y={ly + 20}
                textAnchor={anchor}
                dominantBaseline="auto"
                fill={colors.label}
                fontSize={7.5}
                fontWeight={500}
                fontFamily="Inter, system-ui, sans-serif"
                opacity={0.7}
              >
                {ax.sub}
              </text>
            </g>
          ))}

          {/* Center dot */}
          <circle cx={CX} cy={CY} r={2.5} fill={colors.grid} opacity={0.5} />
        </g>
      </svg>

      {/* Legend: 25% / 50% / 75% / MAX rings */}
      <div className="flex items-center justify-center gap-4 pt-1">
        {([25, 50, 75, 100] as const).map((pct) => (
          <div key={pct} className="flex items-center gap-1">
            <div
              className="w-2 h-2 rounded-sm border"
              style={{
                borderColor: pct === 100 ? colors.stroke : colors.grid,
                opacity: pct === 100 ? 0.9 : 0.5,
              }}
            />
            <span className="text-[8px] font-bold text-muted-foreground/60">
              {pct === 100 ? "MAX" : `${pct}%`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
