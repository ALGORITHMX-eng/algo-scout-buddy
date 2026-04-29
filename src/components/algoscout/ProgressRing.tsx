import * as React from "react";

export const ProgressRing = ({
  value,
  total,
  size = 96,
  stroke = 8,
  label,
  sublabel,
}: {
  value: number;
  total: number;
  size?: number;
  stroke?: number;
  label?: string;
  sublabel?: string;
}) => {
  const pct = total > 0 ? Math.min(1, value / total) : 0;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);
  return (
    <div className="flex items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="hsl(var(--muted))"
            strokeWidth={stroke}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="hsl(152 76% 45%)"
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={c}
            strokeDashoffset={offset}
            style={{
              transition: "stroke-dashoffset 600ms ease",
              filter: "drop-shadow(0 0 6px hsl(152 76% 45% / 0.5))",
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-lg font-semibold text-foreground">
            {Math.round(pct * 100)}%
          </span>
        </div>
      </div>
      {(label || sublabel) && (
        <div>
          {label && <div className="font-display text-sm font-semibold text-foreground">{label}</div>}
          {sublabel && <div className="text-xs text-muted-foreground">{sublabel}</div>}
        </div>
      )}
    </div>
  );
};
