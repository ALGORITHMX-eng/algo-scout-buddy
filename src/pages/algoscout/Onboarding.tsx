import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight, ChevronRight, Radar, BarChart3, Mic,
  MessageSquare, Bell, ClipboardList, PlusCircle,
  ShieldCheck, Upload, FileText, Loader2, Plus, X,
  Check, ArrowLeft, Sparkles,
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

// ─── Types ────────────────────────────────────────────────────────────────────
type WorkPref = "Remote" | "Hybrid" | "On-site";
type Seniority = "Junior" | "Mid-level" | "Senior" | "Lead" | "Staff" | "Principal";
type Screen = "choice" | "upload" | "parsing" | "confirm" | "manual-step1" | "manual-step2" | "generating";

interface ProfileData {
  full_name: string;
  email: string;
  phone: string;
  linkedin: string;
  github: string;
  portfolio: string;
  years_experience: number;
  seniority: Seniority | "";
  work_preference: WorkPref[];
  preferred_locations: string[];
  preferred_titles: string[];
  skills: string[];
  experience_summary: string;
  raw_resume_text: string;
}

const SENIORITY_LEVELS: Seniority[] = ["Junior", "Mid-level", "Senior", "Lead", "Staff", "Principal"];
const WORK_PREFS: WorkPref[] = ["Remote", "Hybrid", "On-site"];

const SKILL_SUGGESTIONS = [
  "Python", "TypeScript", "JavaScript", "React", "Node.js",
  "LangChain", "LangGraph", "RAG", "LLMs", "HuggingFace",
  "Supabase", "PostgreSQL", "FastAPI", "Docker", "AWS",
  "Prompt Engineering", "AI Agents", "Vector Databases", "REST APIs",
  "Git", "SQL", "TailwindCSS", "Next.js",
];

const TITLE_SUGGESTIONS = [
  "AI Engineer", "ML Engineer", "LLM Engineer", "AI Developer",
  "Backend Engineer", "Full Stack Engineer", "RAG Engineer",
  "AI Researcher", "Prompt Engineer", "AI Automation Engineer",
  "NLP Engineer", "Data Scientist", "Software Engineer",
];

// ─── Slides (unchanged) ───────────────────────────────────────────────────────
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

function detectSeniority(years: number): Seniority {
  if (years >= 8) return "Principal";
  if (years >= 6) return "Staff";
  if (years >= 5) return "Lead";
  if (years >= 3) return "Senior";
  if (years >= 1) return "Mid-level";
  return "Junior";
}

const emptyProfile = (): ProfileData => ({
  full_name: "", email: "", phone: "", linkedin: "", github: "",
  portfolio: "", years_experience: 0, seniority: "",
  work_preference: [], preferred_locations: [], preferred_titles: [],
  skills: [], experience_summary: "", raw_resume_text: "",
});

// ─── Sub-components ───────────────────────────────────────────────────────────
function FieldLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="mb-2">
      <div className="text-sm font-medium text-foreground">{label}</div>
      {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

function ChipSelect<T extends string>({ options, selected, onToggle }: {
  options: T[]; selected: T[]; onToggle: (val: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = selected.includes(o);
        return (
          <button key={o} type="button" onClick={() => onToggle(o)}
            className={`rounded-xl px-3.5 py-2 text-sm font-medium transition ring-1 ${
              active
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-emerald-500/30"
                : "bg-muted/30 text-muted-foreground ring-border hover:ring-emerald-500/30 hover:text-foreground"
            }`}>
            {active && <Check className="inline h-3 w-3 mr-1" />}{o}
          </button>
        );
      })}
    </div>
  );
}

