import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ExternalLink, Check, X, Inbox, Clock, CheckCircle2,
  XCircle, BellRing, Loader2, Search,
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

// ─── Swipe Card ───────────────────────────────────────────────────────────────
function SwipeCard({
  job, onApprove, onReject, isTop, stackIndex,
}: {
  job: Job;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  isTop: boolean;
  stackIndex: number;
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
    if (dx > THRESHOLD) {
      setLeaving("right");
      setTimeout(() => onApprove(job.id), 300);
    } else if (dx < -THRESHOLD) {
      setLeaving("left");
      setTimeout(() => onReject(job.id), 300);
    } else {
      setDragX(0);
    }
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
      className={`absolute inset-0 rounded-2xl border border-border bg-card select-none ${
        isTop ? "cursor-grab active:cursor-grabbing z-10" : "pointer-events-none"
      }`}
      style={{
        transform: isTop
          ? `translateX(${translateX}) rotate(${rotate})`
          : `translateY(${translateYBack}px) scale(${scaleBack})`,
        transition: leaving || !isDragging.current ? "transform 0.3s ease" : "none",
        zIndex: 10 - stackIndex,
        touchAction: "none",
      }}
    >
      {/* Approve overlay */}
      <div
        className="absolute inset-0 rounded-2xl bg-emerald-500/20 border-2 border-emerald-500 flex items-start justify-start p-5 z-20 pointer-events-none transition-opacity duration-100"
        style={{ opacity: swipeRight ? Math.min((dragX - 40) / 60, 1) : 0 }}
      >
        <span className="rounded-lg border-2 border-emerald-500 px-3 py-1 text-sm font-bold text-emerald-500 rotate-[-12deg]">
          APPLY ✓
        </span>
      </div>

      {/* Reject overlay */}
      <div
        className="absolute inset-0 rounded-2xl bg-rose-500/20 border-2 border-rose-500 flex items-start justify-end p-5 z-20 pointer-events-none transition-opacity duration-100"
        style={{ opacity: swipeLeft ? Math.min((-dragX - 40) / 60, 1) : 0 }}
      >
        <span className="rounded-lg border-2 border-rose-500 px-3 py-1 text-sm font-bold text-rose-500 rotate-[12deg]">
          SKIP ✕
        </span>
      </div>

      <div className="flex h-full flex-col p-5">
        {/* Score + date */}
        <div className="mb-4 flex items-center justify-between">
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
            job.score >= 8
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30"
              : job.score >= 6
              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/30"
              : "bg-muted text-muted-foreground ring-1 ring-border"
          }`}>
            {Number(job.score).toFixed(1)} / 10
          </span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {new Date(job.found_at).toLocaleDateString()}
          </span>
        </div>

        {/* Company + role */}
        <div className="flex-1">
          <div className="text-xl font-semibold text-foreground leading-tight">{job.company}</div>
          <div className="mt-1 text-sm text-muted-foreground">{job.role}</div>
          {job.location && (
            <div className="mt-2 text-xs text-muted-foreground/70">📍 {job.location}</div>
          )}
        </div>

        {/* Score reason */}
        {job.score_reason && (
          <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-muted-foreground border-t border-border pt-3">
            {job.score_reason}
          </p>
        )}

        {/* Link */}
        {job.job_url && (
          <a
            href={job.job_url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="mt-3 inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            View posting <ExternalLink className="h-3 w-3" />
          </a>
        )}

        {isTop && (
          <p className="mt-3 text-center text-[10px] text-muted-foreground/50 select-none">
            ← drag to skip · drag to apply →
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Swipe Review Section ─────────────────────────────────────────────────────
function SwipeReview({
  pending, onApprove, onReject,
}: {
  pending: Job[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const visible = pending.slice(0, 4);

  if (pending.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border text-center">
        <CheckCircle2 className="mb-2 h-8 w-8 text-emerald-500/50" />
        <p className="text-sm text-muted-foreground">All caught up — no pending leads.</p>
        <p className="mt-1 text-xs text-muted-foreground/60">Hit Find Jobs to scan for new matches.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-8">
      {/* Card stack */}
      <div className="relative w-full max-w-xs flex-shrink-0" style={{ height: 288 }}>
        {[...visible].reverse().map((job, i) => {
          const stackIndex = visible.length - 1 - i;
          return (
            <SwipeCard
              key={job.id}
              job={job}
              onApprove={onApprove}
              onReject={onReject}
              isTop={stackIndex === 0}
              stackIndex={stackIndex}
            />
          );
        })}
      </div>

      {/* Controls + queue */}
      <div className="flex w-full flex-col gap-4">
        <div className="text-sm font-medium text-foreground">
          Review queue
          <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-600 dark:text-amber-400">
            {pending.length} pending
          </span>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => pending[0] && onReject(pending[0].id)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 py-3 text-sm font-medium text-rose-600 dark:text-rose-400 transition hover:bg-rose-500/20"
          >
            <X className="h-4 w-4" /> Skip
          </button>
          <button
            onClick={() => pending[0] && onApprove(pending[0].id)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-3 text-sm font-medium text-emerald-600 dark:text-emerald-400 transition hover:bg-emerald-500/20"
          >
            <Check className="h-4 w-4" /> Apply
          </button>
        </div>

        {/* Mini queue */}
        <div className="overflow-hidden rounded-xl border border-border bg-muted/30 divide-y divide-border">
          {pending.slice(0, 5).map((j, i) => (
            <div key={j.id} className={`flex items-center justify-between px-3 py-2 ${i === 0 ? "bg-card" : ""}`}>
              <div className="min-w-0">
                <div className="truncate text-xs font-medium text-foreground">{j.company}</div>
                <div className="truncate text-[10px] text-muted-foreground">{j.role}</div>
              </div>
              <span className={`ml-2 flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                j.score >= 8
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
              }`}>
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
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("All");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pushBusy, setPushBusy] = useState(false);
  const [scanning, setScanning] = useState(false);

  // Fetch jobs
  const fetchJobs = async () => {
    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .order("found_at", { ascending: false });
    if (error) { console.error(error); toast.error("Failed to load jobs"); }
    setJobs((data as any[]) || []);
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchJobs();
      setLoading(false);
    };
    load();
  }, [user]);

  // Stats
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

  const visible = useMemo(() => {
    if (filter === "All") return jobs;
    return jobs.filter((j) => j.status === filter);
  }, [jobs, filter]);

  // ── Find Jobs ───────────────────────────────────────────────────────────────
  const handleFindJobs = async () => {
    if (!user) return;
    setScanning(true);
    try {
      const { error } = await supabase.functions.invoke("trigger-scout", {
        body: {},
      });
      if (error) throw error;
      toast.success("Scanning in background — new jobs will appear shortly!");
      // Wait 30s then refresh
      setTimeout(async () => {
        await fetchJobs();
      }, 30000);
    } catch (err: any) {
      toast.error(err?.message || "Scan failed");
    } finally {
      setScanning(false);
    }
  };

  // ── Status helpers ──────────────────────────────────────────────────────────
  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("jobs").update({ status } as any).eq("id", id);
    if (error) { toast.error("Failed to update status"); return; }
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status } : j)));
    setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
  };

  const handleApprove = async (jobId: string) => {
    if (!user) return;
    toast.info("Generating your tailored docs…");
    try {
      const { error: docErr } = await supabase.functions.invoke("generate-docs", {
        body: { job_id: jobId, user_id: user.id },
      });
      if (docErr) throw docErr;

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
  };

  // ── Multi-select ────────────────────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const toggleAll = () => {
    if (selected.size === visible.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(visible.map((j) => j.id)));
    }
  };

  const bulkAction = async (status: string) => {
    const ids = [...selected];
    await Promise.all(ids.map((id) => setStatus(id, status)));
    setSelected(new Set());
    toast.success(`${ids.length} jobs marked as ${status}`);
  };

  // ── Push notifications ──────────────────────────────────────────────────────
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

      <main className="mx-auto max-w-6xl px-3 sm:px-5 py-8 space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground">AI-scored job leads, ready for your review.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleFindJobs}
              disabled={scanning}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-60"
            >
              {scanning ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Scanning…
                </>
              ) : (
                <>
                  <Search className="h-3.5 w-3.5" />
                  Find Jobs
                </>
              )}
            </button>
            <button
              onClick={handleEnablePush}
              disabled={pushBusy}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/15 px-3.5 py-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/25 disabled:opacity-60"
            >
              {pushBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BellRing className="h-3.5 w-3.5" />}
              Enable Notifications
            </button>
          </div>
        </div>

        {/* ── Progress ring ── */}
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4">
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

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total leads" value={stats.total} icon={Inbox} tone="muted" trend={trendArrays.total} />
          <StatCard label="Pending" value={stats.pending} icon={Clock} tone="amber" trend={trendArrays.pending} />
          <StatCard label="Applied" value={stats.approved} icon={CheckCircle2} tone="emerald" trend={trendArrays.approved} />
          <StatCard label="Rejected" value={stats.rejected} icon={XCircle} tone="rose" trend={trendArrays.rejected} />
        </div>

        {/* ── Swipe review ── */}
        <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-foreground">Quick review</h2>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              swipe or use buttons
            </span>
          </div>
          <SwipeReview
            pending={pendingJobs}
            onApprove={handleApprove}
            onReject={(id) => setStatus(id, "rejected")}
          />
        </div>

        {/* ── Job table ── */}
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="font-display text-sm font-semibold text-foreground">Job leads</div>
              {selected.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{selected.size} selected</span>
                  <button
                    onClick={() => bulkAction("approved")}
                    className="rounded-md bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30 hover:bg-emerald-500/25 transition"
                  >
                    Approve all
                  </button>
                  <button
                    onClick={() => bulkAction("rejected")}
                    className="rounded-md bg-rose-500/15 px-2.5 py-1 text-xs font-medium text-rose-600 dark:text-rose-400 ring-1 ring-rose-500/30 hover:bg-rose-500/25 transition"
                  >
                    Reject all
                  </button>
                  <button
                    onClick={() => setSelected(new Set())}
                    className="text-xs text-muted-foreground hover:text-foreground transition"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
            <div className="flex gap-1 rounded-lg bg-muted p-1 ring-1 ring-border">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => { setFilter(f); setSelected(new Set()); }}
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
                  <th className="px-3 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={visible.length > 0 && selected.size === visible.length}
                      onChange={toggleAll}
                      className="h-3.5 w-3.5 rounded border-border accent-emerald-500"
                    />
                  </th>
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
                  <tr
                    key={j.id}
                    className={`border-t border-border/70 transition hover:bg-muted/40 ${
                      selected.has(j.id) ? "bg-emerald-500/5" : ""
                    }`}
                  >
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(j.id)}
                        onChange={() => toggleSelect(j.id)}
                        className="h-3.5 w-3.5 rounded border-border accent-emerald-500"
                      />
                    </td>
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
                      <ScorePill score={Number(j.score)} job={j as any} />
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
                        j.status === "approved"
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : j.status === "rejected"
                          ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                          : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                      }`}>
                        {j.status === "approved" ? "Applied" : j.status === "rejected" ? "Rejected" : "Pending"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(j.found_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {j.job_url ? (
                        <a
                          href={j.job_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
                        >
                          Open <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleApprove(j.id)}
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2.5 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/25"
                        >
                          <Check className="h-3.5 w-3.5" /> Approve
                        </button>
                        <button
                          onClick={() => setStatus(j.id, "rejected")}
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
                    <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      {filter === "All"
                        ? "No jobs yet — hit Find Jobs to start scouting."
                        : "No jobs match this filter."}
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