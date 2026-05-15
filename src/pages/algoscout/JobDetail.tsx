import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Check, X, ExternalLink, MapPin, Loader2,
  Download, Send, Zap, CreditCard, RotateCcw,
} from "lucide-react";
import { AlgoNavbar } from "@/components/algoscout/Navbar";
import { ScorePill } from "@/components/algoscout/ScorePill";
import { CoverLetterDoc } from "@/components/algoscout/CoverLetterDoc";
import { NotesPanel } from "@/components/algoscout/NotesPanel";
import { TagEditor } from "@/components/algoscout/TagEditor";
import { ScoreBreakdown } from "@/components/algoscout/ScoreBreakdown";
import { downloadResumePDF } from "@/components/algoscout/ResumePDF";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────
type ResumeData = {
  name: string; email: string; phone: string; location: string;
  linkedin?: string; github?: string; portfolio?: string;
  summary: string;
  experience: { title: string; company: string; duration: string; bullets: string[] }[];
  projects?: { name: string; description: string; tech: string[] }[];
  skills: string[];
  education: { degree: string; school: string; year: string };
};

type GenState = "idle" | "generating" | "done" | "error";
type LaunchState = "idle" | "applying" | "done" | "no_credits";

// ─── Typing animation hook ────────────────────────────────────────────────────
function useTypingText(text: string, active: boolean, speed = 18) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  const idx = useRef(0);

  useEffect(() => {
    if (!active || !text) return;
    setDisplayed("");
    setDone(false);
    idx.current = 0;
    const interval = setInterval(() => {
      idx.current++;
      setDisplayed(text.slice(0, idx.current));
      if (idx.current >= text.length) { clearInterval(interval); setDone(true); }
    }, speed);
    return () => clearInterval(interval);
  }, [text, active]);

  return { displayed, done };
}

// ─── AI Character bubble ──────────────────────────────────────────────────────
function AIBubble({ message, onDone }: { message: string; onDone?: () => void }) {
  const { displayed, done } = useTypingText(message, !!message, 16);
  useEffect(() => { if (done && onDone) onDone(); }, [done]);

  return (
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
        <span className="text-sm">🤖</span>
      </div>
      <div className="rounded-2xl rounded-tl-none border border-border bg-muted/50 px-4 py-3 text-sm text-foreground leading-relaxed max-w-sm">
        {displayed}
        {!done && <span className="inline-block w-1 h-4 ml-0.5 bg-emerald-500 animate-pulse rounded-sm" />}
      </div>
    </div>
  );
}