function TagInput({ tags, onChange, placeholder, suggestions = [] }: {
  tags: string[]; onChange: (tags: string[]) => void;
  placeholder: string; suggestions?: string[];
}) {
  const [input, setInput] = useState("");
  const [showSugg, setShowSugg] = useState(false);
  const filtered = suggestions.filter(
    (s) => s.toLowerCase().includes(input.toLowerCase()) && !tags.includes(s)
  ).slice(0, 5);
  const add = (val: string) => {
    const t = val.trim();
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setInput(""); setShowSugg(false);
  };
  return (
    <div className="relative">
      <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-muted/30 p-3 min-h-[48px]">
        {tags.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30">
            {t}
            <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))} className="hover:text-rose-400 transition">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input value={input}
          onChange={(e) => { setInput(e.target.value); setShowSugg(true); }}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(input); } }}
          onBlur={() => setTimeout(() => setShowSugg(false), 150)}
          placeholder={tags.length === 0 ? placeholder : "Add more..."}
          className="flex-1 min-w-[120px] bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" />
      </div>
      {showSugg && filtered.length > 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-xl border border-border bg-card shadow-lg overflow-hidden">
          {filtered.map((s) => (
            <button key={s} type="button" onMouseDown={() => add(s)}
              className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted transition">{s}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function LocationInput({ locations, onChange }: { locations: string[]; onChange: (l: string[]) => void }) {
  const [input, setInput] = useState("");
  const add = () => {
    const t = input.trim();
    if (t && !locations.includes(t)) onChange([...locations, t]);
    setInput("");
  };
  return (
    <div>
      <div className="flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="e.g. Lagos, Nigeria"
          className="flex-1 rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-emerald-500/50 transition" />
        <button type="button" onClick={add}
          className="rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-muted-foreground hover:text-foreground transition">
          <Plus className="h-4 w-4" />
        </button>
      </div>
      {locations.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {locations.map((l) => (
            <span key={l} className="inline-flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1 text-xs font-medium text-foreground ring-1 ring-border">
              {l}
              <button type="button" onClick={() => onChange(locations.filter((x) => x !== l))} className="hover:text-rose-400 transition">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function PageShell({ children, onBack }: { children: React.ReactNode; onBack?: () => void }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30">
            <Radar className="h-4 w-4" />
          </span>
          <span className="font-display text-sm font-semibold text-foreground">AlgoScout</span>
        </div>
        {onBack && (
          <button onClick={onBack} className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
        )}
      </header>
      <div className="mx-auto w-full max-w-2xl flex-1 px-5 pb-10">
        {children}
      </div>
    </div>
  );
}

// ─── Main Onboarding ──────────────────────────────────────────────────────────
const Onboarding = () => {
  const [current, setCurrent] = useState(0);
  const [showUpload, setShowUpload] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [screen, setScreen] = useState<Screen>("choice");
  const [profile, setProfile] = useState<ProfileData>(emptyProfile());
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const slide = slides[current];
  const isLast = current === slides.length - 1;
  const needsLocation = profile.work_preference.some((p) => p === "Hybrid" || p === "On-site");

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { navigate("/algoscout/auth"); return; }
      const { data } = await supabase.from("profiles").select("skills").eq("id", session.user.id).single();
      if (data?.skills?.length > 0) setScreen("choice");
    });
  }, [navigate]);

  const finish = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data } = await supabase.from("profiles").select("id").eq("id", session.user.id).single();
      if (!data) {
        await supabase.from("profiles").insert({
          id: session.user.id, user_id: session.user.id,
          full_name: session.user.user_metadata?.full_name || "",
          email: session.user.email || "",
        } as any);
      }
    }
    navigate("/algoscout");
  };

  const saveAndGenerate = async () => {
    setError("");
    setScreen("generating");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Not logged in");
      const userId = session.user.id;

      await supabase.from("profiles").upsert({
        id: userId, user_id: userId,
        full_name: profile.full_name,
        email: profile.email || session.user.email,
        phone: profile.phone,
        linkedin: profile.linkedin,
        github: profile.github,
        portfolio: profile.portfolio,
        years_experience: profile.years_experience,
        skills: profile.skills,
        preferred_titles: profile.preferred_titles,
        experience_summary: profile.experience_summary,
        raw_resume_text: profile.raw_resume_text,
        work_preference: profile.work_preference.join(",").toLowerCase(),
        location: profile.preferred_locations[0] || "",
        updated_at: new Date().toISOString(),
      } as any, { onConflict: "id" });

      await supabase.from("search_seeds").delete().eq("user_id", userId);
      await supabase.functions.invoke("generate-seeds", { body: { user_id: userId } }).catch(console.error);
      navigate("/algoscout");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      setScreen("confirm");
    }
  };

  const handleFile = async (file: File) => {
    if (!file) return;
    if (file.type !== "application/pdf") { setUploadError("Please upload a PDF file"); return; }
    if (file.size > 10 * 1024 * 1024) { setUploadError("File too large — max 10MB"); return; }
    setUploadError("");
    setScreen("parsing");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Not logged in");

      const resumeText = await extractTextFromPDF(file);
      if (!resumeText || resumeText.trim().length < 50)
        throw new Error("Could not extract text from PDF. Is it a scanned image PDF?");

      const resumeBase64 = btoa(unescape(encodeURIComponent(resumeText)));
      const { data, error: fnError } = await supabase.functions.invoke("parse-resume", {
        body: { user_id: session.user.id, resumeBase64, mimeType: "text/plain" },
      });
      if (fnError) throw fnError;

      const p = data?.profile || {};
      const yoe = p.years_experience || 0;

      setProfile({
        full_name: p.full_name || "",
        email: p.email || session.user.email || "",
        phone: p.phone || "",
        linkedin: p.linkedin || "",
        github: p.github || "",
        portfolio: p.portfolio || "",
        years_experience: yoe,
        seniority: detectSeniority(yoe),
        work_preference: ["Remote"],
        preferred_locations: [],
        preferred_titles: p.preferred_titles || [],
        skills: p.skills || [],
        experience_summary: p.experience_summary || "",
        raw_resume_text: resumeText,
      });

      setScreen("confirm");
    } catch (err: any) {
      setUploadError(err.message || "Failed to parse resume");
      setScreen("upload");
    }
  };

  const toggleWorkPref = (pref: WorkPref) => {
    setProfile((p) => ({
      ...p,
      work_preference: p.work_preference.includes(pref)
        ? p.work_preference.filter((x) => x !== pref)
        : [...p.work_preference, pref],
    }));
  };

  const next = () => {
    if (isLast) { setShowUpload(true); return; }
    setCurrent((p) => p + 1);
  };

  // ── SLIDES (completely unchanged) ──────────────────────────────────────────
  if (!showUpload) {
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
              <button key={i} onClick={() => setCurrent(i)}
                className={`h-2 rounded-full transition-all ${i === current ? "w-6 bg-emerald-500" : "w-2 bg-muted-foreground/30"}`} />
            ))}
          </div>
          <button onClick={next} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-semibold text-white transition hover:bg-emerald-700 md:max-w-xs md:mx-auto">
            {isLast ? (<>Get Started <ArrowRight className="h-4 w-4" /></>) : (<>Next <ChevronRight className="h-4 w-4" /></>)}
          </button>
        </div>
      </div>
    );
  }

  // ── CHOICE SCREEN ──────────────────────────────────────────────────────────
  if (screen === "choice") return (
    <PageShell onBack={() => setShowUpload(false)}>
      <div className="flex flex-col items-center pt-10 pb-6 text-center">
        <h2 className="font-display text-2xl font-semibold text-foreground">Do you have a resume?</h2>
        <p className="mt-2 text-sm text-muted-foreground">We'll use it to personalise your experience</p>
      </div>

      <div className="space-y-3">
        <button onClick={() => setScreen("upload")}
          className="w-full flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4 text-left transition hover:border-emerald-500/40 hover:bg-emerald-500/5 group">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30">
            <FileText className="h-5 w-5" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-foreground">Yes, I have a resume</div>
            <div className="text-xs text-muted-foreground mt-0.5">Upload PDF</div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition" />
        </button>

        <button onClick={() => { setProfile(emptyProfile()); setScreen("manual-step1"); }}
          className="w-full flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4 text-left transition hover:border-amber-500/40 hover:bg-amber-500/5 group">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/30">
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-foreground">I'll add manually</div>
            <div className="text-xs text-muted-foreground mt-0.5">Answer a few quick questions</div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition" />
        </button>
      </div>
    </PageShell>
  );

  // ── UPLOAD SCREEN ──────────────────────────────────────────────────────────
  if (screen === "upload") return (
    <PageShell onBack={() => setScreen("choice")}>
      <div className="flex flex-col items-center pt-10 pb-6 text-center">
        <h2 className="font-display text-2xl font-semibold text-foreground">Upload Your Resume</h2>
        <p className="mt-2 text-sm text-muted-foreground">We'll extract your skills and experience automatically</p>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        onClick={() => fileRef.current?.click()}
        className={`w-full cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition ${
          dragOver ? "border-emerald-500 bg-emerald-500/10" : "border-border bg-muted/20 hover:border-emerald-500/50 hover:bg-emerald-500/5"
        }`}>
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500">
            <Upload className="h-7 w-7" />
          </div>
          <p className="text-sm font-medium text-foreground">Drop your resume here</p>
          <p className="text-xs text-muted-foreground">PDF only · Max 10MB</p>
        </div>
      </div>

      <input ref={fileRef} type="file" accept=".pdf" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      {uploadError && <p className="mt-3 text-sm text-rose-400">{uploadError}</p>}
    </PageShell>
  );

  // ── PARSING ────────────────────────────────────────────────────────────────
  if (screen === "parsing") return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-500">
        <FileText className="h-8 w-8" />
      </div>
      <div className="text-center">
        <div className="flex items-center gap-2 justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
          <p className="text-sm font-medium text-foreground">Analyzing your resume with AI...</p>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">This takes about 10 seconds</p>
      </div>
    </div>
  );

  // ── GENERATING ─────────────────────────────────────────────────────────────
  if (screen === "generating") return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-500">
        <Radar className="h-8 w-8 animate-pulse" />
      </div>
      <div className="text-center">
        <div className="flex items-center gap-2 justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
          <p className="text-sm font-medium text-foreground">Setting up your profile...</p>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Generating personalized job seeds</p>
      </div>
    </div>
  );

  // ── CONFIRM (after resume parse) ───────────────────────────────────────────
  if (screen === "confirm") return (
    <PageShell onBack={() => setScreen("upload")}>
      <div className="pt-8 pb-6">
        <h2 className="font-display text-2xl font-semibold text-foreground">Confirm Your Profile</h2>
        <p className="mt-1 text-sm text-muted-foreground">We've analyzed your resume. Review and edit anything below.</p>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <FieldLabel label="Years of Experience" />
          <div className="flex items-center gap-3">
            <input type="number" min={0} max={40} value={profile.years_experience}
              onChange={(e) => {
                const yoe = Number(e.target.value);
                setProfile((p) => ({ ...p, years_experience: yoe, seniority: detectSeniority(yoe) }));
              }}
              className="w-24 rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm text-foreground outline-none focus:border-emerald-500/50 transition text-center" />
            <span className="text-sm text-muted-foreground">years</span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <FieldLabel label="Seniority Level" hint="Select the level that best describes you" />
          <ChipSelect options={SENIORITY_LEVELS}
            selected={profile.seniority ? [profile.seniority] : []}
            onToggle={(val) => setProfile((p) => ({ ...p, seniority: val }))} />
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <FieldLabel label="Work Preference" hint="Select all that apply" />
          <ChipSelect options={WORK_PREFS} selected={profile.work_preference} onToggle={toggleWorkPref} />
        </div>

        {needsLocation && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <FieldLabel label="Preferred Locations" hint="Where are you open to working?" />
            <LocationInput locations={profile.preferred_locations}
              onChange={(l) => setProfile((p) => ({ ...p, preferred_locations: l }))} />
          </div>
        )}

        <div className="rounded-xl border border-border bg-card p-4">
          <FieldLabel label="Target Job Titles" hint="What roles are you looking for?" />
          <TagInput tags={profile.preferred_titles}
            onChange={(t) => setProfile((p) => ({ ...p, preferred_titles: t }))}
            placeholder="e.g. AI Engineer, LLM Developer..."
            suggestions={TITLE_SUGGESTIONS} />
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <FieldLabel label="Technical Skills" hint="Auto-extracted from your resume — add or remove as needed" />
          <TagInput tags={profile.skills}
            onChange={(s) => setProfile((p) => ({ ...p, skills: s }))}
            placeholder="Add a skill..."
            suggestions={SKILL_SUGGESTIONS} />
        </div>

        {error && <p className="text-sm text-rose-400">{error}</p>}

        <button onClick={saveAndGenerate} disabled={profile.work_preference.length === 0}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50">
          Start Scouting Jobs <ArrowRight className="h-4 w-4" />
        </button>
        <p className="text-center text-xs text-muted-foreground pb-4">
          You can edit or update this information anytime in Settings.
        </p>
      </div>
    </PageShell>
  );

  // ── MANUAL STEP 1 ──────────────────────────────────────────────────────────
  if (screen === "manual-step1") return (
    <PageShell onBack={() => setScreen("choice")}>
      <div className="pt-8 pb-6">
        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded-full px-2.5 py-1">Step 1 of 2</span>
        <h2 className="font-display text-2xl font-semibold text-foreground mt-3">Basic Information</h2>
        <p className="mt-1 text-sm text-muted-foreground">Tell us a bit about yourself to get started.</p>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <FieldLabel label="Full Name" />
          <input value={profile.full_name}
            onChange={(e) => setProfile((p) => ({ ...p, full_name: e.target.value }))}
            placeholder="Your full name"
            className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-emerald-500/50 transition" />
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <FieldLabel label="Seniority Level" />
          <ChipSelect options={SENIORITY_LEVELS}
            selected={profile.seniority ? [profile.seniority] : []}
            onToggle={(val) => setProfile((p) => ({ ...p, seniority: val }))} />
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <FieldLabel label="Years of Experience" />
          <div className="flex items-center gap-3">
            <input type="number" min={0} max={40} value={profile.years_experience}
              onChange={(e) => setProfile((p) => ({ ...p, years_experience: Number(e.target.value) }))}
              className="w-24 rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm text-foreground outline-none focus:border-emerald-500/50 transition text-center" />
            <span className="text-sm text-muted-foreground">years</span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <FieldLabel label="Target Job Titles" hint="What roles are you looking for?" />
          <TagInput tags={profile.preferred_titles}
            onChange={(t) => setProfile((p) => ({ ...p, preferred_titles: t }))}
            placeholder="e.g. AI Engineer, LLM Developer..."
            suggestions={TITLE_SUGGESTIONS} />
        </div>

        <button onClick={() => setScreen("manual-step2")}
          disabled={!profile.full_name || !profile.seniority}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50">
          Continue <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </PageShell>
  );

  // ── MANUAL STEP 2 ──────────────────────────────────────────────────────────
  if (screen === "manual-step2") return (
    <PageShell onBack={() => setScreen("manual-step1")}>
      <div className="pt-8 pb-6">
        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded-full px-2.5 py-1">Step 2 of 2</span>
        <h2 className="font-display text-2xl font-semibold text-foreground mt-3">Skills & Preferences</h2>
        <p className="mt-1 text-sm text-muted-foreground">Almost done — tell us what you're looking for.</p>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <FieldLabel label="Technical Skills" hint="Add your key skills" />
          <TagInput tags={profile.skills}
            onChange={(s) => setProfile((p) => ({ ...p, skills: s }))}
            placeholder="e.g. Python, LangChain, React..."
            suggestions={SKILL_SUGGESTIONS} />
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <FieldLabel label="Work Preference" hint="Select all that apply" />
          <ChipSelect options={WORK_PREFS} selected={profile.work_preference} onToggle={toggleWorkPref} />
        </div>

        {needsLocation && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <FieldLabel label="Preferred Locations" hint="Where are you open to working?" />
            <LocationInput locations={profile.preferred_locations}
              onChange={(l) => setProfile((p) => ({ ...p, preferred_locations: l }))} />
          </div>
        )}

        {/* Professional Summary — optional, skippable */}
        <div className="rounded-xl border border-border bg-card p-4">
          <FieldLabel label="Professional Summary" hint="Optional — briefly describe your career goal" />
          <textarea value={profile.experience_summary}
            onChange={(e) => setProfile((p) => ({ ...p, experience_summary: e.target.value }))}
            placeholder="e.g. AI engineer with 2 years experience building RAG systems..."
            rows={3}
            className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-emerald-500/50 transition resize-none" />
        </div>

        {error && <p className="text-sm text-rose-400">{error}</p>}

        <button onClick={saveAndGenerate}
          disabled={profile.work_preference.length === 0 || profile.skills.length === 0}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50">
          Start Scouting Jobs <ArrowRight className="h-4 w-4" />
        </button>
        <p className="text-center text-xs text-muted-foreground pb-4">
          You can edit or update this information anytime in Settings.
        </p>
      </div>
    </PageShell>
  );

  return null;
};

export default Onboarding;