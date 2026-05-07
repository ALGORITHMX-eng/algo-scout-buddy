import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Check, X, Inbox, Clock, CheckCircle2, XCircle, BellRing, Loader2, Filter } from "lucide-react";
import { AlgoNavbar } from "@/components/algoscout/Navbar";
import { ScorePill, StatusBadge } from "@/components/algoscout/ScorePill";
import { Sparkline } from "@/components/algoscout/Sparkline";
import { ProgressRing } from "@/components/algoscout/ProgressRing";
import { enablePushNotifications } from "@/lib/push-notifications";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

type JobStatus = "pending" | "approved" | "rejected";
type Job = {
  id: string;
  company: string;
  role: string;
  score: number;
  status: string;
  found_at: string;
  job_url: string | null;
  location: string | null;
  reason: string | null;
  description: string | null;
  resume: string | null;
  cover_letter: string | null;
  breakdown: any;
};

const FILTERS: ("All" | string)[] = ["All", "pending", "approved", "rejected"];
const FILTER_LABELS: Record<string, string> = { All: "All", pending: "Pending", approved: "Applied", rejected: "Rejected" };

const StatCard = ({
  label, value, icon: Icon, tone, trend,
}: {
  label: string; value: number; icon: any; tone: "muted" | "amber" | "emerald" | "rose"; trend: number[];
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
  const { user, loading: authLoading } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("All");
  const isMobile = useIsMobile();

  useEffect(() => {
    const fetchJobs = async () => {
      setLoading(true);
      const query = supabase
        .from("jobs")
        .select("*")
        .order("found_at", { ascending: false });
      // If user is logged in, RLS automatically filters by user_id
      // If no user (auth disabled), show all jobs
      const { data, error } = await query;
      if (error) {
        console.error(error);
        toast.error("Failed to load jobs");
      }
      setJobs((data as any[]) || []);
      setLoading(false);
    };
    fetchJobs();
  }, [user]);

  const stats = useMemo(
    () => ({
      total: jobs.length,
      pending: jobs.filter((j) => j.status === "pending").length,
      approved: jobs.filter((j) => j.status === "approved").length,
      rejected: jobs.filter((j) => j.status === "rejected").length,
    }),
    [jobs],
  );

  // Simple trend (just repeat the stat for 7 days for now)
  const trendArrays = useMemo(() => ({
    total: Array(7).fill(stats.total),
    pending: Array(7).fill(stats.pending),
    approved: Array(7).fill(stats.approved),
    rejected: Array(7).fill(stats.rejected),
  }), [stats]);

  const reviewed = stats.approved + stats.rejected;

  const visible = useMemo(() => {
    if (filter === "All") return jobs;
    return jobs.filter((j) => j.status === filter);
  }, [jobs, filter]);

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from("jobs")
      .update({ status } as any)
      .eq("id", id);
    if (error) {
      toast.error("Failed to update status");
      return;
    }
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status } : j)));
    toast.success(`Job ${status}`);
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

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <AlgoNavbar />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AlgoNavbar />

      <main className="mx-auto max-w-6xl px-3 sm:px-5 py-8">
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

        <div className="mb-5 flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4">
          <ProgressRing value={reviewed} total={stats.total} size={84} stroke={7} label="Weekly review progress" sublabel={`${reviewed} of ${stats.total} leads reviewed this week`} />
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
                  {FILTER_LABELS[f] || f}
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
                  <tr key={j.id} className="border-t border-border/70 hover:bg-muted/40 transition">
                    <td className="px-4 py-3">
                      <Link to={`/algoscout/job/${j.id}`} className="font-medium text-foreground hover:text-emerald-600 dark:hover:text-emerald-400">
                        {j.company}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-foreground/80">
                      <Link to={`/algoscout/job/${j.id}`} className="hover:text-emerald-600 dark:hover:text-emerald-400">{j.role}</Link>
                    </td>
                    <td className="px-4 py-3"><ScorePill score={Number(j.score)} job={j as any} /></td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
                        j.status === "approved" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" :
                        j.status === "rejected" ? "bg-rose-500/15 text-rose-600 dark:text-rose-400" :
                        "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                      }`}>
                        {j.status === "approved" ? "Applied" : j.status === "rejected" ? "Rejected" : "Pending"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(j.found_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      {j.job_url ? (
                        <a href={j.job_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline">
                          Open <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleApprove(j.id)} className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2.5 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/25">
                          <Check className="h-3.5 w-3.5" /> Approve
                        </button>
                        <button onClick={() => setStatus(j.id, "rejected")} className="inline-flex items-center gap-1 rounded-md bg-rose-500/15 px-2.5 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 ring-1 ring-rose-500/30 transition hover:bg-rose-500/25">
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

  async function handleApprove(jobId: string) {
    if (!user) return;
    // Show loading
    toast.info("Generating your tailored docs…");
    try {
      // 1. Generate docs
      const { error: docErr } = await supabase.functions.invoke("generate-docs", {
        body: { job_id: jobId, user_id: user.id },
      });
      if (docErr) throw docErr;

      // 2. Apply
      const { data, error: applyErr } = await supabase.functions.invoke("apply", {
        body: { job_id: jobId, user_id: user.id },
      });
      if (applyErr) throw applyErr;
      if ((data as any)?.error) throw new Error((data as any).error);

      setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status: "approved" } : j)));
      toast.success("Application submitted!");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to apply");
    }
  }
}
