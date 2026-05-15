import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXA_API_KEY = Deno.env.get("EXA_API_KEY")!;
const SCRAPEDO_API_KEY = Deno.env.get("SCRAPEDO_API_KEY")!;
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SCOUT_SECRET = Deno.env.get("SCOUT_SECRET")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-scout-secret",
};

const BLOCKED_DOMAINS = [
  "linkedin.com", "reddit.com", "youtube.com", "quora.com",
  "medium.com", "substack.com", "twitter.com",
  "freelancer.com", "upwork.com", "fiverr.com",
];

const SENIORITY_BLACKLIST = [
  "vp ", "vice president", "director of", "head of", "principal engineer",
  "staff engineer", "distinguished engineer", "c-suite", "cto", "ceo", "coo",
  "chief ", "svp", "evp", "managing director", "tech lead", "lead engineer",
  "engineering manager", "engineering director",
];

const ONSITE_SIGNALS = [
  "must be located in", "on-site required", "onsite required", "in-office",
  "relocation required", "must relocate", "not remote", "no remote",
  "office-based", "based in our", "work from our office",
];

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.search = "";
    return u.toString().toLowerCase().replace(/\/$/, "");
  } catch {
    return url.toLowerCase().trim();
  }
}

function shouldSkipEarly(title: string, content: string, profile: any): { skip: boolean; reason: string } {
  const titleLower = title.toLowerCase();
  const contentLower = content.toLowerCase();

  if (profile.years_experience < 5) {
    const isTooSenior = SENIORITY_BLACKLIST.some((k) => titleLower.includes(k));
    if (isTooSenior) return { skip: true, reason: `seniority_mismatch: ${title}` };
  }

  if (profile.work_preference === "remote") {
    const isOnSite = ONSITE_SIGNALS.some((s) => contentLower.includes(s));
    if (isOnSite) return { skip: true, reason: `onsite_rejected: ${title}` };
  }

  return { skip: false, reason: "" };
}

// ─── TypeScript weighted score calculator ─────────────────────────────────────
function calculateCumulativeScore(breakdown: {
  skill_match: number;
  experience_level: number;
  domain_fit: number;
  work_flexibility: number;
}): number {
  const cumulative =
    (breakdown.skill_match * 0.40) +
    (breakdown.experience_level * 0.25) +
    (breakdown.domain_fit * 0.20) +
    (breakdown.work_flexibility * 0.15);
  return Math.round(cumulative * 10) / 10;
}

// ─── Exa Search — 20 results per query ───────────────────────────────────────
async function exaSearch(query: string): Promise<Array<{ url: string; title: string; content: string }>> {
  try {
    const res = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": EXA_API_KEY },
      body: JSON.stringify({
        query,
        type: "auto",
        numResults: 20,
        contents: { text: { maxCharacters: 3000 } },
      }),
    });
    if (!res.ok) { console.error(`[exa] failed: ${res.status}`); return []; }
    const data = await res.json();
    return (data.results || []).map((r: any) => ({
      url: r.url || "",
      title: r.title || "",
      content: (r.text || "").slice(0, 3000),
    }));
  } catch (err) { console.error("[exa] error:", err); return []; }
}

// ─── Scrape.do Fallback ───────────────────────────────────────────────────────
async function scrapeDoExtract(url: string): Promise<string> {
  try {
    const res = await fetch(
      `https://api.scrape.do?token=${SCRAPEDO_API_KEY}&url=${encodeURIComponent(url)}&render=true&output=markdown`
    );
    if (!res.ok) return "";
    return (await res.text()).slice(0, 3000);
  } catch { return ""; }
}

