import { useState, useEffect } from "react";
import { AlgoNavbar } from "@/components/algoscout/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Settings as SettingsIcon, User, MapPin, Briefcase, Code2, FileText,
  Save, Upload, Sparkles, Check, Crown, Zap, Shield, ChevronRight,
  Mic, MessageSquareText, Radio, Trash2, Clock,
} from "lucide-react";
import {
  InterviewSession, loadInterviewSessions, deleteInterviewSession,
} from "@/lib/algoscout-chat-history";

/* ---------- Local persistence ---------- */
const SETTINGS_KEY = "algoscout:settings:v1";

type UserSettings = {
  name: string;
  email: string;
  location: string;
  skills: string;
  experience: string;
  preferredTitles: string;
  workPreference: "remote" | "hybrid" | "onsite" | "";
  resumeSource: "uploaded" | "generated" | "";
};

const defaults: UserSettings = {
  name: "",
  email: "",
  location: "",
  skills: "",
  experience: "",
  preferredTitles: "",
  workPreference: "",
  resumeSource: "",
};

const load = (): UserSettings => {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") };
  } catch {
    return { ...defaults };
  }
};

const persist = (s: UserSettings) => localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));

/* ---------- Plans ---------- */
const plans = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    icon: Zap,
    features: [
      "1 auto-scan per day",
      "Active for 3 days only",
      "5 job slots max",
      "Basic AI chat",
      "Manual job add (counts toward daily limit)",
      "PDF upload for 1 of 3 jobs",
    ],
    accent: "text-muted-foreground",
    ring: "ring-border",
    bg: "bg-card",
  },
  {
    id: "starter",
    name: "Starter",
    price: "$9",
    period: "/mo",
    icon: Zap,
    features: [
      "8 auto-scans per day (every 3hrs)",
      "Unlimited job slots",
      "AI job scoring",
      "Cover letter generation",
      "PDF upload",
      "Manual job add (counts toward daily limit)",
    ],
    accent: "text-blue-600 dark:text-blue-400",
    ring: "ring-blue-500/40",
    bg: "bg-blue-500/5",
  },
  {
    id: "pro",
    name: "Pro",
    price: "$19",
    period: "/mo",
    icon: Crown,
    features: [
      "16 auto-scans per day (every 1.5hrs)",
      "Everything in Starter",
      "Resume PDF upload & re-upload anytime",
      "Voice interview prep",
      "AI career coach",
      "Priority scoring",
      "Manual job add (counts toward daily limit)",
    ],
    accent: "text-emerald-600 dark:text-emerald-400",
    ring: "ring-emerald-500/40",
    bg: "bg-emerald-500/5",
    popular: true,
  },
  {
    id: "elite",
    name: "Elite",
    price: "$39",
    period: "/mo",
    icon: Shield,
    features: [
      "48 auto-scans per day (every 30mins)",
      "Everything in Pro",
      "Fastest job discovery",
      "Priority Firecrawl processing",
      "Resume PDF upload & re-upload anytime",
      "Manual job add (counts toward daily limit)",
    ],
    accent: "text-violet-600 dark:text-violet-400",
    ring: "ring-violet-500/40",
    bg: "bg-violet-500/5",
  },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings>(defaults);
  const [dirty, setDirty] = useState(false);
  const [currentPlan] = useState("free");
  const [interviews, setInterviews] = useState<InterviewSession[]>([]);

  useEffect(() => {
    setSettings(load());
    setInterviews(loadInterviewSessions());
  }, []);

  const handleDeleteInterview = (id: string) => {
    deleteInterviewSession(id);
    setInterviews(loadInterviewSessions());
    toast.success("Interview session deleted");
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}m ${sec}s`;
  };

  const update = (key: keyof UserSettings, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = () => {
    persist(settings);
    setDirty(false);
    toast.success("Settings saved");
  };

  const inputCls =
    "bg-card border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-emerald-500/40";

  const workOptions: { value: UserSettings["workPreference"]; label: string }[] = [
    { value: "remote", label: "🏠 Remote" },
    { value: "hybrid", label: "🏢 Hybrid" },
    { value: "onsite", label: "📍 On-site" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AlgoNavbar />

      <main className="mx-auto max-w-2xl px-4 py-8 space-y-10">
        {/* ── Header ── */}
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30">
            <SettingsIcon className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-xl font-semibold">Settings</h1>
            <p className="text-xs text-muted-foreground">Your profile powers every AI feature</p>
          </div>
        </div>

        {/* ── Identity ── */}
        <section className="space-y-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            <User className="h-4 w-4" /> Identity
          </h2>
          <div className="grid gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Full Name</label>
              <Input value={settings.name} onChange={(e) => update("name", e.target.value)} placeholder="John Doe" className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Email</label>
              <Input value={settings.email} onChange={(e) => update("email", e.target.value)} placeholder="john@example.com" type="email" className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Location</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={settings.location} onChange={(e) => update("location", e.target.value)} placeholder="Lagos, Nigeria" className={`${inputCls} pl-9`} />
              </div>
            </div>
          </div>
        </section>

        {/* ── Skills & Experience ── */}
        <section className="space-y-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            <Code2 className="h-4 w-4" /> Skills & Experience
          </h2>
          <div className="grid gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Skills (comma-separated)</label>
              <Textarea value={settings.skills} onChange={(e) => update("skills", e.target.value)} placeholder="React, TypeScript, Node.js, Figma…" rows={2} className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Experience Summary</label>
              <Textarea value={settings.experience} onChange={(e) => update("experience", e.target.value)} placeholder="3 years frontend dev, built SaaS products…" rows={3} className={inputCls} />
            </div>
          </div>
        </section>

        {/* ── Job Preferences ── */}
        <section className="space-y-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            <Briefcase className="h-4 w-4" /> Job Preferences
          </h2>
          <div className="grid gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Preferred Job Titles</label>
              <Input value={settings.preferredTitles} onChange={(e) => update("preferredTitles", e.target.value)} placeholder="Frontend Engineer, Full-stack Developer…" className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Work Preference</label>
              <div className="flex gap-2">
                {workOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => update("workPreference", opt.value)}
                    className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                      settings.workPreference === opt.value
                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "border-border bg-card text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Resume Source ── */}
        <section className="space-y-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            <FileText className="h-4 w-4" /> Resume
          </h2>
          <div className="flex gap-3">
            {[
              { value: "uploaded" as const, icon: Upload, label: "Uploaded", sub: "You uploaded a resume" },
              { value: "generated" as const, icon: Sparkles, label: "AI Generated", sub: "Built with Career Guide" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => update("resumeSource", opt.value)}
                className={`flex-1 rounded-xl border p-4 text-left transition ${
                  settings.resumeSource === opt.value
                    ? "border-emerald-500/50 bg-emerald-500/10"
                    : "border-border bg-card hover:bg-muted"
                }`}
              >
                <opt.icon className={`h-5 w-5 mb-2 ${settings.resumeSource === opt.value ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`} />
                <p className={`text-sm font-medium ${settings.resumeSource === opt.value ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>{opt.label}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{opt.sub}</p>
              </button>
            ))}
          </div>
        </section>

        {/* ── Save button ── */}
        {dirty && (
          <div className="sticky bottom-4">
            <Button onClick={handleSave} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-12 text-sm font-semibold shadow-lg">
              <Save className="mr-2 h-4 w-4" /> Save Changes
            </Button>
          </div>
        )}

        {/* ── Subscriptions ── */}
        <section className="space-y-4 pb-10">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            <Crown className="h-4 w-4" /> Subscription
          </h2>

          <div className="grid gap-3 sm:grid-cols-2">
            {plans.map((plan) => {
              const active = currentPlan === plan.id;
              return (
                <div
                  key={plan.id}
                  className={`relative rounded-xl border p-5 transition ${plan.ring} ${plan.bg} ${active ? "ring-2" : "ring-1"}`}
                >
                  {plan.popular && (
                    <span className="absolute -top-2.5 right-4 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-semibold text-white">
                      Popular
                    </span>
                  )}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <plan.icon className={`h-5 w-5 ${plan.accent}`} />
                      <div>
                        <p className={`text-sm font-semibold ${plan.accent}`}>{plan.name}</p>
                        <p className="text-lg font-bold text-foreground">
                          {plan.price}
                          <span className="text-xs font-normal text-muted-foreground">{plan.period}</span>
                        </p>
                      </div>
                    </div>
                    {active ? (
                      <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30">
                        Current
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs border-border"
                        onClick={() => toast("Coming soon", { description: "Payments will be enabled shortly." })}
                      >
                        Upgrade <ChevronRight className="ml-1 h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <ul className="mt-3 space-y-1.5">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Check className={`h-3.5 w-3.5 shrink-0 ${active ? "text-emerald-500" : "text-muted-foreground/50"}`} />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          {/* Auto-Apply Credits */}
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-foreground mb-3">Auto-Apply Credits</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { credits: 10, price: "$5" },
                { credits: 30, price: "$10" },
                { credits: 100, price: "$30" },
              ].map((pack) => (
                <button
                  key={pack.credits}
                  onClick={() => toast("Coming soon", { description: "Credit packs will be available shortly." })}
                  className="rounded-xl border border-border bg-card p-4 text-center transition hover:bg-muted hover:border-emerald-500/30"
                >
                  <p className="text-lg font-bold text-foreground">{pack.credits}</p>
                  <p className="text-[11px] text-muted-foreground">credits</p>
                  <p className="mt-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">{pack.price}</p>
                </button>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
