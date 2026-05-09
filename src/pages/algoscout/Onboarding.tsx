import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight, ChevronRight, Radar, BarChart3, Mic,
  MessageSquare, Bell, ClipboardList, PlusCircle,
  ShieldCheck, Upload, FileText, Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

import onboardingDashboard from "@/assets/onboarding-dashboard.jpg";
import onboardingInterview from "@/assets/onboarding-interview.jpg";
import onboardingProfile from "@/assets/onboarding-profile.jpg";
import onboardingNotifications from "@/assets/onboarding-notifications.jpg";
import onboardingChat from "@/assets/onboarding-chat.jpg";
import onboardingAddjob from "@/assets/onboarding-addjob.jpg";
import onboardingReview from "@/assets/onboarding-review.jpg";

interface Slide {
  image: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  description: string;
}

const slides: Slide[] = [
  {
    image: onboardingDashboard,
    icon: <BarChart3 className="h-5 w-5" />,
    title: "AI-Scored Dashboard",
    subtitle: "Your command center",
    description: "Every job lead gets an AI score from 1–10. Approve, reject, or bulk-manage leads in one tap. Filter by tags like Remote, High Priority, and more.",
  },
  {
    image: onboardingAddjob,
    icon: <PlusCircle className="h-5 w-5" />,
    title: "Add Jobs Manually",
    subtitle: "Full control",
    description: "Found a job on your own? Add it manually with the company name, role, URL, and notes. It gets scored by AI just like auto-discovered leads.",
  },
  {
    image: onboardingReview,
    icon: <ShieldCheck className="h-5 w-5" />,
    title: "Human in the Loop",
    subtitle: "You stay in control",
    description: "Before any application is sent, you review it first. AI generates a new cover letter and tailored resume for each job — you approve, edit, or reject before giving the AI the go-ahead.",
  },
  {
    image: onboardingInterview,
    icon: <Mic className="h-5 w-5" />,
    title: "Voice Interview Prep",
    subtitle: "Practice with AI",
    description: "Choose Live Voice or Text Chat mode, set a timer, and practice real interview questions. The AI responds with voice feedback — like a real interviewer.",
  },
  {
    image: onboardingChat,
    icon: <MessageSquare className="h-5 w-5" />,
    title: "AI Career Coach",
    subtitle: "Get personalized advice",
    description: "Chat with your AI career coach about resumes, salary negotiation, career pivots, and more. It remembers your context and gives tailored guidance.",
  },
  {
    image: onboardingProfile,
    icon: <ClipboardList className="h-5 w-5" />,
    title: "Form Memory",
    subtitle: "Never re-type answers",
    description: "Save common application answers once. When AlgoScout can't fill a field, you'll get an alert — answer once and it's saved forever.",
  },
  {
    image: onboardingNotifications,
    icon: <Bell className="h-5 w-5" />,
    title: "Smart Notifications",
    subtitle: "Never miss a match",
    description: "Get instant alerts when a role scores 8+ against your profile. Tap the notification to view full details and take action immediately.",
  },
];

