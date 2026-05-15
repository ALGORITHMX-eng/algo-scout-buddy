// src/components/algoscout/ScoreBreakdown.tsx

type Breakdown = {
  skill_match: number;
  experience_level: number;
  domain_fit: number;
  work_flexibility: number;
  missing_skills: string[];
  matched_skills: string[];
  required_years: number | null;
};

function AspectBar({
  label,
  score,
  weight,
  color,
}: {
  label: string;
  score: number;
  weight: string;
  color: string;
}) {
  const pct = (score / 10) * 100;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-foreground">{label}</span>
          <span className="text-[10px] text-muted-foreground">{weight}</span>
        </div>
        <span className="text-xs font-semibold tabular-nums" style={{ color }}>
          {score.toFixed(1)}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function scoreColor(score: number): string {
  if (score >= 8) return "#10b981"; // emerald
  if (score >= 6) return "#f59e0b"; // amber
  return "#ef4444"; // red
}

export function ScoreBreakdown({ breakdown, cumulative }: { breakdown: Breakdown; cumulative: number }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Match Breakdown</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">Weighted score across 4 dimensions</p>
        </div>
        <div className="flex flex-col items-end">
          <span
            className="text-2xl font-bold tabular-nums"
            style={{ color: scoreColor(cumulative) }}
          >
            {cumulative.toFixed(1)}
          </span>
          <span className="text-[10px] text-muted-foreground">/ 10</span>
        </div>
      </div>

      {/* Aspect bars */}
      <div className="space-y-3">
        <AspectBar
          label="Skill Match"
          score={breakdown.skill_match}
          weight="40%"
          color={scoreColor(breakdown.skill_match)}
        />
        <AspectBar
          label="Experience Level"
          score={breakdown.experience_level}
          weight="25%"
          color={scoreColor(breakdown.experience_level)}
        />
        <AspectBar
          label="Domain Fit"
          score={breakdown.domain_fit}
          weight="20%"
          color={scoreColor(breakdown.domain_fit)}
        />
        <AspectBar
          label="Work Flexibility"
          score={breakdown.work_flexibility}
          weight="15%"
          color={scoreColor(breakdown.work_flexibility)}
        />
      </div>

      {/* Required years */}
      {breakdown.required_years !== null && (
        <div className="rounded-lg bg-muted/50 px-3 py-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Experience required</span>
          <span className="text-xs font-semibold text-foreground">{breakdown.required_years} yr{breakdown.required_years !== 1 ? "s" : ""}</span>
        </div>
      )}

      {/* Matched skills */}
      {breakdown.matched_skills?.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            ✓ Skills you have
          </p>
          <div className="flex flex-wrap gap-1.5">
            {breakdown.matched_skills.map((skill) => (
              <span
                key={skill}
                className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Missing skills */}
      {breakdown.missing_skills?.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-500">
            ✗ Skills to develop
          </p>
          <div className="flex flex-wrap gap-1.5">
            {breakdown.missing_skills.map((skill) => (
              <span
                key={skill}
                className="rounded-full bg-rose-500/10 border border-rose-500/20 px-2.5 py-0.5 text-[11px] font-medium text-rose-500"
              >
                {skill}
              </span>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground pt-1">
            Building these skills would increase your match score for similar roles.
          </p>
        </div>
      )}
    </section>
  );
}