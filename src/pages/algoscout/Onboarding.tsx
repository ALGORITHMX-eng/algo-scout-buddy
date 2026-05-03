import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ChevronRight, Radar, BarChart3, Mic, MessageSquare, Bell, ClipboardList } from "lucide-react";

import onboardingDashboard from "@/assets/onboarding-dashboard.jpg";
import onboardingInterview from "@/assets/onboarding-interview.jpg";
import onboardingProfile from "@/assets/onboarding-profile.jpg";
import onboardingNotifications from "@/assets/onboarding-notifications.jpg";
import onboardingChat from "@/assets/onboarding-chat.jpg";

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
    description:
      "Every job lead gets an AI score from 1–10. Approve, reject, or bulk-manage leads in one tap. Filter by tags like Remote, High Priority, and more.",
  },
  {
    image: onboardingInterview,
    icon: <Mic className="h-5 w-5" />,
    title: "Voice Interview Prep",
    subtitle: "Practice with AI",
    description:
      "Choose Live Voice or Text Chat mode, set a timer, and practice real interview questions. The AI responds with voice feedback — like a real interviewer.",
  },
  {
    image: onboardingChat,
    icon: <MessageSquare className="h-5 w-5" />,
    title: "AI Career Coach",
    subtitle: "Get personalized advice",
    description:
      "Chat with your AI career coach about resumes, salary negotiation, career pivots, and more. It remembers your context and gives tailored guidance.",
  },
  {
    image: onboardingProfile,
    icon: <ClipboardList className="h-5 w-5" />,
    title: "Form Memory",
    subtitle: "Never re-type answers",
    description:
      "Save common application answers once. When Skyvern can't fill a field, you'll get an alert — answer once and it's saved forever.",
  },
  {
    image: onboardingNotifications,
    icon: <Bell className="h-5 w-5" />,
    title: "Smart Notifications",
    subtitle: "Never miss a match",
    description:
      "Get instant alerts when a role scores 8+ against your profile. Tap the notification to view full details and take action immediately.",
  },
];

const Onboarding = () => {
  const [current, setCurrent] = useState(0);
  const navigate = useNavigate();
  const slide = slides[current];
  const isLast = current === slides.length - 1;

  const finish = () => {
    localStorage.setItem("algoscout:onboarded", "true");
    navigate("/algoscout");
  };

  const next = () => {
    if (isLast) return finish();
    setCurrent((p) => p + 1);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30">
            <Radar className="h-4 w-4" />
          </span>
          <span className="font-display text-sm font-semibold text-foreground">AlgoScout</span>
        </div>
        <button
          onClick={finish}
          className="text-xs font-medium text-muted-foreground hover:text-foreground transition"
        >
          Skip
        </button>
      </header>

      {/* Image */}
      <div className="relative mx-5 overflow-hidden rounded-2xl">
        <img
          src={slide.image}
          alt={slide.title}
          className="aspect-[4/3] w-full object-cover"
          width={800}
          height={600}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
        <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-xl bg-background/70 px-3 py-1.5 backdrop-blur-sm">
          <span className="text-emerald-600 dark:text-emerald-400">{slide.icon}</span>
          <span className="text-xs font-medium text-foreground">{slide.subtitle}</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col px-5 pt-6">
        <h2 className="font-display text-2xl font-semibold text-foreground">{slide.title}</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{slide.description}</p>
      </div>

      {/* Footer */}
      <div className="px-5 pb-8 pt-4">
        {/* Dots */}
        <div className="mb-6 flex items-center justify-center gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-2 rounded-full transition-all ${
                i === current
                  ? "w-6 bg-emerald-500"
                  : "w-2 bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>

        <button
          onClick={next}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          {isLast ? (
            <>
              Get Started <ArrowRight className="h-4 w-4" />
            </>
          ) : (
            <>
              Next <ChevronRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default Onboarding;