// ─── Generate Seeds — 20 seeds ───────────────────────────────────────────────
async function generateSeeds(userId: string, profile: any): Promise<string[]> {
  const { data: existing } = await supabase
    .from("search_seeds")
    .select("query")
    .eq("user_id", userId);

  if (existing && existing.length > 0) {
    console.log(`[seeds] using ${existing.length} existing seeds`);
    return existing.map((s: any) => s.query);
  }

  const skills = profile.skills?.join(", ") || "";
  const titles = profile.preferred_titles?.join(", ") || "";

  try {
    const res = await fetch("https://models.inference.ai.azure.com/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 1000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Return only valid JSON, no markdown." },
          {
            role: "user",
            content: `Generate 20 diverse job search queries for this candidate.

Skills: ${skills}
Target Roles: ${titles}
Work Preference: ${profile.work_preference || "remote"}

Rules:
- Mix different job titles, seniority levels, and company types
- Include some niche/specific queries and some broad ones
- Each query should target real job boards and hiring pages
- Include "job", "hiring", "careers", or "apply" in each query
- Vary the queries — don't repeat the same title

Return: {"queries": ["query1", "query2", ...]} with exactly 20 queries`,
          },
        ],
      }),
    });
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(text);
    const queries: string[] = parsed.queries || [];

    if (queries.length > 0) {
      await supabase.from("search_seeds").delete().eq("user_id", userId);
      await supabase.from("search_seeds").insert(
        queries.map((q) => ({ user_id: userId, query: q }))
      );
    }

    return queries;
  } catch (err) {
    console.error("[seeds] error:", err);
    return [];
  }
}

// ─── Analyze + Score ──────────────────────────────────────────────────────────
async function analyzeJob(
  content: string,
  title: string,
  url: string,
  profile: any,
): Promise<{
  is_real_job: boolean;
  company: string;
  role: string;
  location: string;
  description: string;
  score: number;
  reason: string;
  breakdown: {
    skill_match: number;
    experience_level: number;
    domain_fit: number;
    work_flexibility: number;
    missing_skills: string[];
    matched_skills: string[];
    required_years: number | null;
  };
} | null> {
  const skills = profile.skills?.join(", ") || "Not specified";
  const titles = profile.preferred_titles?.join(", ") || "Not specified";
  const yearsExp = profile.years_experience || 0;
  const workPref = profile.work_preference || "remote";

  try {
    const res = await fetch("https://models.inference.ai.azure.com/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 1000,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are ALGOscout, a brutally honest AI job matching engine. Protect candidates from wasting time on roles they are NOT qualified for. Be strict and accurate — never inflate scores. Return only valid JSON, no markdown.`,
          },
          {
            role: "user",
            content: `CANDIDATE PROFILE:
Name: ${profile.full_name}
Skills: ${skills}
Target Roles: ${titles}
Years of Experience: ${yearsExp}
Work Preference: ${workPref}
Location: ${profile.location || "Not specified"}
Summary: ${profile.experience_summary || "Not provided"}

JOB CONTENT:
Title: ${title}
URL: ${url}
Content: ${content.slice(0, 2500)}

STEP 1 — REALITY CHECK:
Is this a real job posting? Set is_real_job=false if it is a tweet, blog post, developer profile, newsletter, or any non-hiring content.

STEP 2 — EXTRACT:
Pull out company name, exact job title, location, required years of experience, and a clean 2-3 paragraph job description.

STEP 3 — SCORE EACH ASPECT INDEPENDENTLY (1.0 to 10.0, one decimal, be strict):
Do NOT calculate the cumulative score — that will be done in TypeScript.

A. SKILL MATCH:
- List ALL skills/technologies the job requires
- Compare against candidate skills: ${skills}
- matched_skills = skills candidate HAS that job requires
- missing_skills = skills job requires that candidate LACKS
- Score based on % of required skills candidate actually has:
  9.0-10.0 = 85%+ matched
  7.0-8.9  = 65-84% matched
  5.0-6.9  = 40-64% matched
  3.0-4.9  = 20-39% matched
  1.0-2.9  = less than 20% matched

B. EXPERIENCE LEVEL:
- Extract required years (set required_years null if not mentioned)
- Candidate has ${yearsExp} years
  9.0-10.0 = within 1 year OR no requirement mentioned
  7.0-8.9  = 1-2 years difference
  5.0-6.9  = 2-3 years difference
  3.0-4.9  = 3-4 years difference
  1.0-2.9  = more than 4 years difference

C. DOMAIN FIT:
- Candidate targets: ${titles}
  9.0-10.0 = perfect domain and role alignment
  7.0-8.9  = related domain, close role
  5.0-6.9  = adjacent domain, some overlap
  3.0-4.9  = different domain, transferable skills
  1.0-2.9  = completely different domain

D. WORK FLEXIBILITY:
- Candidate prefers: ${workPref}
  10.0 = exact match
  7.0  = hybrid when candidate wants remote
  6.0  = not mentioned
  4.0  = flexible but not ideal
  1.0  = complete mismatch

STEP 4 — REASON:
2-3 brutally honest sentences. Mention specific matched AND missing skills. Never generic.

Return ONLY this JSON (leave score as 0 — TypeScript calculates it):
{
  "is_real_job": true,
  "company": "Company Name",
  "role": "Exact Job Title",
  "location": "Remote or City",
  "description": "Clean 2-3 paragraph job description",
  "score": 0,
  "reason": "2-3 brutally honest sentences.",
  "breakdown": {
    "skill_match": 7.5,
    "experience_level": 6.0,
    "domain_fit": 8.0,
    "work_flexibility": 10.0,
    "missing_skills": ["PyTorch", "JAX"],
    "matched_skills": ["Python", "LangChain", "RAG"],
    "required_years": 3
  }
}`,
          },
        ],
      }),
    });

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "{}";

    let parsed: any;
    try { parsed = JSON.parse(text); }
    catch {
      const match = text.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : null;
    }

    if (!parsed) return null;

    // TypeScript calculates the real score
    if (parsed.breakdown) {
      parsed.score = calculateCumulativeScore(parsed.breakdown);
    }

    return parsed;
  } catch (err) {
    console.error("[analyze] error:", err);
    return null;
  }
}