async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const textParts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    textParts.push(content.items.map((item: any) => item.str).join(" "));
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
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { navigate("/algoscout/auth"); return; }

      // Skip upload if resume already parsed in Auth flow
      const { data } = await supabase
        .from("profiles")
        .select("skills")
        .eq("id", session.user.id)
        .single();

      if (data?.skills?.length > 0) {
        // Already has skills — skip straight to dashboard after slides
        setUploaded(true);
      }
    });
  }, [navigate]);

  const handleFile = async (file: File) => {
    if (!file) return;
    if (file.type !== "application/pdf") { setUploadError("Please upload a PDF file"); return; }
    if (file.size > 10 * 1024 * 1024) { setUploadError("File too large — max 10MB"); return; }

    setUploading(true);
    setUploadError("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Not logged in");

      const resumeText = await extractTextFromPDF(file);
      if (!resumeText || resumeText.trim().length < 50) throw new Error("Could not extract text from PDF. Is it a scanned image PDF?");

      const resumeBase64 = btoa(unescape(encodeURIComponent(resumeText)));

      const { error } = await supabase.functions.invoke("parse-resume", {
        body: { user_id: session.user.id, resumeBase64, mimeType: "text/plain" },
      });
      if (error) throw error;

      setUploaded(true);

      await supabase.functions.invoke("generate-seeds", {
        body: { user_id: session.user.id },
      }).catch(console.error);

    } catch (err: any) {
      setUploadError(err.message || "Failed to parse resume");
    } finally {
      setUploading(false);
    }
  };

  const finish = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      // Ensure profile exists
      const { data } = await supabase.from("profiles").select("id").eq("id", session.user.id).single();
      if (!data) {
        await supabase.from("profiles").insert({
          id: session.user.id,
          user_id: session.user.id,
          full_name: session.user.user_metadata?.full_name || "",
          email: session.user.email || "",
        } as any);
      }
      if (!uploaded) {
        await supabase.functions.invoke("generate-seeds", {
          body: { user_id: session.user.id },
        }).catch(console.error);
      }
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
          {uploaded ? (
            <div className="flex flex-col items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                <FileText className="h-8 w-8" />
              </div>
              <p className="text-lg font-semibold text-zinc-100">Resume already parsed! ✅</p>
              <p className="text-sm text-zinc-400 text-center">
                AlgoScout has your skills and experience. Your personalized job search is ready.
              </p>
              <button
                onClick={finish}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                Go to Dashboard <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <div className="mb-6 text-center">
                <h2 className="font-display text-2xl font-semibold">Do you have a resume?</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Upload your resume so AlgoScout can tailor every job application specifically for you.
                </p>
              </div>

              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); const file = e.dataTransfer.files[0]; if (file) handleFile(file); }}
                onClick={() => fileRef.current?.click()}
                className={`w-full cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition ${dragOver ? "border-emerald-500 bg-emerald-500/10" : "border-zinc-700 bg-zinc-900/40 hover:border-emerald-500/50"}`}
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

              <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFile(file); }} />

              {uploadError && <p className="mt-3 text-sm text-rose-400">{uploadError}</p>}

              <button onClick={finish} className="mt-6 text-sm text-zinc-500 hover:text-zinc-300 transition">
                Skip for now — I'll add it later
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30">
            <Radar className="h-4 w-4" />
          </span>
          <span className="font-display text-sm font-semibold text-foreground">AlgoScout</span>
        </div>
        <button onClick={finish} className="text-xs font-medium text-muted-foreground hover:text-foreground transition">
          Skip
        </button>
      </header>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col md:flex-row md:items-center md:gap-10 px-5">
        <div className="relative overflow-hidden rounded-2xl md:w-1/2 shrink-0">
          <img src={slide.image} alt={slide.title} className="aspect-[4/3] w-full object-cover" width={800} height={600} />
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
          <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-xl bg-background/70 px-3 py-1.5 backdrop-blur-sm">
            <span className="text-emerald-600 dark:text-emerald-400">{slide.icon}</span>
            <span className="text-xs font-medium text-foreground">{slide.subtitle}</span>
          </div>
        </div>

        <div className="flex flex-1 flex-col pt-6 md:pt-0">
          <h2 className="font-display text-2xl font-semibold text-foreground">{slide.title}</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">{slide.description}</p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl px-5 pb-8 pt-4">
        <div className="mb-6 flex items-center justify-center gap-2">
          {slides.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)} className={`h-2 rounded-full transition-all ${i === current ? "w-6 bg-emerald-500" : "w-2 bg-muted-foreground/30"}`} />
          ))}
        </div>
        <button onClick={next} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-semibold text-white transition hover:bg-emerald-700 md:max-w-xs md:mx-auto">
          {isLast ? (<>Get Started <ArrowRight className="h-4 w-4" /></>) : (<>Next <ChevronRight className="h-4 w-4" /></>)}
        </button>
      </div>
    </div>
  );
};

export default Onboarding;