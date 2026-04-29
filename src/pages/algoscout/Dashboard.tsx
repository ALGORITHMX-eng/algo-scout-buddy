import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Check, X, Inbox, Clock, CheckCircle2, XCircle, BellRing, Loader2 } from "lucide-react";
import { AlgoNavbar } from "@/components/algoscout/Navbar";
import { ScorePill, StatusBadge } from "@/components/algoscout/ScorePill";
import { Job, JobStatus, loadJobs, updateJobStatus } from "@/lib/algoscout-data";
import { enablePushNotifications } from "@/lib/push-notifications";
import { toast } from "sonner";

const FILTERS: ("All" | JobStatus)[] = ["All", "Pending", "Approved", "Rejected"];

const StatCard = ({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: any;
  tone: "muted" | "amber" | "emerald" | "rose";
}) => {
  const map = {
    muted: "bg-muted text-muted-foreground ring-border",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/30",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/30",
    rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400 ring-rose-500/30",
  } as const;
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ring-1 ${map[tone]}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="mt-3 font-display text-3xl font-semibold text-foreground">{value}</div>
    </div>
  );
};

export default function AlgoDashboard() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");

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

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total leads" value={stats.total} icon={Inbox} tone="muted" />
          <StatCard label="Pending" value={stats.pending} icon={Clock} tone="amber" />
          <StatCard label="Applied" value={stats.approved} icon={CheckCircle2} tone="emerald" />
          <StatCard label="Rejected" value={stats.rejected} icon={XCircle} tone="rose" />
        </div>

        <div className="mt-8 overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="font-display text-sm font-semibold text-foreground">Job leads</div>
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
                  <tr key={j.id} className="border-t border-border/70 transition hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <Link to={`/algoscout/job/${j.id}`} className="font-medium text-foreground hover:text-emerald-600 dark:hover:text-emerald-400">
                        {j.company}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-foreground/80">
                      <Link to={`/algoscout/job/${j.id}`} className="hover:text-emerald-600 dark:hover:text-emerald-400">
                        {j.role}
                      </Link>
                    </td>
                    <td className="px-4 py-3"><ScorePill score={j.score} /></td>
                    <td className="px-4 py-3"><StatusBadge status={j.status} /></td>
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
                          onClick={() => setStatus(j.id, "Approved")}
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2.5 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/25"
                        >
                          <Check className="h-3.5 w-3.5" /> Approve
                        </button>
                        <button
                          onClick={() => setStatus(j.id, "Rejected")}
                          className="inline-flex items-center gap-1 rounded-md bg-rose-500/15 px-2.5 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 ring-1 ring-rose-500/30 transition hover:bg-rose-500/25"
                        >
                          <X className="h-3.5 w-3.5" /> Reject
                        </button>
                      </div>
                    </td>
                  </tr>
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
