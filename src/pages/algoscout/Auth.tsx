import * as pdfjsLib from "pdfjs-dist";
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Radar, Mail, Lock, User, ArrowRight, Upload, Sparkles, FileText,
  Loader2, Check, ChevronRight, Download, ArrowLeft,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { checkHasProfile } from "@/hooks/useAuth";

type Step = "signin" | "signup" | "resume-choice" | "upload-resume" | "career-guide" | "generating";

const careerQuestions = [
  { key: "title", label: "What's your job title or what do you do?", placeholder: "e.g. Frontend Developer, Marketing Manager…" },
  { key: "skills", label: "List your top skills", placeholder: "e.g. React, TypeScript, UI/UX Design, Leadership…" },
  { key: "experience", label: "Any projects or work experience?", placeholder: "e.g. Built an e-commerce platform at Acme Corp for 2 years…" },
  { key: "education", label: "What's your education background?", placeholder: "e.g. B.Sc Computer Science, University of Lagos" },
  { key: "goal", label: "What kind of role are you looking for?", placeholder: "e.g. Remote frontend role at a startup, $80k+" },
];

const Auth = () => {
  const [step, setStep] = useState<Step>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractedKeywords, setExtractedKeywords] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const [careerStep, setCareerStep] = useState(0);
  const [careerAnswers, setCareerAnswers] = useState<Record<string, string>>({});
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [generatedResume, setGeneratedResume] = useState(false);

  const justSignedUp = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user && !justSignedUp.current) {
        const has = await checkHasProfile(session.user.id);
        navigate(has ? "/algoscout" : "/algoscout/onboarding");
      }
    });
  }, [navigate]);

  const inputCls =
    "w-full rounded-xl border border-border bg-card px-4 py-3 pl-11 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition";

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return;
    }
    setAuthLoading(true);

    if (step === "signup") {
      if (!name) {
        toast({ title: "Please enter your name", variant: "destructive" });
        setAuthLoading(false);
        return;
      }
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
      setAuthLoading(false);
      if (error) {
        toast({ title: error.message, variant: "destructive" });
        return;
      }
      justSignedUp.current = true;
      setStep("resume-choice");
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      setAuthLoading(false);
      if (error) {
        toast({ title: error.message, variant: "destructive" });
        return;
      }
      if (data.user) {
        const has = await checkHasProfile(data.user.id);
        navigate(has ? "/algoscout" : "/algoscout/onboarding");
      }
    }
  };

  const handleGoogleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/algoscout" },
    });
    if (error) toast({ title: error.message, variant: "destructive" });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFile(file);
    setExtracting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
      let fullText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        fullText += content.items.map((item: any) => item.str).join(" ") + "\n";
      }

      const base64 = btoa(unescape(encodeURIComponent(fullText)));

      const { data, error } = await supabase.functions.invoke("parse-resume", {
        body: { user_id: session.user.id, resumeBase64: base64, mimeType: "text/plain" },
      });
      if (error) throw error;
      const keywords = data?.profile?.skills || [];
      setExtractedKeywords(Array.isArray(keywords) ? keywords : []);
      setExtracting(false);
    } catch (err: any) {
      console.error(err);
      toast({ title: "Could not parse resume", variant: "destructive" });
      setExtracting(false);
    }
  };

  const confirmKeywords = async () => {
    navigate("/algoscout/onboarding");
  };

  const handleCareerNext = () => {
    if (!currentAnswer.trim()) return;
    const key = careerQuestions[careerStep].key;
    const updated = { ...careerAnswers, [key]: currentAnswer.trim() };
    setCareerAnswers(updated);
    setCurrentAnswer("");

    if (careerStep < careerQuestions.length - 1) {
      setCareerStep((s) => s + 1);
    } else {
      setStep("generating");
      (async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const skills = updated.skills?.split(",").map((s: string) => s.trim()).filter(Boolean) || [];
          await supabase.from("profiles").upsert({
            id: session.user.id,
            user_id: session.user.id,
            full_name: name || session.user.user_metadata?.full_name || "",
            email: email || session.user.email || "",
            skills,
            experience_summary: updated.experience || "",
          } as any);
        }
        setTimeout(() => setGeneratedResume(true), 2000);
      })();
    }
  };

  const handleDownloadResume = () => {
    const lines = [
      name.toUpperCase(), email, "",
      "PROFESSIONAL SUMMARY",
      `${careerAnswers.title || "Professional"} seeking ${careerAnswers.goal || "new opportunities"}.`,
      "", "SKILLS", careerAnswers.skills || "",
      "", "EXPERIENCE", careerAnswers.experience || "",
      "", "EDUCATION", careerAnswers.education || "",
    ].join("\n");
    const blob = new Blob([lines], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/\s+/g, "_")}_Resume.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const finishCareerGuide = () => navigate("/algoscout/onboarding");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-5">
      <div className="mb-8 flex flex-col items-center gap-2">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30">
          <Radar className="h-6 w-6" />
        </span>
        <h1 className="font-display text-2xl font-semibold text-foreground">AlgoScout</h1>
        <p className="text-sm text-muted-foreground">AI-powered job tracking</p>
      </div>

      {(step === "signin" || step === "signup") && (
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl">
          <div className="mb-6 flex rounded-xl bg-muted p-1">
            <button onClick={() => setStep("signin")} className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${step === "signin" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>Sign In</button>
            <button onClick={() => setStep("signup")} className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${step === "signup" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>Sign Up</button>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {step === "signup" && (
              <div className="relative">
                <User className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                <input type="text" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
              </div>
            )}
            <div className="relative">
              <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
              <input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
              <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
            </div>
            <button type="submit" disabled={authLoading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60">
              {authLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {step === "signin" ? "Sign In" : "Create Account"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <div className="mt-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or continue with</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <button onClick={handleGoogleSignIn} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background py-3 text-sm font-medium text-foreground transition hover:bg-muted">
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Google
          </button>

          <p className="mt-5 text-center text-xs text-muted-foreground">
            {step === "signin" ? "Don't have an account?" : "Already have an account?"}{" "}
            <button onClick={() => setStep(step === "signin" ? "signup" : "signin")} className="text-emerald-600 dark:text-emerald-400 hover:underline">
              {step === "signin" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      )}

      {step === "resume-choice" && (
        <div className="w-full max-w-sm space-y-4">
          <button onClick={() => setStep("signup")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition mb-2">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
          <h2 className="text-xl font-semibold text-foreground text-center">Do you have a resume?</h2>
          <p className="text-sm text-muted-foreground text-center">We'll use it to personalise your experience</p>
          <button onClick={() => setStep("upload-resume")} className="flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:border-emerald-500/50 hover:shadow-md">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"><FileText className="h-6 w-6" /></span>
            <div className="text-left">
              <p className="font-medium text-foreground">Yes, I have a resume</p>
              <p className="text-xs text-muted-foreground">Upload PDF or DOC</p>
            </div>
            <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
          </button>
          <button onClick={() => { setCareerStep(0); setStep("career-guide"); }} className="flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:border-emerald-500/50 hover:shadow-md">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400"><Sparkles className="h-6 w-6" /></span>
            <div className="text-left">
              <p className="font-medium text-foreground">Build one with AI</p>
              <p className="text-xs text-muted-foreground">Answer a few quick questions</p>
            </div>
            <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      )}

      {step === "upload-resume" && (
        <div className="w-full max-w-sm space-y-5">
          <button onClick={() => setStep("resume-choice")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
          {!uploadedFile && !extracting && extractedKeywords.length === 0 && (
            <>
              <h2 className="text-xl font-semibold text-foreground text-center">Upload your resume</h2>
              <button onClick={() => fileRef.current?.click()} className="flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border bg-card p-10 transition hover:border-emerald-500/50">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">Tap to upload</p>
                <p className="text-xs text-muted-foreground">PDF or DOC, max 5 MB</p>
              </button>
              <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleFileSelect} />
            </>
          )}
          {extracting && (
            <div className="flex flex-col items-center gap-4 py-10">
              <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
              <p className="text-sm font-medium text-foreground">Extracting your skills…</p>
              <p className="text-xs text-muted-foreground">{uploadedFile?.name}</p>
            </div>
          )}
          {!extracting && extractedKeywords.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground text-center">We found these skills</h2>
              <p className="text-xs text-muted-foreground text-center">Confirm and we'll set up your profile</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {extractedKeywords.map((kw) => (
                  <span key={kw} className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    <Check className="h-3 w-3" /> {kw}
                  </span>
                ))}
              </div>
              <button onClick={confirmKeywords} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700">
                Looks good, continue <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {step === "career-guide" && (
        <div className="w-full max-w-sm space-y-5">
          <button onClick={() => setStep("resume-choice")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
          <div className="flex gap-1">
            {careerQuestions.map((_, i) => (
              <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= careerStep ? "bg-emerald-500" : "bg-muted"}`} />
            ))}
          </div>
          <div className="rounded-2xl bg-card border border-border p-5 shadow-sm space-y-4">
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 mt-0.5"><Sparkles className="h-4 w-4" /></span>
              <div>
                <p className="text-xs text-muted-foreground mb-1">AlgoScout AI</p>
                <p className="text-sm text-foreground leading-relaxed">{careerQuestions[careerStep].label}</p>
              </div>
            </div>
            <textarea value={currentAnswer} onChange={(e) => setCurrentAnswer(e.target.value)} placeholder={careerQuestions[careerStep].placeholder} rows={3} className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition" />
            <button onClick={handleCareerNext} disabled={!currentAnswer.trim()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-40">
              {careerStep < careerQuestions.length - 1 ? (<>Next <ChevronRight className="h-4 w-4" /></>) : (<>Generate Resume <Sparkles className="h-4 w-4" /></>)}
            </button>
          </div>
        </div>
      )}

      {step === "generating" && (
        <div className="w-full max-w-sm space-y-6">
          {!generatedResume ? (
            <div className="flex flex-col items-center gap-4 py-10">
              <div className="relative">
                <Loader2 className="h-12 w-12 animate-spin text-emerald-500" />
                <Sparkles className="absolute -right-1 -top-1 h-5 w-5 text-amber-500 animate-pulse" />
              </div>
              <p className="text-lg font-semibold text-foreground">Generating your resume…</p>
              <p className="text-xs text-muted-foreground text-center">Using your answers to craft a professional resume</p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-col items-center gap-3">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"><FileText className="h-7 w-7" /></span>
                <h2 className="text-xl font-semibold text-foreground">Resume Ready! 🎉</h2>
                <p className="text-sm text-muted-foreground text-center">Your AI-generated resume is ready to download</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-3">
                <p className="text-sm font-semibold text-foreground">{name}</p>
                <p className="text-xs text-muted-foreground">{email}</p>
                <div className="h-px bg-border" />
                <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Title:</span> {careerAnswers.title}</p>
                <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Skills:</span> {careerAnswers.skills}</p>
                <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Goal:</span> {careerAnswers.goal}</p>
              </div>
              <button onClick={handleDownloadResume} className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-600 bg-emerald-600/10 py-3 text-sm font-semibold text-emerald-600 dark:text-emerald-400 transition hover:bg-emerald-600/20">
                <Download className="h-4 w-4" /> Download Resume
              </button>
              <button onClick={finishCareerGuide} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700">
                Continue to App <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Auth;