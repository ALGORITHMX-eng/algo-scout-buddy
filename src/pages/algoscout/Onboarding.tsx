import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight, ChevronRight, Radar, BarChart3, Mic,
  MessageSquare, Bell, ClipboardList, PlusCircle,
  ShieldCheck, Upload, FileText, Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import * as pdfjsLib from "pdfjs-dist";

// Point to the pdfjs worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const slides = [
  {
    icon: <BarChart3 className="h-5 w-5" />,
    title: "AI-Scored Dashboard",
    subtitle: "Your command center",
    description: "Every job lead gets an AI score from 1–10. Approve, reject, or bulk-manage leads in one tap.",
  },
  {
    icon: <PlusCircle className="h-5 w-5" />,
    title: "Add Jobs Manually",
    subtitle: "Full control",
    description: "Found a job on your own? Add it manually and it gets scored by AI just like auto-discovered leads.",
  },
  {
    icon: <ShieldCheck className="h-5 w-5" />,
    title: "Human in the Loop",
    subtitle: "You stay in control",
    description: "Before any application is sent, you review it first. AI generates a tailored resume and cover letter for each job.",
  },
  {
    icon: <Mic className="h-5 w-5" />,
    title: "Voice Interview Prep",
    subtitle: "Practice with AI",
    description: "Practice real interview questions with AI. Get voice feedback like a real interviewer.",
  },
  {
    icon: <MessageSquare className="h-5 w-5" />,
    title: "AI Career Coach",
    subtitle: "Get personalized advice",
    description: "Chat with your AI career coach about resumes, salary negotiation, and career pivots.",
  },
  {
    icon: <Bell className="h-5 w-5" />,
    title: "Smart Notifications",
    subtitle: "Never miss a match",
    description: "Get instant alerts when a role scores 8+ against your profile.",
  },
];

// Extract plain text from PDF using pdfjs
async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const textParts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => item.str)
      .join(" ");
    textParts.push(pageText);
  }

  return textParts.join("\n");
}

const Onboarding = () => {
  const [current, setCurrent] = useState(0);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const slide = slides[current];
  const isLast = current === slides.length - 1;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate("/algoscout/auth");
    });
  }, [navigate]);

  const handleFile = async (file: File) => {
    if (!file) return;
    if (file.type !== "application/pdf") {
      setUploadError("Please upload a PDF file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("File too large — max 10MB");
      return;
    }

    setUploading(true);
    setUploadError("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Not logged in");

      // Extract text from PDF (GPT-4o reads text, not binary PDF)
      const resumeText = await extractTextFromPDF(file);

      if (!resumeText || resumeText.trim().length < 50) {
        throw new Error("Could not extract text from PDF. Is it a scanned image PDF?");
      }

      // Send as base64 encoded text (not raw PDF bytes)
      const resumeBase64 = btoa(unescape(encodeURIComponent(resumeText)));

      const { data, error } = await supabase.functions.invoke("parse-resume", {
        body: {
          user_id: session.user.id,
          resumeBase64,
          mimeType: "text/plain",
        },
      });

      if (error) throw error;

      setUploaded(true);

      // Generate seeds after parsing
      await supabase.functions.invoke("generate-seeds", {
        body: { user_id: session.user.id },
      });

    } catch (err: any) {
      setUploadError(err.message || "Failed to parse resume");
    } finally {
      setUploading(false);
    }
  };

  const finish = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user && !uploaded) {
      await supabase.functions.invoke("generate-seeds", {
        body: { user_id: session.user.id },
      }).catch(console.error);
    }
    navigate("/algoscout");
  };

  const next = () => {
    if (isLast) { setShowUpload(true); return; }
    setCurrent((p) => p + 1);
  };

  if (showUpload) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30">
              <Radar className="h-4 w-4" />
            </span>
            <span className="font-display text-sm font-semibold">AlgoScout</span>
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-5">
          <div className="mb-6 text-center">
            <h2 className="font-display text-2xl font-semibold">Do you have a resume?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Upload your resume so AlgoScout can tailor every job application specifically for you.
            </p>
          </div>

          {!uploaded ? (
            <>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const file = e.dataTransfer.files[0];
                  if (file) handleFile(file);
                }}
                onClick={() => fileRef.current?.click()}
                className={`w-full cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition ${
                  dragOver
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-zinc-700 bg-zinc-900/40 hover:border-emerald-500/50"
                }`}
              >
                {uploading ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
                    <p className="text-sm text-zinc-400">Parsing your resume with AI...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <Upload className="h-8 w-8 text-zinc-500" />
                    <p className="text-sm font-medium text-zinc-300">Drop your resume here</p>
                    <p className="text-xs text-zinc-500">PDF only · Max 10MB</p>
                  </div>
                )}
              </div>

              <input
                ref={fileRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />

              {uploadError && (
                <p className="mt-3 text-sm text-rose-400">{uploadError}</p>
              )}

              <button
                onClick={finish}
                className="mt-6 text-sm text-zinc-500 hover:text-zinc-300 transition"
              >
                Skip for now — I'll add it later
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                <FileText className="h-8 w-8" />
              </div>
              <p className="text-lg font-semibold text-zinc-100">Resume parsed! ✅</p>
              <p className="text-sm text-zinc-400 text-center">
                AlgoScout has extracted your skills and experience. Your personalized job search is ready.
              </p>
              <button
                onClick={finish}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                Go to Dashboard <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30">
            <Radar className="h-4 w-4" />
          </span>
          <span className="font-display text-sm font-semibold">AlgoScout</span>
        </div>
        <button onClick={finish} className="text-xs font-medium text-muted-foreground hover:text-foreground transition">
          Skip
        </button>
      </header>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-5">
        <div className="flex flex-col items-center text-center max-w-md">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30">
            {slide.icon}
          </div>
          <h2 className="font-display text-2xl font-semibold text-foreground">{slide.title}</h2>
          <p className="mt-1 text-xs font-medium uppercase tracking-wider text-emerald-400">{slide.subtitle}</p>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{slide.description}</p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl px-5 pb-8 pt-4">
        <div className="mb-6 flex items-center justify-center gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-2 rounded-full transition-all ${i === current ? "w-6 bg-emerald-500" : "w-2 bg-muted-foreground/30"}`}
            />
          ))}
        </div>

        <button
          onClick={next}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-semibold text-white transition hover:bg-emerald-700 md:max-w-xs md:mx-auto"
        >
          {isLast ? (
            <>Get Started <ArrowRight className="h-4 w-4" /></>
          ) : (
            <>Next <ChevronRight className="h-4 w-4" /></>
          )}
        </button>
      </div>
    </div>
  );
};

export default Onboarding;