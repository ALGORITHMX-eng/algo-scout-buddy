import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Check, X, Inbox, Clock, CheckCircle2, XCircle, BellRing, Loader2 } from "lucide-react";
import { AlgoNavbar } from "@/components/algoscout/Navbar";
import { ScorePill, StatusBadge } from "@/components/algoscout/ScorePill";
import { Sparkline } from "@/components/algoscout/Sparkline";
import { ProgressRing } from "@/components/algoscout/ProgressRing";
import { Job, JobStatus, loadJobs, updateJobStatus, getWeeklyTrends } from "@/lib/algoscout-data";
import { enablePushNotifications } from "@/lib/push-notifications";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

const FILTERS: ("All" | JobStatus)[] = ["All", "Pending", "Approved", "Rejected"];

const StatCard = ({
  label,
  value,
  icon: Icon,
  tone,
  trend,
}: {
  label: string;
  value: number;
  icon: any;
  tone: "muted" | "amber" | "emerald" | "rose";
  trend: number[];
}) => {
  const map = {
    muted: "bg-muted text-muted-foreground ring-border",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/30",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/30",
    rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400 ring-rose-500/30",
  } as const;
  return (
    <div className="group rounded-xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ring-1 ${map[tone]}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <div className="font-display text-3xl font-semibold text-foreground">{value}</div>
        <Sparkline data={trend} tone={tone} width={80} height={28} />
      </div>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">7-day trend</div>
    </div>
  );
};

