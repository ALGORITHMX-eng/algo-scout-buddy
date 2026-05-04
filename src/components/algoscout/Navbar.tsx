import { Bell, Bot, Mic, Radar, Plus, User, Settings } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { Job, getReadNotifIds, loadJobs, markNotifsRead, scoreColor } from "@/lib/algoscout-data";
import { ThemeToggle } from "@/components/theme-toggle";

export const AlgoNavbar = () => {
  const [open, setOpen] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    setJobs(loadJobs());
    setReadIds(getReadNotifIds());
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const highMatches = jobs.filter((j) => j.score >= 8).slice(0, 8);
  const unread = highMatches.filter((j) => !readIds.includes(j.id));

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && unread.length) {
      markNotifsRead(unread.map((j) => j.id));
      setReadIds(getReadNotifIds());
    }
  };

  const iconBtn = "inline-flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/25";

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur overflow-x-auto">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-3 sm:px-5 py-3 min-w-0">
        <Link to="/algoscout" className="flex items-center gap-2 shrink-0 min-w-0">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30">
            <Radar className="h-4 w-4" />
          </span>
          <div className="leading-tight">
            <div className="font-display text-[15px] font-semibold text-foreground">AlgoScout</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">AI job tracker</div>
          </div>
        </Link>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
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
          <Link
            to="/algoscout/add"
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/25"
          >
            <Plus className="h-3.5 w-3.5" /> Add job
          </Link>
          <ThemeToggle />
          <div ref={ref} className="relative">
            <button
              onClick={toggle}
              className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground/80 transition hover:bg-muted"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              {unread.length > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-semibold text-white">
                  {unread.length}
                </span>
              )}
            </button>

            {open && (
              <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-popover shadow-2xl">
                <div className="border-b border-border px-4 py-3">
                  <div className="font-display text-sm font-semibold text-foreground">High-score matches</div>
                  <div className="text-[11px] text-muted-foreground">Roles scoring 8.0 or above</div>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {highMatches.length === 0 && (
                    <div className="px-4 py-6 text-center text-sm text-muted-foreground">No high matches yet.</div>
                  )}
                  {highMatches.map((j) => {
                    const c = scoreColor(j.score);
                    return (
                      <button
                        key={j.id}
                        onClick={() => { setOpen(false); navigate(`/algoscout/job/${j.id}`); }}
                        className="flex w-full items-center gap-3 border-b border-border/70 px-4 py-3 text-left transition hover:bg-muted"
                      >
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[12px] font-semibold ${
                          c === "green" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : c === "yellow" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                          : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                        }`}>
                          {j.score.toFixed(1)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-foreground">{j.role}</div>
                          <div className="truncate text-xs text-muted-foreground">{j.company}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
