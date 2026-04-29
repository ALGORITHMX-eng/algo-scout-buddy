import * as React from "react";

type Tone = "muted" | "amber" | "emerald" | "rose";

const toneStroke: Record<Tone, string> = {
  muted: "hsl(var(--muted-foreground))",
  amber: "hsl(38 92% 55%)",
  emerald: "hsl(152 76% 45%)",
  rose: "hsl(350 89% 60%)",
};

export const Sparkline = ({
  data,
  tone = "muted",
  width = 80,
  height = 28,
}: {
  data: number[];
  tone?: Tone;
  width?: number;
  height?: number;
}) => {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const step = data.length > 1 ? width / (data.length - 1) : 0;
  const points = data.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return [x, y] as const;
  });
  const path = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const area =
    `M0,${height} ` +
    points.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(" ") +
    ` L${width},${height} Z`;
  const stroke = toneStroke[tone];
  const gradId = `spark-${tone}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <defs>
        <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <path d={path} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r={2} fill={stroke} />
    </svg>
  );
};
