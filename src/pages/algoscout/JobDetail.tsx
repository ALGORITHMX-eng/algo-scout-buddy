import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, ExternalLink, FileText, MapPin, X } from "lucide-react";
import { AlgoNavbar } from "@/components/algoscout/Navbar";
import { ScorePill, StatusBadge } from "@/components/algoscout/ScorePill";
import { CoverLetterDoc } from "@/components/algoscout/CoverLetterDoc";
import { StatusTimeline } from "@/components/algoscout/StatusTimeline";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DEFAULT_RESUME_PDF_URL,
  Job,
  JobStatus,
  loadJobs,
  updateJobStatus,
} from "@/lib/algoscout-data";
import { setStage, TimelineData } from "@/lib/algoscout-timeline";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="rounded-xl border border-border bg-card p-5">
    <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
    <div className="text-[14px] leading-relaxed text-foreground/90">{children}</div>
  </section>
);

export default function AlgoJobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState<Job | null>(null);
  const [timelinePatch, setTimelinePatch] = useState<TimelineData | undefined>();

  useEffect(() => {
    const j = loadJobs().find((x) => x.id === id) || null;
    setJob(j);
  }, [id]);

  if (!job) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <AlgoNavbar />
        <div className="mx-auto max-w-3xl px-5 py-16 text-center">
          <p className="text-muted-foreground">Job not found.</p>
          <Link to="/algoscout" className="mt-3 inline-block text-emerald-600 dark:text-emerald-400 hover:underline">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const setStatus = (s: JobStatus) => {
    updateJobStatus(job.id, s);
    setJob({ ...job, status: s });
    if (s === "Approved" || s === "Rejected") {
      const patch = setStage(job.id, s);
      setTimelinePatch({ ...patch });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AlgoNavbar />

      <main className="mx-auto max-w-3xl px-5 py-8">
        <button
          onClick={() => navigate("/algoscout")}
          className="mb-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
        </button>

        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">{job.company}</div>
              <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-foreground">
                {job.role}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {job.location}</span>
                <span>· Found {job.dateFound}</span>
                <StatusBadge status={job.status} />
              </div>
            </div>
            <ScorePill score={job.score} size="lg" job={job} />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              onClick={() => setStatus("Approved")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3.5 py-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/25"
            >
              <Check className="h-4 w-4" /> Approve
            </button>
            <button
              onClick={() => setStatus("Rejected")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/15 px-3.5 py-2 text-sm font-medium text-rose-600 dark:text-rose-400 ring-1 ring-rose-500/30 transition hover:bg-rose-500/25"
            >
              <X className="h-4 w-4" /> Reject
            </button>
            <a
              href={job.applyUrl}
              target="_blank"
              rel="noreferrer"
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3.5 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
            >
              Open application <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          <Section title="Why this score">{job.reason}</Section>
          <Section title="Job description">
            <p className="whitespace-pre-line">{job.description}</p>
          </Section>

          <DocumentsViewer
            resumeUrl={job.resumePdfUrl ?? DEFAULT_RESUME_PDF_URL}
            job={job}
          />

          <Section title="Tailored resume notes">
            <pre className="whitespace-pre-wrap font-sans">{job.resume}</pre>
          </Section>
          <Section title="Cover letter notes">
            <p className="whitespace-pre-line">{job.coverLetter}</p>
          </Section>
        </div>
      </main>
    </div>
  );
}

type DocTab = "resume" | "cover";

function DocumentsViewer({
  resumeUrl,
  job,
}: {
  resumeUrl: string;
  job: Job;
}) {
  const [tab, setTab] = useState<DocTab>("resume");
  const [pdfLoading, setPdfLoading] = useState(true);

  // Reset loading state when switching back to resume
  useEffect(() => {
    if (tab === "resume") setPdfLoading(true);
  }, [tab, resumeUrl]);

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Documents
        </h2>
        {tab === "resume" && (
          <a
            href={resumeUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground"
          >
            Open Resume <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      <div className="flex gap-1 border-b border-border px-3 pt-3">
        {([
          { id: "resume", label: "Tailored Resume" },
          { id: "cover", label: "Cover Letter" },
        ] as { id: DocTab; label: string }[]).map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={
                "inline-flex items-center gap-1.5 rounded-t-md px-3.5 py-2 text-sm font-medium transition " +
                (active
                  ? "bg-background text-foreground ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              <FileText className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "resume" ? (
        <div className="bg-background p-3">
          <div className="relative overflow-hidden rounded-lg border border-border bg-card">
            {pdfLoading && (
              <div className="absolute inset-0 z-10 space-y-3 bg-card p-6">
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-4 w-2/3" />
                <div className="pt-4 space-y-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-11/12" />
                  <Skeleton className="h-3 w-10/12" />
                  <Skeleton className="h-3 w-9/12" />
                </div>
                <div className="pt-4 space-y-2">
                  <Skeleton className="h-4 w-1/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-11/12" />
                  <Skeleton className="h-3 w-10/12" />
                </div>
              </div>
            )}
            <object
              key={resumeUrl}
              data={`${resumeUrl}#toolbar=1&view=FitH`}
              type="application/pdf"
              className="h-[640px] w-full"
              aria-label="Tailored Resume"
              onLoad={() => setPdfLoading(false)}
            >
              <div className="flex h-[640px] flex-col items-center justify-center gap-3 p-6 text-center">
                <FileText className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Can't display the PDF inline in this browser.
                </p>
                <a
                  href={resumeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3.5 py-2 text-sm font-medium text-foreground hover:bg-muted"
                >
                  Download Resume <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </object>
          </div>
        </div>
      ) : (
        <CoverLetterDoc
          body={job.coverLetter}
          company={job.company}
          role={job.role}
          date={job.dateFound}
        />
      )}
    </section>
  );
}
