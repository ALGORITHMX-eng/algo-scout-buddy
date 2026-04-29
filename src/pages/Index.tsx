import { Link } from "react-router-dom";
import { Radar, ArrowRight } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

const Index = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30">
            <Radar className="h-4 w-4" />
          </span>
          <span className="font-display text-[15px] font-semibold">AlgoScout</span>
        </div>
        <ThemeToggle />
      </header>

      <main className="mx-auto flex max-w-3xl flex-col items-center px-5 py-24 text-center">
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          AI-scored job leads, ready for review.
        </h1>
        <p className="mt-5 max-w-xl text-base text-muted-foreground">
          AlgoScout watches your target companies, scores roles against your profile, and pings you the moment a high match shows up.
        </p>
        <Link
          to="/algoscout"
          className="mt-8 inline-flex items-center gap-2 rounded-lg bg-emerald-500/15 px-5 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/25"
        >
          Open dashboard <ArrowRight className="h-4 w-4" />
        </Link>
      </main>
    </div>
  );
};

export default Index;
