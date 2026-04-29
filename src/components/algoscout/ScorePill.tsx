import { scoreColor } from "@/lib/algoscout-data";

export const ScorePill = ({ score, size = "sm" }: { score: number; size?: "sm" | "lg" }) => {
  const c = scoreColor(score);
  const cls =
    c === "green"
      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-emerald-500/30"
      : c === "yellow"
      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-amber-500/30"
      : "bg-rose-500/15 text-rose-600 dark:text-rose-400 ring-rose-500/30";
  const dim = size === "lg" ? "h-12 w-12 text-base" : "h-8 w-12 text-xs";
  return (
    <span
      className={`inline-flex ${dim} items-center justify-center rounded-lg font-semibold ring-1 ${cls}`}
    >
      {score.toFixed(1)}
    </span>
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