// ─── Notify ───────────────────────────────────────────────────────────────────
async function notifyUser(userId: string, job: any) {
  try {
    const { data: subs } = await supabase
      .from("push_subscriptions").select("*").eq("user_id", userId);
    if (!subs || subs.length === 0) return;
    await fetch(`${SUPABASE_URL}/functions/v1/notify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "x-scout-secret": SCOUT_SECRET,
      },
      body: JSON.stringify({ record: job }),
    });
  } catch (err) { console.error("[notify] error:", err); }
}

// ─── Main Scout ───────────────────────────────────────────────────────────────
async function scoutForUser(userId: string) {
  const { data: profile } = await supabase
    .from("profiles").select("*").eq("user_id", userId).single();
  if (!profile) {
    console.error(`No profile: ${userId}`);
    return { jobs_found: 0, jobs_inserted: 0, jobs_skipped: 0 };
  }

  const seeds = await generateSeeds(userId, profile);
  if (seeds.length === 0) {
    console.log(`No seeds: ${userId}`);
    return { jobs_found: 0, jobs_inserted: 0, jobs_skipped: 0 };
  }

  console.log(`[scout] ${seeds.length} seeds for user ${userId}`);

  const allResultsNested = await Promise.all(seeds.map((q) => exaSearch(q)));
  const allResults = allResultsNested.flat();
  console.log(`[scout] ${allResults.length} raw results from Exa`);

  const seen = new Set<string>();
  const candidates = allResults.filter((r) => {
    if (!r.url) return false;
    const norm = normalizeUrl(r.url);
    if (!norm || seen.has(norm)) return false;
    seen.add(norm);
    try {
      const host = new URL(r.url).hostname;
      return !BLOCKED_DOMAINS.some((b) => host.includes(b));
    } catch { return false; }
  });

  console.log(`[scout] ${candidates.length} unique URLs after dedup/block`);

  let totalInserted = 0;
  let totalSkipped = 0;

  for (let i = 0; i < candidates.length; i += 3) {
    const batch = candidates.slice(i, i + 3);
    await Promise.all(batch.map(async (result) => {
      const rawUrl = result.url;
      const normalizedUrl = normalizeUrl(rawUrl);

      const { data: existing } = await supabase
        .from("jobs").select("id")
        .eq("user_id", userId)
        .eq("job_url_normalized", normalizedUrl)
        .maybeSingle();
      if (existing) { totalSkipped++; return; }

      let content = result.content;
      if (!content || content.length < 200) {
        console.log(`[scout] Exa content short → Scrape.do: ${rawUrl.slice(0, 50)}`);
        content = await scrapeDoExtract(rawUrl);
      }
      if (!content || content.length < 100) {
        console.log(`[scout] SKIP no_content: ${rawUrl.slice(0, 50)}`);
        totalSkipped++;
        return;
      }

      const { skip, reason } = shouldSkipEarly(result.title, content, profile);
      if (skip) {
        console.log(`[scout] PRE-FILTER SKIP ${reason}`);
        totalSkipped++;
        return;
      }

      const analysis = await analyzeJob(content, result.title, rawUrl, profile);
      if (!analysis) { totalSkipped++; return; }

      if (!analysis.is_real_job) {
        console.log(`[scout] SKIP not_a_job: ${result.title.slice(0, 50)}`);
        totalSkipped++;
        return;
      }

      // Threshold lowered to 6.0 for more volume
      if (analysis.score < 6) {
        console.log(`[scout] SKIP score=${analysis.score}: ${analysis.company}`);
        totalSkipped++;
        return;
      }

      const { data: rejected } = await supabase
        .from("jobs").select("id")
        .eq("user_id", userId)
        .eq("company", analysis.company)
        .eq("status", "rejected")
        .maybeSingle();
      if (rejected) { totalSkipped++; return; }

      const { data: newJob, error: insertError } = await supabase
        .from("jobs")
        .insert({
          user_id: userId,
          job_url: rawUrl,
          job_url_normalized: normalizedUrl,
          company: analysis.company,
          role: analysis.role,
          location: analysis.location,
          raw_text: content,
          description: analysis.description || "",
          score: analysis.score,
          score_reason: analysis.reason,
          score_breakdown: analysis.breakdown ? JSON.stringify(analysis.breakdown) : null,
          status: "pending",
          found_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        console.error(`[scout] INSERT ERROR: ${insertError.message}`);
        totalSkipped++;
      } else {
        console.log(`[scout] INSERTED: ${analysis.company} | score=${analysis.score}`);
        totalInserted++;
        if (analysis.score >= 8 && newJob) await notifyUser(userId, newJob);
      }
    }));
  }

  await supabase.from("scout_runs").insert({
    user_id: userId,
    jobs_found: allResults.length,
    jobs_inserted: totalInserted,
    jobs_skipped_duplicate: totalSkipped,
    error: null,
  });

  await supabase.from("profiles")
    .update({ last_scouted_at: new Date().toISOString() })
    .eq("user_id", userId);

  console.log(`[scout] DONE inserted=${totalInserted} skipped=${totalSkipped}`);
  return { jobs_found: allResults.length, jobs_inserted: totalInserted, jobs_skipped: totalSkipped };
}

// ─── Handler ──────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const secret = req.headers.get("x-scout-secret");
  if (secret !== SCOUT_SECRET) return new Response("Unauthorized", { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const userId = body.user_id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "user_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // @ts-ignore
    EdgeRuntime.waitUntil(scoutForUser(userId).catch(console.error));

    return new Response(
      JSON.stringify({ success: true, message: "Scout started in background" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});