import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

export function WellnessTrendChart(props: {
  points: Array<{ date: string; value: number | null }>;
  goodUp?: boolean;
  height?: number;
  color?: string;
}) {
  const h = props.height ?? 80;
  const goodUp = props.goodUp ?? true;
  const baseColor = props.color ?? (goodUp ? "#10b981" : "#f59e0b");
  const hasSufficientData = props.points.filter((p) => p.value !== null).length >= 2;
  if (!hasSufficientData) {
    return (
      <div style={{ height: h }} className="flex items-center justify-center">
        <p className="text-xs text-muted-foreground">—</p>
      </div>
    );
  }
  const gradId = `wgrad-${baseColor.replace("#", "")}`;
  return (
    <ResponsiveContainer width="100%" height={h}>
      <AreaChart data={props.points} margin={{ top: 4, right: 2, left: -28, bottom: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={baseColor} stopOpacity={0.35} />
            <stop offset="95%" stopColor={baseColor} stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="date"
          tick={{ fontSize: 8, fill: "var(--muted-foreground)" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: string) => {
            try {
              return new Intl.DateTimeFormat(undefined, { month: "numeric", day: "numeric" }).format(new Date(v));
            } catch {
              return v.slice(5);
            }
          }}
          interval="preserveStartEnd"
        />
        <YAxis domain={[1, 5]} tick={{ fontSize: 8, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} ticks={[1, 2, 3, 4, 5]} />
        <Tooltip
          contentStyle={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 11,
            padding: "4px 8px",
          }}
          formatter={(v: number) => [`${Number(v).toFixed(1)}`, ""]}
          labelFormatter={(label: string) => {
            try {
              return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(new Date(label));
            } catch {
              return label;
            }
          }}
        />
        <ReferenceLine y={3} stroke="var(--border)" strokeDasharray="3 3" strokeWidth={1} />
        <Area
          type="monotone"
          dataKey="value"
          stroke={baseColor}
          strokeWidth={2}
          fill={`url(#${gradId})`}
          dot={false}
          connectNulls
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

