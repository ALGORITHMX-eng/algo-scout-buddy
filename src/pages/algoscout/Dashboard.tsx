import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ExternalLink, Check, X, Inbox, Clock, CheckCircle2,
  XCircle, BellRing, Loader2, MapPin,
} from "lucide-react";
import { AlgoNavbar } from "@/components/algoscout/Navbar";
import { ScorePill } from "@/components/algoscout/ScorePill";
import { Sparkline } from "@/components/algoscout/Sparkline";
import { ProgressRing } from "@/components/algoscout/ProgressRing";
import { enablePushNotifications } from "@/lib/push-notifications";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type Job = {
  id: string;
  company: string;
  role: string;
  score: number;
  status: string;
  found_at: string;
  job_url: string | null;
  location: string | null;
  score_reason: string | null;
  raw_text: string | null;
  description: string | null;
  resume: string | null;
  cover_letter: string | null;
  breakdown: any;
};

const FILTERS = ["All", "pending", "approved", "rejected"];
const FILTER_LABELS: Record<string, string> = {
  All: "All",
  pending: "Pending",
  approved: "Applied",
  rejected: "Rejected",
};

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({
  label, value, icon: Icon, tone, trend,
}: {
  label: string; value: number; icon: any;
  tone: "muted" | "amber" | "emerald" | "rose"; trend: number[];
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

// ─── Job Description Side Panel ───────────────────────────────────────────────
function JobPanel({
  job, onClose, onApprove, onReject, approving,
}: {
  job: Job;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  approving: boolean;
}) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col border-l border-border bg-card shadow-2xl animate-in slide-in-from-right duration-300">
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div className="min-w-0">
            <div className="text-xs font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              {job.company}
            </div>
            <h2 className="mt-1 font-display text-lg font-semibold leading-tight text-foreground">
              {job.role}
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {job.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {job.location}
                </span>
              )}
              <span>· Found {new Date(job.found_at).toLocaleDateString()}</span>
            </div>
          </div>
          <div className="flex flex-shrink-0 flex-col items-end gap-2">
            <ScorePill score={Number(job.score)} job={job as any} />
            <button
              onClick={onClose}
              className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {job.score_reason && (
          <div className="border-b border-border bg-emerald-500/5 px-5 py-3">
            <div className="mb-1 text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Why it matched
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">{job.score_reason}</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-3 text-[10px] uppercase tracking-wider text-muted-foreground">
            Job description
          </div>
          {(job.raw_text || job.description) ? (
            <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/85">
              {job.raw_text || job.description}
            </p>
          ) : (
            <p className="text-sm italic text-muted-foreground">No description available.</p>
          )}
        </div>

        <div className="space-y-2 border-t border-border p-4">
          {job.job_url && (
            <a
              href={job.job_url}
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted"
            >
              View original posting <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => { onReject(job.id); onClose(); }}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 py-3 text-sm font-medium text-rose-600 transition hover:bg-rose-500/20 dark:text-rose-400"
            >
              <X className="h-4 w-4" /> Skip
            </button>
            <button
              onClick={() => onApprove(job.id)}
              disabled={approving}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-3 text-sm font-medium text-emerald-600 transition hover:bg-emerald-500/20 disabled:opacity-60 dark:text-emerald-400"
            >
              {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Approve & Generate
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Swipe Card ───────────────────────────────────────────────────────────────
function SwipeCard({ job, onApprove, onReject, isTop, stackIndex }: {
  job: Job; onApprove: (id: string) => void; onReject: (id: string) => void;
  isTop: boolean; stackIndex: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const currentX = useRef(0);
  const isDragging = useRef(false);
  const [dragX, setDragX] = useState(0);
  const [leaving, setLeaving] = useState<"left" | "right" | null>(null);
  const THRESHOLD = 100;

  const onPointerDown = (e: React.PointerEvent) => {
    if (!isTop) return;
    isDragging.current = true;
    startX.current = e.clientX;
    cardRef.current?.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current || !isTop) return;
    currentX.current = e.clientX - startX.current;
    setDragX(currentX.current);
  };
  const onPointerUp = () => {
    if (!isDragging.current || !isTop) return;
    isDragging.current = false;
    const dx = currentX.current;
    if (dx > THRESHOLD) { setLeaving("right"); setTimeout(() => onApprove(job.id), 300); }
    else if (dx < -THRESHOLD) { setLeaving("left"); setTimeout(() => onReject(job.id), 300); }
    else setDragX(0);
    currentX.current = 0;
  };

  const rotate = isTop ? `${(dragX / 20).toFixed(1)}deg` : "0deg";
  const translateX = leaving === "right" ? "120%" : leaving === "left" ? "-120%" : `${dragX}px`;
  const scaleBack = 1 - stackIndex * 0.04;
  const translateYBack = stackIndex * -8;
  const swipeRight = dragX > 40;
  const swipeLeft = dragX < -40;

  return (
    <div
      ref={cardRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className={`absolute inset-0 rounded-2xl border border-border bg-card select-none ${isTop ? "cursor-grab active:cursor-grabbing z-10" : "pointer-events-none"}`}
      style={{
        transform: isTop
          ? `translateX(${translateX}) rotate(${rotate})`
          : `translateY(${translateYBack}px) scale(${scaleBack})`,
        transition: leaving || !isDragging.current ? "transform 0.3s ease" : "none",
        zIndex: 10 - stackIndex,
        touchAction: "none",
      }}
    >
      <div
        className="absolute inset-0 rounded-2xl bg-emerald-500/20 border-2 border-emerald-500 flex items-start justify-start p-5 z-20 pointer-events-none transition-opacity duration-100"
        style={{ opacity: swipeRight ? Math.min((dragX - 40) / 60, 1) : 0 }}
      >
        <span className="rounded-lg border-2 border-emerald-500 px-3 py-1 text-sm font-bold text-emerald-500 rotate-[-12deg]">APPLY ✓</span>
      </div>
      <div
        className="absolute inset-0 rounded-2xl bg-rose-500/20 border-2 border-rose-500 flex items-start justify-end p-5 z-20 pointer-events-none transition-opacity duration-100"
        style={{ opacity: swipeLeft ? Math.min((-dragX - 40) / 60, 1) : 0 }}
      >
        <span className="rounded-lg border-2 border-rose-500 px-3 py-1 text-sm font-bold text-rose-500 rotate-[12deg]">SKIP ✕</span>
      </div>
      <div className="flex h-full flex-col p-5">
        <div className="mb-4 flex items-center justify-between">
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
            job.score >= 8 ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30"
            : job.score >= 6 ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/30"
            : "bg-muted text-muted-foreground ring-1 ring-border"}`}>
            {Number(job.score).toFixed(1)} / 10
          </span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {new Date(job.found_at).toLocaleDateString()}
          </span>
        </div>
        <div className="flex-1">
          <div className="text-xl font-semibold text-foreground leading-tight">{job.company}</div>
          <div className="mt-1 text-sm text-muted-foreground">{job.role}</div>
          {job.location && <div className="mt-2 text-xs text-muted-foreground/70">📍 {job.location}</div>}
        </div>
        {job.score_reason && (
          <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-muted-foreground border-t border-border pt-3">
            {job.score_reason}
          </p>
        )}
        {job.job_url && (
          <a href={job.job_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
            className="mt-3 inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline">
            View posting <ExternalLink className="h-3 w-3" />
          </a>
        )}
        {isTop && (
          <p className="mt-3 text-center text-[10px] text-muted-foreground/50 select-none">← drag to skip · drag to apply →</p>
        )}
      </div>
    </div>
  );
}

// ─── Swipe Review ─────────────────────────────────────────────────────────────
function SwipeReview({ pending, onApprove, onReject }: {
  pending: Job[]; onApprove: (id: string) => void; onReject: (id: string) => void;
}) {
  const visible = pending.slice(0, 4);
  if (pending.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border text-center">
        <CheckCircle2 className="mb-2 h-8 w-8 text-emerald-500/50" />
        <p className="text-sm text-muted-foreground">All caught up — no pending leads.</p>
        <p className="mt-1 text-xs text-muted-foreground/60">New leads will appear here automatically.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-8">
      <div className="relative w-full max-w-xs flex-shrink-0" style={{ height: 288 }}>
        {[...visible].reverse().map((job, i) => {
          const stackIndex = visible.length - 1 - i;
          return (
            <SwipeCard key={job.id} job={job} onApprove={onApprove} onReject={onReject}
              isTop={stackIndex === 0} stackIndex={stackIndex} />
          );
        })}
      </div>
      <div className="flex w-full flex-col gap-4">
        <div className="text-sm font-medium text-foreground">
          Review queue
          <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-600 dark:text-amber-400">
            {pending.length} pending
          </span>
        </div>
        <div className="flex gap-3">
          <button onClick={() => pending[0] && onReject(pending[0].id)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 py-3 text-sm font-medium text-rose-600 dark:text-rose-400 transition hover:bg-rose-500/20">
            <X className="h-4 w-4" /> Skip
          </button>
          <button onClick={() => pending[0] && onApprove(pending[0].id)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-3 text-sm font-medium text-emerald-600 dark:text-emerald-400 transition hover:bg-emerald-500/20">
            <Check className="h-4 w-4" /> Apply
          </button>
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-muted/30 divide-y divide-border">
          {pending.slice(0, 5).map((j, i) => (
            <div key={j.id} className={`flex items-center justify-between px-3 py-2 ${i === 0 ? "bg-card" : ""}`}>
              <div className="min-w-0">
                <div className="truncate text-xs font-medium text-foreground">{j.company}</div>
                <div className="truncate text-[10px] text-muted-foreground">{j.role}</div>
              </div>
              <span className={`ml-2 flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                j.score >= 8 ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : "bg-amber-500/15 text-amber-600 dark:text-amber-400"}`}>
                {Number(j.score).toFixed(1)}
              </span>
            </div>
          ))}
          {pending.length > 5 && (
            <div className="px-3 py-2 text-[10px] text-muted-foreground">
              +{pending.length - 5} more in the table below
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function AlgoDashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("All");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [panelJob, setPanelJob] = useState<Job | null>(null);
  const [approving, setApproving] = useState<string | null>(null);

  const fetchJobs = async () => {
    const { data, error } = await supabase
      .from("jobs").select("*").order("found_at", { ascending: false });
    if (error) { console.error(error); toast.error("Failed to load jobs"); }
    setJobs((data as any[]) || []);
  };

  useEffect(() => {
    const load = async () => { setLoading(true); await fetchJobs(); setLoading(false); };
    load();
    if ("Notification" in window && Notification.permission === "granted") {
      setPushEnabled(true);
    }
  }, [user]);

  const stats = useMemo(() => ({
    total: jobs.length,
    pending: jobs.filter((j) => j.status === "pending").length,
    approved: jobs.filter((j) => j.status === "approved").length,
    rejected: jobs.filter((j) => j.status === "rejected").length,
  }), [jobs]);

  const trendArrays = useMemo(() => ({
    total: Array(7).fill(stats.total),
    pending: Array(7).fill(stats.pending),
    approved: Array(7).fill(stats.approved),
    rejected: Array(7).fill(stats.rejected),
  }), [stats]);

  const reviewed = stats.approved + stats.rejected;

  const pendingJobs = useMemo(
    () => jobs.filter((j) => j.status === "pending").sort((a, b) => b.score - a.score),
    [jobs],
  );

  // "All" tab shows only pending — jobs leave table after approve/reject
  // but Total Leads stat still counts everything
  const visible = useMemo(() => {
    if (filter === "All") return jobs.filter((j) => j.status === "pending");
    return jobs.filter((j) => j.status === filter);
  }, [jobs, filter]);

  const handleApprove = async (jobId: string) => {
    if (!user) return;
    setApproving(jobId);
    try {
      const { error } = await supabase.from("jobs").update({ status: "approved" } as any).eq("id", jobId);
      if (error) throw error;
      setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status: "approved" } : j)));
      setPanelJob(null);
      navigate(`/algoscout/job/${jobId}?generate=true`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to approve");
    } finally {
      setApproving(null);
    }
  };

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("jobs").update({ status } as any).eq("id", id);
    if (error) { toast.error("Failed to update status"); return; }
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status } : j)));
    setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleAll = () => {
    if (selected.size === visible.length) setSelected(new Set());
    else setSelected(new Set(visible.map((j) => j.id)));
  };
  const bulkAction = async (status: string) => {
    const ids = [...selected];
    await Promise.all(ids.map((id) => setStatus(id, status)));
    setSelected(new Set());
    toast.success(`${ids.length} jobs marked as ${status}`);
  };

  const handleEnablePush = async () => {
    if (pushEnabled) return;
    setPushBusy(true);
    try {
      const res = await enablePushNotifications();
      if (res.ok) {
        setPushEnabled(true);
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
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

      {panelJob && (
        <JobPanel
          job={panelJob}
          onClose={() => setPanelJob(null)}
          onApprove={handleApprove}
          onReject={(id) => { setStatus(id, "rejected"); setPanelJob(null); }}
          approving={approving === panelJob.id}
        />
      )}

      <main className="mx-auto max-w-6xl px-3 sm:px-5 py-8 space-y-6">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground">AI-scored job leads, ready for your review.</p>
          </div>

          <button
            onClick={handleEnablePush}
            disabled={pushBusy}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/15 px-3.5 py-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/25 disabled:opacity-60"
          >
            {pushBusy
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <BellRing className="h-3.5 w-3.5" />
            }
            {pushEnabled ? "Notifications enabled" : "Enable notifications"}
          </button>
        </div>

        {/* Progress ring */}
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4">
          <ProgressRing value={reviewed} total={stats.total} size={84} stroke={7}
            label="Weekly review progress"
            sublabel={`${reviewed} of ${stats.total} leads reviewed this week`} />
          <div className="hidden text-right sm:block">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Still pending</div>
            <div className="font-display text-2xl font-semibold text-foreground">{stats.pending}</div>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total leads" value={stats.total} icon={Inbox} tone="muted" trend={trendArrays.total} />
          <StatCard label="Pending" value={stats.pending} icon={Clock} tone="amber" trend={trendArrays.pending} />
          <StatCard label="Applied" value={stats.approved} icon={CheckCircle2} tone="emerald" trend={trendArrays.approved} />
          <StatCard label="Rejected" value={stats.rejected} icon={XCircle} tone="rose" trend={trendArrays.rejected} />
        </div>

        {/* Swipe review */}
        <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-foreground">Quick review</h2>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">swipe or use buttons</span>
          </div>
          <SwipeReview pending={pendingJobs} onApprove={handleApprove}
            onReject={(id) => setStatus(id, "rejected")} />
        </div>

        {/* Job table */}
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="font-display text-sm font-semibold text-foreground">Job leads</div>
              {selected.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{selected.size} selected</span>
                  <button onClick={() => bulkAction("approved")}
                    className="rounded-md bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30 hover:bg-emerald-500/25 transition">
                    Approve all
                  </button>
                  <button onClick={() => bulkAction("rejected")}
                    className="rounded-md bg-rose-500/15 px-2.5 py-1 text-xs font-medium text-rose-600 dark:text-rose-400 ring-1 ring-rose-500/30 hover:bg-rose-500/25 transition">
                    Reject all
                  </button>
                  <button onClick={() => setSelected(new Set())}
                    className="text-xs text-muted-foreground hover:text-foreground transition">Clear</button>
                </div>
              )}
            </div>
            <div className="flex gap-1 rounded-lg bg-muted p-1 ring-1 ring-border">
              {FILTERS.map((f) => (
                <button key={f} onClick={() => { setFilter(f); setSelected(new Set()); }}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                    filter === f ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                  {FILTER_LABELS[f] || f}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-3 text-left">
                    <input type="checkbox"
                      checked={visible.length > 0 && selected.size === visible.length}
                      onChange={toggleAll}
                      className="h-3.5 w-3.5 rounded border-border accent-emerald-500" />
                  </th>
                  <th className="px-4 py-3 text-left font-medium">Company</th>
                  <th className="px-4 py-3 text-left font-medium">Role</th>
                  <th className="px-4 py-3 text-left font-medium">Score</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Date found</th>
                  <th className="px-4 py-3 text-left font-medium">Details</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((j) => (
                  <tr key={j.id}
                    className={`border-t border-border/70 transition hover:bg-muted/40 ${selected.has(j.id) ? "bg-emerald-500/5" : ""}`}>
                    <td className="px-3 py-3">
                      <input type="checkbox" checked={selected.has(j.id)} onChange={() => toggleSelect(j.id)}
                        className="h-3.5 w-3.5 rounded border-border accent-emerald-500" />
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">{j.company}</td>
                    <td className="px-4 py-3 text-foreground/80">{j.role}</td>
                    <td className="px-4 py-3"><ScorePill score={Number(j.score)} job={j as any} /></td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
                        j.status === "approved" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : j.status === "rejected" ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                        : "bg-amber-500/15 text-amber-600 dark:text-amber-400"}`}>
                        {j.status === "approved" ? "Applied" : j.status === "rejected" ? "Rejected" : "Pending"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(j.found_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => setPanelJob(j)}
                        className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline">
                        Open <ExternalLink className="h-3 w-3" />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleApprove(j.id)} disabled={approving === j.id}
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2.5 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/25 disabled:opacity-60">
                          {approving === j.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Approve
                        </button>
                        <button onClick={() => setStatus(j.id, "rejected")}
                          className="inline-flex items-center gap-1 rounded-md bg-rose-500/15 px-2.5 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 ring-1 ring-rose-500/30 transition hover:bg-rose-500/25">
                          <X className="h-3.5 w-3.5" /> Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      {filter === "All" ? "No pending leads — check Applied or Rejected tabs." : "No jobs match this filter."}
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