// ─── Resume rendered in clean format ─────────────────────────────────────────
function ResumePreview({ data }: { data: ResumeData }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 font-mono text-sm space-y-4">
      <div className="text-center border-b border-border pb-4">
        <div className="text-lg font-bold text-foreground tracking-wide">{data.name}</div>
        <div className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {data.phone && <span>{data.phone}</span>}
          {data.email && <span>| {data.email}</span>}
          {data.location && <span>| {data.location}</span>}
          {data.linkedin && <a href={data.linkedin} target="_blank" rel="noreferrer" className="text-emerald-600 dark:text-emerald-400 hover:underline">| LinkedIn</a>}
          {data.github && <a href={data.github} target="_blank" rel="noreferrer" className="text-emerald-600 dark:text-emerald-400 hover:underline">| GitHub</a>}
        </div>
      </div>

      {data.summary && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-foreground border-b border-foreground/20 pb-1 mb-2">Professional Summary</div>
          <p className="text-xs leading-relaxed text-foreground/85">{data.summary}</p>
        </div>
      )}

      {data.skills?.length > 0 && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-foreground border-b border-foreground/20 pb-1 mb-2">Technical Skills</div>
          <p className="text-xs text-foreground/85 leading-relaxed">{data.skills.join(" · ")}</p>
        </div>
      )}

      {data.experience?.length > 0 && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-foreground border-b border-foreground/20 pb-1 mb-2">Experience</div>
          <div className="space-y-3">
            {data.experience.map((exp, i) => (
              <div key={i}>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-semibold text-foreground">{exp.title}</span>
                  <span className="text-[10px] text-muted-foreground">{exp.duration}</span>
                </div>
                <div className="text-[10px] italic text-muted-foreground mb-1">{exp.company}</div>
                <ul className="space-y-1">
                  {exp.bullets?.map((b, j) => (
                    <li key={j} className="flex gap-2 text-[11px] text-foreground/80 leading-relaxed">
                      <span className="text-muted-foreground mt-0.5">•</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.projects?.length > 0 && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-foreground border-b border-foreground/20 pb-1 mb-2">Projects</div>
          <div className="space-y-2">
            {data.projects.map((p, i) => (
              <div key={i}>
                <span className="text-xs font-semibold text-foreground">{p.name}</span>
                <span className="text-[10px] text-muted-foreground ml-2">— {p.description}</span>
                <div className="text-[10px] italic text-muted-foreground">{p.tech?.join(" · ")}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.education && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-foreground border-b border-foreground/20 pb-1 mb-2">Education</div>
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-semibold text-foreground">{data.education.school}</span>
            <span className="text-[10px] text-muted-foreground">{data.education.year}</span>
          </div>
          <div className="text-[10px] italic text-muted-foreground">{data.education.degree}</div>
        </div>
      )}
    </div>
  );
}

// ─── Generating skeleton ──────────────────────────────────────────────────────
function GeneratingSkeleton({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3 animate-pulse">
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{label}</span>
      </div>
      <div className="space-y-2">
        <div className="h-2.5 w-3/4 rounded bg-muted" />
        <div className="h-2.5 w-full rounded bg-muted" />
        <div className="h-2.5 w-5/6 rounded bg-muted" />
        <div className="h-2.5 w-2/3 rounded bg-muted" />
      </div>
    </div>
  );
}

// ─── Launch Pad ───────────────────────────────────────────────────────────────
function LaunchPad({ job, resumeData, user }: { job: any; resumeData: ResumeData | null; user: any }) {
  const [launchState, setLaunchState] = useState<LaunchState>("idle");
  const [credits, setCredits] = useState<number | null>(null);
  const [bubbleMsg, setBubbleMsg] = useState("");
  const [showBubble, setShowBubble] = useState(false);
  const [bubbleDone, setBubbleDone] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("auto_apply_credits").eq("user_id", user.id).single()
      .then(({ data }) => setCredits(data?.auto_apply_credits ?? 0));
  }, [user]);

  const handleAutoApply = async () => {
    if (credits === null) return;
    if (credits <= 0) {
      setLaunchState("no_credits");
      setBubbleMsg("Ah, you're out of auto-apply credits. Top up and I'll fire this application for you 👇");
      setShowBubble(true); setBubbleDone(false); return;
    }
    setLaunchState("applying");
    setBubbleMsg("Say less — locking in your application right now...");
    setShowBubble(true); setBubbleDone(false);
    try {
      const { data, error } = await supabase.functions.invoke("apply", { body: { job_id: job.id, user_id: user.id } });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      setLaunchState("done");
      setBubbleMsg("Application fired! You're in the running. I'll let you know if anything comes back 🚀");
      setCredits((c) => (c !== null ? c - 1 : null));
    } catch (err: any) {
      setLaunchState("idle");
      setBubbleMsg("Something went wrong trying to apply. Try again in a moment.");
      toast.error(err?.message || "Auto-apply failed");
    }
  };

  const handleDownload = async () => {
    if (!resumeData) return;
    try {
      await downloadResumePDF(resumeData, `${job.company}_${job.role}_Resume.pdf`);
      toast.success("Resume downloaded!");
    } catch { toast.error("Failed to download PDF"); }
  };

  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="border-b border-border bg-emerald-500/5 px-5 py-3 flex items-center gap-2">
        <Zap className="h-4 w-4 text-emerald-500" />
        <span className="text-sm font-semibold text-foreground">Launch pad</span>
        {credits !== null && (
          <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">
            {credits} auto-apply credit{credits !== 1 ? "s" : ""} remaining
          </span>
        )}
      </div>
      <div className="p-5 space-y-4">
        {showBubble && <AIBubble message={bubbleMsg} onDone={() => setBubbleDone(true)} />}
        {!showBubble && launchState === "idle" && (
          <AIBubble message={credits === 0
            ? "Everything looks great. Get some credits and I'll fire this application for you."
            : "Everything's locked and loaded. Want me to fire this application? 🎯"} />
        )}
        <div className="flex flex-wrap gap-3 pt-1">
          <button onClick={handleDownload} disabled={!resumeData}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted disabled:opacity-40">
            <Download className="h-4 w-4" /> Download Resume PDF
          </button>
          {launchState === "done" ? (
            <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/15 px-4 py-2.5 text-sm font-medium text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30">
              <Check className="h-4 w-4" /> Application sent!
            </div>
          ) : launchState === "no_credits" && bubbleDone ? (
            <button onClick={() => window.location.href = "/algoscout/settings?tab=credits"}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-500/15 px-4 py-2.5 text-sm font-medium text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/30 transition hover:bg-amber-500/25">
              <CreditCard className="h-4 w-4" /> Buy auto-apply credits
            </button>
          ) : (
            <button onClick={handleAutoApply} disabled={launchState === "applying" || credits === null}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-60">
              {launchState === "applying"
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Applying...</>
                : <><Zap className="h-4 w-4" /> Auto-Apply</>}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── Tweak Chat ───────────────────────────────────────────────────────────────
function TweakChat({ job, resumeData, coverLetter, onResumeUpdate, onCoverUpdate, user }: {
  job: any; resumeData: ResumeData | null; coverLetter: string;
  onResumeUpdate: (data: ResumeData) => void; onCoverUpdate: (text: string) => void; user: any;
}) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([
    { role: "ai", text: "Need to tweak anything? Tell me — 'make it denser', 'more aggressive tone', 'emphasize ML skills'..." }
  ]);

  const handleSend = async () => {
    const msg = input.trim();
    if (!msg || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: msg }]);
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("resume-tweak", {
        body: { user_id: user.id, job_id: job.id, instruction: msg, current_resume: resumeData, current_cover_letter: coverLetter, mode: "tweak" },
      });
      if (error) throw error;
      const updated = data as any;
      if (updated.resume) onResumeUpdate(updated.resume);
      if (updated.cover_letter) onCoverUpdate(updated.cover_letter);
      setMessages((prev) => [...prev, { role: "ai", text: updated.message || "Done — I've updated the docs based on your instruction." }]);
    } catch {
      setMessages((prev) => [...prev, { role: "ai", text: "Couldn't apply that tweak. Try rephrasing or try again." }]);
    } finally { setLoading(false); }
  };

  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="border-b border-border px-5 py-3">
        <h2 className="text-sm font-semibold text-foreground">Tweak with AI</h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">Tell me what to change — I'll update both docs live</p>
      </div>
      <div className="px-5 py-4 space-y-3 max-h-60 overflow-y-auto">
        {messages.map((m, i) => (
          m.role === "ai"
            ? <AIBubble key={i} message={m.text} />
            : <div key={i} className="flex justify-end">
                <div className="rounded-2xl rounded-tr-none bg-emerald-500/15 border border-emerald-500/20 px-4 py-2.5 text-sm text-foreground max-w-xs">{m.text}</div>
              </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-500" /> Updating your docs...
          </div>
        )}
      </div>
      <div className="border-t border-border p-3 flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder="e.g. make it denser, emphasize Python, shorter summary..."
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/50" />
        <button onClick={handleSend} disabled={!input.trim() || loading}
          className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-3 py-2 text-white transition hover:bg-emerald-600 disabled:opacity-50">
          <Send className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}

// ─── Main JobDetail ───────────────────────────────────────────────────────────
export default function AlgoJobDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [genState, setGenState] = useState<GenState>("idle");
  const [resumeData, setResumeData] = useState<ResumeData | null>(null);
  const [coverLetter, setCoverLetter] = useState<string>("");
  const [resumeReady, setResumeReady] = useState(false);
  const [coverReady, setCoverReady] = useState(false);

  useEffect(() => {
    if (!id || !user) return;
    (async () => {
      const { data, error } = await supabase.from("jobs").select("*").eq("id", id).single();
      if (error || !data) { setJob(null); setLoading(false); return; }
      setJob(data);
      if (data.resume_notes) {
        try {
          const parsed = typeof data.resume_notes === "string" ? JSON.parse(data.resume_notes) : data.resume_notes;
          setResumeData(parsed); setResumeReady(true);
        } catch {}
      }
      if (data.cover_letter_notes) { setCoverLetter(data.cover_letter_notes); setCoverReady(true); }
      setLoading(false);
    })();
  }, [id, user]);

  useEffect(() => {
    if (!job || !user) return;
    if (searchParams.get("generate") === "true" && !job.resume_notes) handleGenerate();
  }, [job, user]);

  const handleGenerate = async () => {
    if (!user || !job) return;
    setGenState("generating"); setResumeReady(false); setCoverReady(false);
    try {
      const { data, error } = await supabase.functions.invoke("generate-docs", {
        body: { job_id: job.id, user_id: user.id, current_resume: null, current_cover_letter: "" },
      });
      if (error) throw error;
      const result = data as any;
      if (result.resume) {
        setResumeData(result.resume);
        setTimeout(() => {
          setResumeReady(true);
          if (result.cover_letter) {
            setTimeout(() => { setCoverLetter(result.cover_letter); setCoverReady(true); setGenState("done"); }, 800);
          } else { setGenState("done"); }
        }, 400);
      } else { setGenState("error"); }
    } catch (err: any) {
      console.error(err); setGenState("error"); toast.error("Generation failed — try again");
    }
  };

  const setStatus = async (status: string) => {
    const { error } = await supabase.from("jobs").update({ status } as any).eq("id", job.id);
    if (error) { toast.error("Failed to update"); return; }
    setJob({ ...job, status });
  };

  // Parse score breakdown from job
  const breakdown = (() => {
    if (!job?.score_breakdown) return null;
    try {
      return typeof job.score_breakdown === "string"
        ? JSON.parse(job.score_breakdown)
        : job.score_breakdown;
    } catch { return null; }
  })();

  if (loading) return (
    <div className="min-h-screen bg-background text-foreground">
      <AlgoNavbar />
      <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
    </div>
  );

  if (!job) return (
    <div className="min-h-screen bg-background text-foreground">
      <AlgoNavbar />
      <div className="mx-auto max-w-3xl px-5 py-16 text-center">
        <p className="text-muted-foreground">Job not found.</p>
        <button onClick={() => navigate("/algoscout")} className="mt-3 inline-block text-emerald-600 dark:text-emerald-400 hover:underline text-sm">Back to dashboard</button>
      </div>
    </div>
  );

  const docsGenerated = resumeReady && coverReady;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AlgoNavbar />
      <main className="mx-auto max-w-3xl px-5 py-8 space-y-4">

        <button onClick={() => navigate("/algoscout")}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
        </button>

        {/* Job header */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">{job.company}</div>
              <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-foreground">{job.role}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {job.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {job.location}</span>}
                <span>· Found {new Date(job.found_at).toLocaleDateString()}</span>
                <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
                  job.status === "approved" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : job.status === "rejected" ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                  : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                }`}>
                  {job.status === "approved" ? "Applied" : job.status === "rejected" ? "Rejected" : "Pending"}
                </span>
              </div>
            </div>
            <ScorePill score={Number(job.score)} size="lg" job={job} />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {job.status !== "approved" && (
              <button onClick={() => setStatus("approved")}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3.5 py-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/25">
                <Check className="h-4 w-4" /> Mark applied
              </button>
            )}
            {job.status !== "rejected" && (
              <button onClick={() => setStatus("rejected")}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/15 px-3.5 py-2 text-sm font-medium text-rose-600 dark:text-rose-400 ring-1 ring-rose-500/30 transition hover:bg-rose-500/25">
                <X className="h-4 w-4" /> Reject
              </button>
            )}
            {job.job_url && (
              <a href={job.job_url} target="_blank" rel="noreferrer"
                className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3.5 py-2 text-sm font-medium text-foreground transition hover:bg-muted">
                View posting <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>

        {/* Tags + Notes */}
        <section className="rounded-xl border border-border bg-card p-5">
          <TagEditor jobId={job.id} />
        </section>
        <NotesPanel jobId={job.id} />

        {/* Score breakdown — replaces "Why this score" */}
        {breakdown ? (
          <ScoreBreakdown breakdown={breakdown} cumulative={Number(job.score)} />
        ) : (
          // Fallback for old jobs without breakdown data
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Why this score</h2>
            <p className="text-sm leading-relaxed text-foreground/85">{job.score_reason || job.reason || "No reason provided."}</p>
          </section>
        )}

        {/* Job description */}
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Job description</h2>
          <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/85">
            {job.raw_text || job.description || "No description available."}
          </p>
        </section>

        {/* Generation section */}
        <div className="space-y-4">
          {genState === "idle" && !docsGenerated && (
            <div className="rounded-xl border border-dashed border-border bg-card p-6 flex flex-col items-center gap-3 text-center">
              <div className="text-sm font-medium text-foreground">Ready to generate your tailored docs?</div>
              <p className="text-xs text-muted-foreground max-w-xs">I'll write a resume and cover letter tuned specifically for this role and company.</p>
              <button onClick={handleGenerate}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-600">
                <Zap className="h-4 w-4" /> Generate Resume & Cover Letter
              </button>
            </div>
          )}

          {genState === "error" && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 flex items-center justify-between">
              <p className="text-sm text-rose-600 dark:text-rose-400">Generation failed. Try again.</p>
              <button onClick={handleGenerate}
                className="inline-flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 hover:underline">
                <RotateCcw className="h-3.5 w-3.5" /> Retry
              </button>
            </div>
          )}

          {genState === "generating" && !resumeReady && <GeneratingSkeleton label="Writing your tailored resume..." />}

          {resumeReady && resumeData && (
            <section className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tailored Resume</h2>
                <button onClick={() => downloadResumePDF(resumeData, `${job.company}_${job.role}_Resume.pdf`)}
                  className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline">
                  <Download className="h-3 w-3" /> Download PDF
                </button>
              </div>
              <ResumePreview data={resumeData} />
            </section>
          )}

          {resumeReady && !coverReady && <GeneratingSkeleton label="Writing your cover letter..." />}

          {coverReady && coverLetter && (
            <section className="space-y-2">
              <div className="px-1">
                <h2 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Cover Letter</h2>
              </div>
              <CoverLetterDoc body={coverLetter} company={job.company} />
            </section>
          )}

          {docsGenerated && (
            <TweakChat job={job} resumeData={resumeData} coverLetter={coverLetter}
              onResumeUpdate={setResumeData} onCoverUpdate={setCoverLetter} user={user} />
          )}

          {docsGenerated && <LaunchPad job={job} resumeData={resumeData} user={user} />}
        </div>
      </main>
    </div>
  );
}