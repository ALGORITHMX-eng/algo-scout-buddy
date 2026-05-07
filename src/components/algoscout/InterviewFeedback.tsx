import { CheckCircle2, AlertTriangle, Target, TrendingUp, Quote, Dumbbell } from "lucide-react";

export type InterviewFeedbackData = {
  overall_score: number;
  overall_verdict: string;
  sections: {
    category: string;
    score: number;
    strength: string;
    improvement: string;
  }[];
  top_strengths: string[];
  critical_gaps: string[];
  recommended_drills: {
    drill: string;
    why: string;
    how: string;
  }[];
  hire_likelihood: string;
  coach_note: string;
};

function ScoreBar({ score, label }: { score: number; label: string }) {
  const color =
    score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-amber-500" : "bg-rose-500";
  const textColor =
    score >= 80 ? "text-emerald-600 dark:text-emerald-400" : score >= 60 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground">{label}</span>
        <span className={`text-xs font-bold ${textColor}`}>{score}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted">
        <div className={`h-2 rounded-full transition-all duration-700 ${color}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

export function InterviewFeedback({ feedback, onClose }: { feedback: InterviewFeedbackData; onClose?: () => void }) {
  const scoreColor =
    feedback.overall_score >= 80 ? "text-emerald-500" : feedback.overall_score >= 60 ? "text-amber-500" : "text-rose-500";
  const ringColor =
    feedback.overall_score >= 80 ? "ring-emerald-500/40" : feedback.overall_score >= 60 ? "ring-amber-500/40" : "ring-rose-500/40";
  const hireBg =
    feedback.hire_likelihood === "Yes" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-emerald-500/30" :
    feedback.hire_likelihood === "Maybe" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-amber-500/30" :
    "bg-rose-500/15 text-rose-600 dark:text-rose-400 ring-rose-500/30";

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      {/* Overall Score */}
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center">
        <div className={`flex h-20 w-20 items-center justify-center rounded-full ring-4 ${ringColor} bg-card`}>
          <span className={`font-display text-3xl font-bold ${scoreColor}`}>{feedback.overall_score}</span>
        </div>
        <p className="text-sm font-medium text-foreground">{feedback.overall_verdict}</p>
        <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ring-1 ${hireBg}`}>
          Hire Likelihood: {feedback.hire_likelihood}
        </span>
      </div>

      {/* Section Scores */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Target className="h-4 w-4" /> Category Breakdown
        </h3>
        {feedback.sections.map((s) => (
          <div key={s.category} className="space-y-2">
            <ScoreBar score={s.score} label={s.category} />
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-lg bg-emerald-500/5 p-2 border border-emerald-500/10">
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">Strength:</span>{" "}
                <span className="text-foreground/80">{s.strength}</span>
              </div>
              <div className="rounded-lg bg-amber-500/5 p-2 border border-amber-500/10">
                <span className="font-semibold text-amber-600 dark:text-amber-400">Improve:</span>{" "}
                <span className="text-foreground/80">{s.improvement}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Strengths & Gaps */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" /> Top Strengths
          </h3>
          <ul className="space-y-2">
            {feedback.top_strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                <TrendingUp className="h-3.5 w-3.5 shrink-0 text-emerald-500 mt-0.5" />
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
            <AlertTriangle className="h-4 w-4" /> Critical Gaps
          </h3>
          <ul className="space-y-2">
            {feedback.critical_gaps.map((g, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-500 mt-0.5" />
                {g}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Drills */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Dumbbell className="h-4 w-4" /> Recommended Drills
        </h3>
        <div className="space-y-3">
          {feedback.recommended_drills.map((d, i) => (
            <div key={i} className="rounded-xl bg-muted/50 p-3 border border-border space-y-1">
              <p className="text-sm font-semibold text-foreground">{d.drill}</p>
              <p className="text-[11px] text-muted-foreground"><span className="font-medium">Why:</span> {d.why}</p>
              <p className="text-[11px] text-muted-foreground"><span className="font-medium">How:</span> {d.how}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Coach Note */}
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
        <div className="flex items-start gap-3">
          <Quote className="h-5 w-5 shrink-0 text-emerald-500 mt-0.5" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1">Coach's Note</p>
            <p className="text-sm text-foreground/90 italic">{feedback.coach_note}</p>
          </div>
        </div>
      </div>

      {onClose && (
        <button
          onClick={onClose}
          className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          Done
        </button>
      )}
    </div>
  );
}
