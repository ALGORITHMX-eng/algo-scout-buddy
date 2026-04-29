import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import { Job, deriveBreakdown, scoreColor } from "@/lib/algoscout-data";

const toneStyles = (c: "green" | "yellow" | "red") =>
  c === "green"
    ? {
        cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-emerald-500/40",
        glow: "0 0 14px hsl(152 76% 45% / 0.55), 0 0 2px hsl(152 76% 45% / 0.7)",
        stroke: "hsl(152 76% 45%)",
      }
    : c === "yellow"
      ? {
          cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-amber-500/40",
          glow: "0 0 14px hsl(38 92% 55% / 0.55), 0 0 2px hsl(38 92% 55% / 0.7)",
          stroke: "hsl(38 92% 55%)",
        }
      : {
          cls: "bg-rose-500/15 text-rose-600 dark:text-rose-400 ring-rose-500/40",
          glow: "0 0 14px hsl(350 89% 60% / 0.55), 0 0 2px hsl(350 89% 60% / 0.7)",
          stroke: "hsl(350 89% 60%)",
        };

export const ScorePill = ({
  score,
  size = "sm",
  job,
  interactive = true,
}: {
  score: number;
  size?: "sm" | "lg";
  job?: Job;
  interactive?: boolean;
}) => {
  const c = scoreColor(score);
  const t = toneStyles(c);
  const dim = size === "lg" ? "h-12 w-12 text-base" : "h-8 w-12 text-xs";

  const pill = (
    <span
      className={`inline-flex ${dim} items-center justify-center rounded-lg font-semibold ring-1 transition-transform ${t.cls} ${interactive && job ? "cursor-pointer hover:scale-110" : ""}`}
      style={{ boxShadow: t.glow }}
    >
      {score.toFixed(1)}
    </span>
  );

  if (!job || !interactive) return pill;

  const b = deriveBreakdown(job);
  const data = [
    { axis: "Skills", value: b.skills },
    { axis: "Salary", value: b.salary },
    { axis: "Location", value: b.location },
    { axis: "Culture", value: b.culture },
  ];

  return (
    <Popover>
      <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
        <button type="button" className="inline-flex items-center justify-center" aria-label="Score breakdown">
          {pill}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-3"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Score breakdown
          </span>
          <span className="font-display text-sm font-semibold" style={{ color: t.stroke }}>
            {score.toFixed(1)}
          </span>
        </div>
        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={data} outerRadius="75%">
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis
                dataKey="axis"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
              />
              <PolarRadiusAxis domain={[0, 10]} tick={false} axisLine={false} />
              <Radar
                dataKey="value"
                stroke={t.stroke}
                fill={t.stroke}
                fillOpacity={0.35}
                strokeWidth={1.5}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-1 grid grid-cols-2 gap-1 text-[11px] text-muted-foreground">
          {data.map((d) => (
            <div key={d.axis} className="flex items-center justify-between">
              <span>{d.axis}</span>
              <span className="font-medium text-foreground">{d.value.toFixed(1)}</span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export const StatusBadge = ({ status }: { status: "Pending" | "Approved" | "Rejected" }) => {
  const cls =
    status === "Approved"
      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/30"
      : status === "Rejected"
        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 ring-rose-500/30"
        : "bg-muted text-muted-foreground ring-border";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ${cls}`}>
      {status}
    </span>
  );
};
