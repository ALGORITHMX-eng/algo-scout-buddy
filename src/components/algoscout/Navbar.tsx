import { Bot, Mic, Radar, Plus, User, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { ThemeToggle } from "@/components/theme-toggle";

export const AlgoNavbar = () => {
  const iconBtn = "inline-flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/25";

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-3 sm:px-5 py-3">
        <Link to="/algoscout" className="flex items-center gap-2 shrink-0">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30">
            <Radar className="h-4 w-4" />
          </span>
          <div className="leading-tight">
            <div className="font-display text-[15px] font-semibold text-foreground">AlgoScout</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">AI job tracker</div>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2">
            <Link to="/algoscout/chat" className={iconBtn} aria-label="AI Chat">
              <Bot className="h-3.5 w-3.5" />
            </Link>
            <Link to="/algoscout/interview" className={iconBtn} aria-label="Interview Prep">
              <Mic className="h-3.5 w-3.5" />
            </Link>
            <Link to="/algoscout/profile" className={iconBtn} aria-label="Form Memory">
              <User className="h-3.5 w-3.5" />
            </Link>
            <Link to="/algoscout/settings" className={iconBtn} aria-label="Settings">
              <Settings className="h-3.5 w-3.5" />
            </Link>
          </div>

          <Link
            to="/algoscout/add"
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/25"
          >
            <Plus className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Add job</span>
          </Link>
          <ThemeToggle />
        </div>
      </div>

      {/* Mobile bottom nav */}
      <div className="flex sm:hidden items-center justify-around border-t border-border/50 px-2 py-2">
        <Link to="/algoscout/chat" className="flex flex-col items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
          <Bot className="h-4 w-4" />
          <span className="text-[9px] font-medium">Chat</span>
        </Link>
        <Link to="/algoscout/interview" className="flex flex-col items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
          <Mic className="h-4 w-4" />
          <span className="text-[9px] font-medium">Interview</span>
        </Link>
        <Link to="/algoscout/profile" className="flex flex-col items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
          <User className="h-4 w-4" />
          <span className="text-[9px] font-medium">Profile</span>
        </Link>
        <Link to="/algoscout/settings" className="flex flex-col items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
          <Settings className="h-4 w-4" />
          <span className="text-[9px] font-medium">Settings</span>
        </Link>
      </div>
    </header>
  );
};