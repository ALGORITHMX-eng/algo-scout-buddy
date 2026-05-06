import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, ExternalLink, FileText, MapPin, X, Loader2 } from "lucide-react";
import { AlgoNavbar } from "@/components/algoscout/Navbar";
import { ScorePill } from "@/components/algoscout/ScorePill";
import { CoverLetterDoc } from "@/components/algoscout/CoverLetterDoc";
import { NotesPanel } from "@/components/algoscout/NotesPanel";
import { TagEditor } from "@/components/algoscout/TagEditor";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="rounded-xl border border-border bg-card p-5">
    <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
    <div className="text-[14px] leading-relaxed text-foreground/90">{children}</div>
  </section>
);

export default function AlgoJobDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    if (!id || !user) return;
    (async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", id)
        .single();
      if (error || !data) {
        setJob(null);
      } else {
        setJob(data);
      }
      setLoading(false);
    })();
  }, [id, user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <AlgoNavbar />
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <AlgoNavbar />
        <div className="mx-auto max-w-3xl px-5 py-16 text-center">
          <p className="text-muted-foreground">Job not found.</p>
          <Link to="/algoscout" className="mt-3 inline-block text-emerald-600 dark:text-emerald-400 hover:underline">Back to dashboard</Link>
        </div>
      </div>
    );
  }

  const setStatus = async (status: string) => {
    const { error } = await supabase.from("jobs").update({ status } as any).eq("id", job.id);
    if (error) { toast.error("Failed to update"); return; }
    setJob({ ...job, status });
    toast.success(`Job ${status}`);
  };

  const handleApprove = async () => {
    if (!user) return;
    setApproving(true);
    toast.info("Generating your tailored docs…");
    try {
      const { error: docErr } = await supabase.functions.invoke("generate-docs", {
        body: { job_id: job.id, user_id: user.id },
      });
      if (docErr) throw docErr;

      const { data, error: applyErr } = await supabase.functions.invoke("apply", {
        body: { job_id: job.id, user_id: user.id },
      });
      if (applyErr) throw applyErr;
      if ((data as any)?.error) throw new Error((data as any).error);

      setJob({ ...job, status: "approved" });
      toast.success("Application submitted!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to apply");
    } finally {
      setApproving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AlgoNavbar />
      <main className="mx-auto max-w-3xl px-5 py-8">
        <button onClick={() => navigate("/algoscout")} className="mb-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
        </button>

        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">{job.company}</div>
              <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-foreground">{job.role}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {job.location || "Unknown"}</span>
                <span>· Found {new Date(job.found_at).toLocaleDateString()}</span>
                <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
                  job.status === "approved" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" :
                  job.status === "rejected" ? "bg-rose-500/15 text-rose-600 dark:text-rose-400" :
                  "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                }`}>
                  {job.status === "approved" ? "Applied" : job.status === "rejected" ? "Rejected" : "Pending"}
                </span>
              </div>
            </div>
            <ScorePill score={Number(job.score)} size="lg" job={job} />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              onClick={handleApprove}
              disabled={approving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3.5 py-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/25 disabled:opacity-60"
            >
              {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Approve
            </button>
            <button
              onClick={() => setStatus("rejected")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/15 px-3.5 py-2 text-sm font-medium text-rose-600 dark:text-rose-400 ring-1 ring-rose-500/30 transition hover:bg-rose-500/25"
            >
              <X className="h-4 w-4" /> Reject
            </button>
            {job.job_url && (
              <a href={job.job_url} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3.5 py-2 text-sm font-medium text-foreground transition hover:bg-muted">
                Open application <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          <section className="rounded-xl border border-border bg-card p-5">
            <TagEditor jobId={job.id} />
          </section>

          <NotesPanel jobId={job.id} />

          <Section title="Why this score">{job.reason || "No reason provided."}</Section>
          <Section title="Job description">
            <p className="whitespace-pre-line">{job.description || "No description available."}</p>
          </Section>

          {(job.resume || job.cover_letter) && (
            <section className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="border-b border-border px-5 py-3">
                <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">Documents</h2>
              </div>
              {job.resume && (
                <div className="p-5 border-b border-border">
                  <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Tailored Resume</h3>
                  <pre className="whitespace-pre-wrap font-sans text-sm text-foreground/90">{job.resume}</pre>
                </div>
              )}
              {job.cover_letter && (
                <CoverLetterDoc body={job.cover_letter} company={job.company} role={job.role} date={new Date(job.found_at).toLocaleDateString()} />
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