export default function AlgoDashboard() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const isMobile = useIsMobile();

  useEffect(() => {
    setJobs(loadJobs());
  }, []);

  const stats = useMemo(
    () => ({
      total: jobs.length,
      pending: jobs.filter((j) => j.status === "Pending").length,
      approved: jobs.filter((j) => j.status === "Approved").length,
      rejected: jobs.filter((j) => j.status === "Rejected").length,
    }),
    [jobs],
  );

  const trends = useMemo(() => getWeeklyTrends(jobs), [jobs]);
  const trendArrays = useMemo(
    () => ({
      total: trends.map((t) => t.found),
      pending: trends.map((t) => t.pending),
      approved: trends.map((t) => t.approved),
      rejected: trends.map((t) => t.rejected),
    }),
    [trends],
  );

  const reviewed = stats.approved + stats.rejected;

  const visible = filter === "All" ? jobs : jobs.filter((j) => j.status === filter);

  const setStatus = (id: string, status: JobStatus) => {
    setJobs(updateJobStatus(id, status));
  };

  const [pushBusy, setPushBusy] = useState(false);
  const handleEnablePush = async () => {
    setPushBusy(true);
    try {
      const res = await enablePushNotifications();
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to enable notifications.");
    } finally {
      setPushBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AlgoNavbar />

      <main className="mx-auto max-w-6xl px-5 py-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground">AI-scored job leads, ready for your review.</p>
          </div>
          <button
            onClick={handleEnablePush}
            disabled={pushBusy}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/15 px-3.5 py-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/25 disabled:opacity-60"
          >
            {pushBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BellRing className="h-3.5 w-3.5" />}
            Enable Notifications
          </button>
        </div>

        {/* Weekly digest ring */}
        <div className="mb-5 flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4">
          <ProgressRing
            value={reviewed}
            total={stats.total}
            size={84}
            stroke={7}
            label="Weekly review progress"
            sublabel={`${reviewed} of ${stats.total} leads reviewed this week`}
          />
          <div className="hidden text-right sm:block">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Still pending</div>
            <div className="font-display text-2xl font-semibold text-foreground">{stats.pending}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total leads" value={stats.total} icon={Inbox} tone="muted" trend={trendArrays.total} />
          <StatCard label="Pending" value={stats.pending} icon={Clock} tone="amber" trend={trendArrays.pending} />
          <StatCard label="Applied" value={stats.approved} icon={CheckCircle2} tone="emerald" trend={trendArrays.approved} />
          <StatCard label="Rejected" value={stats.rejected} icon={XCircle} tone="rose" trend={trendArrays.rejected} />
        </div>

        <div className="mt-8 overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="font-display text-sm font-semibold text-foreground">Job leads</div>
            <div className="flex items-center gap-3">
              {isMobile && (
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Swipe → approve · ← reject
                </span>
              )}
              <div className="flex gap-1 rounded-lg bg-muted p-1 ring-1 ring-border">
                {FILTERS.map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                      filter === f
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Company</th>
                  <th className="px-4 py-3 text-left font-medium">Role</th>
                  <th className="px-4 py-3 text-left font-medium">Score</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Date found</th>
                  <th className="px-4 py-3 text-left font-medium">Apply</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((j) => (
                  <JobRow
                    key={j.id}
                    job={j}
                    isMobile={isMobile}
                    onApprove={() => setStatus(j.id, "Approved")}
                    onReject={() => setStatus(j.id, "Rejected")}
                  />
                ))}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      No jobs match this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

/** Job row with swipe-to-approve/reject on mobile and hover lift on desktop. */
function JobRow({
  job: j,
  isMobile,
  onApprove,
  onReject,
}: {
  job: Job;
  isMobile: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useState<{ x: number | null }>({ x: null })[0];
  const THRESHOLD = 70;

  const onTouchStart = (e: React.TouchEvent) => {
    startX.x = e.touches[0].clientX;
    setDragging(true);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startX.x == null) return;
    const delta = e.touches[0].clientX - startX.x;
    setDx(Math.max(-140, Math.min(140, delta)));
  };
  const onTouchEnd = () => {
    setDragging(false);
    if (dx > THRESHOLD) onApprove();
    else if (dx < -THRESHOLD) onReject();
    setDx(0);
    startX.x = null;
  };

  const showApprove = dx > 12;
  const showReject = dx < -12;

  return (
    <tr className="relative border-t border-border/70">
      <td colSpan={7} className="p-0">
        <div className="relative overflow-hidden">
          {isMobile && (
            <>
              <div
                className={`pointer-events-none absolute inset-y-0 left-0 flex items-center gap-2 bg-emerald-500/20 px-4 text-sm font-medium text-emerald-600 dark:text-emerald-400 transition-opacity ${
                  showApprove ? "opacity-100" : "opacity-0"
                }`}
              >
                <Check className="h-4 w-4" /> Approve
              </div>
              <div
                className={`pointer-events-none absolute inset-y-0 right-0 flex items-center gap-2 bg-rose-500/20 px-4 text-sm font-medium text-rose-600 dark:text-rose-400 transition-opacity ${
                  showReject ? "opacity-100" : "opacity-0"
                }`}
              >
                Reject <X className="h-4 w-4" />
              </div>
            </>
          )}
          <div
            className="bg-card transition-all duration-150 hover:-translate-y-px hover:bg-muted/40 hover:shadow-[0_4px_12px_-6px_hsl(var(--foreground)/0.18)]"
            style={
              isMobile
                ? {
                    transform: `translateX(${dx}px)`,
                    transition: dragging ? "none" : "transform 200ms ease",
                  }
                : undefined
            }
            onTouchStart={isMobile ? onTouchStart : undefined}
            onTouchMove={isMobile ? onTouchMove : undefined}
            onTouchEnd={isMobile ? onTouchEnd : undefined}
          >
            <table className="w-full text-sm">
              <tbody>
                <tr>
                  <td className="px-4 py-3">
                    <Link
                      to={`/algoscout/job/${j.id}`}
                      className="font-medium text-foreground hover:text-emerald-600 dark:hover:text-emerald-400"
                    >
                      {j.company}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-foreground/80">
                    <Link
                      to={`/algoscout/job/${j.id}`}
                      className="hover:text-emerald-600 dark:hover:text-emerald-400"
                    >
                      {j.role}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <ScorePill score={j.score} job={j} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={j.status} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{j.dateFound}</td>
                  <td className="px-4 py-3">
                    <a
                      href={j.applyUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      Open <ExternalLink className="h-3 w-3" />
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={onApprove}
                        className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2.5 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/25"
                      >
                        <Check className="h-3.5 w-3.5" /> Approve
                      </button>
                      <button
                        onClick={onReject}
                        className="inline-flex items-center gap-1 rounded-md bg-rose-500/15 px-2.5 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 ring-1 ring-rose-500/30 transition hover:bg-rose-500/25"
                      >
                        <X className="h-3.5 w-3.5" /> Reject
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </td>
    </tr>
  );
}
