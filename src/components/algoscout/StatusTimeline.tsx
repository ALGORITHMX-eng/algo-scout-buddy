import { useEffect, useState } from "react";
import { Check, Circle, FileSearch, Mail, Send, ThumbsUp, X } from "lucide-react";
import {
  clearStage,
  loadTimeline,
  setStage,
  STAGE_ORDER,
  TimelineData,
  TimelineStage,
} from "@/lib/algoscout-timeline";

const STAGE_META: Record<
  TimelineStage,
  { icon: React.ComponentType<{ className?: string }>; tone: string; ring: string; bg: string }
> = {
  Found: {
    icon: FileSearch,
    tone: "text-sky-600 dark:text-sky-400",
    ring: "ring-sky-500/40",
    bg: "bg-sky-500/15",
  },
  Approved: {
    icon: ThumbsUp,
    tone: "text-emerald-600 dark:text-emerald-400",
    ring: "ring-emerald-500/40",
    bg: "bg-emerald-500/15",
  },
  Applied: {
    icon: Send,
    tone: "text-indigo-600 dark:text-indigo-400",
    ring: "ring-indigo-500/40",
    bg: "bg-indigo-500/15",
  },
  Responded: {
    icon: Mail,
    tone: "text-amber-600 dark:text-amber-400",
    ring: "ring-amber-500/40",
    bg: "bg-amber-500/15",
  },
  Rejected: {
    icon: X,
    tone: "text-rose-600 dark:text-rose-400",
    ring: "ring-rose-500/40",
    bg: "bg-rose-500/15",
  },
};

const fmt = (iso?: string) => {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

export function StatusTimeline({
  jobId,
  dateFound,
  externalData,
}: {
  jobId: string;
  dateFound: string;
  externalData?: TimelineData;
}) {
  const [data, setData] = useState<TimelineData>({});

  useEffect(() => {
    setData(loadTimeline(jobId, dateFound));
  }, [jobId, dateFound]);

  useEffect(() => {
    if (externalData) setData((prev) => ({ ...prev, ...externalData }));
  }, [externalData]);

  const toggle = (stage: TimelineStage) => {
    if (stage === "Found") return; // always set
    const next = data[stage] ? clearStage(jobId, stage) : setStage(jobId, stage);
    setData({ ...next });
  };

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Application timeline
        </h2>
        <span className="text-[11px] text-muted-foreground">Tap a stage to mark it</span>
      </div>

      <ol className="relative space-y-3">
        {STAGE_ORDER.map((stage, idx) => {
          const meta = STAGE_META[stage];
          const Icon = meta.icon;
          const ts = data[stage];
          const done = !!ts;
          const isLast = idx === STAGE_ORDER.length - 1;

          return (
            <li key={stage} className="relative flex items-start gap-3">
              {/* connector */}
              {!isLast && (
                <span
                  aria-hidden
                  className={
                    "absolute left-[17px] top-9 h-[calc(100%-8px)] w-px " +
                    (done ? "bg-border" : "bg-border/50")
                  }
                />
              )}

              <button
                onClick={() => toggle(stage)}
                disabled={stage === "Found"}
                className={
                  "relative z-10 flex h-9 w-9 flex-none items-center justify-center rounded-full ring-1 transition " +
                  (done
                    ? `${meta.bg} ${meta.ring} ${meta.tone}`
                    : "bg-muted/40 ring-border text-muted-foreground hover:bg-muted")
                }
                aria-label={`${done ? "Clear" : "Mark"} ${stage}`}
              >
                {done ? <Icon className="h-4 w-4" /> : <Circle className="h-3 w-3" />}
                {done && (
                  <span className="absolute -right-1 -top-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 text-[8px] text-white">
                    <Check className="h-2.5 w-2.5" />
                  </span>
                )}
              </button>

              <div className="min-w-0 flex-1 pt-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className={
                      "text-sm font-medium " + (done ? "text-foreground" : "text-muted-foreground")
                    }
                  >
                    {stage}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{fmt(ts) ?? "—"}</span>
                </div>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  {stage === "Found" && "AlgoScout surfaced this role."}
                  {stage === "Approved" && "You approved this lead."}
                  {stage === "Applied" && "Application submitted."}
                  {stage === "Responded" && "Employer replied or moved you forward."}
                  {stage === "Rejected" && "Closed out — not moving forward."}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
