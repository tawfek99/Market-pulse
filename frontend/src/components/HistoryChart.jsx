import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import useThemeColors from "../hooks/useThemeColors";

function TooltipBox({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <div className="tooltip-date">{label}</div>
      <div className="tooltip-score">{p.score}</div>
      <div className="tooltip-category">{p.category}</div>
    </div>
  );
}

export default function HistoryChart({ data }) {
  const t = useThemeColors();
  return (
    <ResponsiveContainer width="100%" height={340}>
      <AreaChart data={data} margin={{ top: 12, right: 12, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={t.accent} stopOpacity={0.32} />
            <stop offset="100%" stopColor={t.accent} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} className="theme-grid" />
        <XAxis
          dataKey="date"
          tick={{ fill: t.axis, fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          minTickGap={48}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: t.axis, fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip content={<TooltipBox />} cursor={{ stroke: t.crosshair }} />
        <ReferenceLine
          y={65}
          stroke={t.bull}
          strokeDasharray="4 4"
          label={{
            value: "Bullish",
            fill: t.bull,
            fontSize: 11,
            position: "insideTopRight",
          }}
        />
        <ReferenceLine
          y={45}
          stroke={t.bear}
          strokeDasharray="4 4"
          label={{
            value: "Bearish",
            fill: t.bear,
            fontSize: 11,
            position: "insideBottomRight",
          }}
        />
        <Area
          type="monotone"
          dataKey="score"
          stroke={t.accent}
          strokeWidth={2}
          fill="url(#scoreFill)"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
