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

// ─── Seniority keywords to hard-reject before calling GPT ─────────────────────
const SENIORITY_BLACKLIST = [
  "vp ", "vice president", "director of", "head of", "principal engineer",
  "staff engineer", "distinguished engineer", "c-suite", "cto", "ceo", "coo",
  "chief ", "svp", "evp", "managing director", "tech lead", "lead engineer",
  "engineering manager", "engineering director",
];

// ─── On-site signals to reject when user wants remote ─────────────────────────
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

// ─── Pre-filter: run BEFORE calling GPT to save API costs ─────────────────────
function shouldSkipEarly(
  title: string,
  content: string,
  profile: any,
): { skip: boolean; reason: string } {
  const titleLower = title.toLowerCase();
  const contentLower = content.toLowerCase();

  // 1. Seniority check — skip if title has lead/director/VP level keywords
  //    unless candidate has 5+ years experience
  if (profile.years_experience < 5) {
    const isTooSenior = SENIORITY_BLACKLIST.some((k) => titleLower.includes(k));
    if (isTooSenior) {
      return { skip: true, reason: `seniority_mismatch: ${title}` };
    }
  }

  // 2. Location check — if user wants remote, reject clear on-site jobs
  if (profile.work_preference === "remote") {
    const isOnSite = ONSITE_SIGNALS.some((s) => contentLower.includes(s));
    if (isOnSite) {
      return { skip: true, reason: `onsite_rejected: ${title}` };
    }
  }

  return { skip: false, reason: "" };
}

// ─── Step 1: Exa Search ────────────────────────────────────────────────────────
async function exaSearch(query: string): Promise<Array<{ url: string; title: string; content: string }>> {
  try {
    const res = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": EXA_API_KEY,
      },
      body: JSON.stringify({
        query,
        type: "auto",
        numResults: 10,
        contents: {
          text: { maxCharacters: 3000 },
        },
      }),
    });
    if (!res.ok) {
      console.error(`[exa] failed: ${res.status} ${await res.text()}`);
      return [];
    }
    const data = await res.json();
    return (data.results || []).map((r: any) => ({
      url: r.url || "",
      title: r.title || "",
      content: (r.text || "").slice(0, 3000),
    }));
  } catch (err) {
    console.error("[exa] error:", err);
    return [];
  }
}

// ─── Step 2: Scrape.do Fallback ───────────────────────────────────────────────
async function scrapeDoExtract(url: string): Promise<string> {
  try {
    const res = await fetch(
      `https://api.scrape.do?token=${SCRAPEDO_API_KEY}&url=${encodeURIComponent(url)}&render=true&output=markdown`
    );
    if (!res.ok) return "";
    return (await res.text()).slice(0, 3000);
  } catch {
    return "";
  }
}

// ─── Step 3: Analyze + Score (stricter prompt) ───────────────────────────────
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
  score: number;
  reason: string;
} | null> {
  try {
    const res = await fetch("https://models.inference.ai.azure.com/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 800,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are ALGOscout, a brutally honest AI job matching engine. Your job is to protect the candidate from wasting time on roles they are NOT qualified for. You must be strict and accurate — do NOT inflate scores. Return only valid JSON, no markdown.`,
          },
          {
            role: "user",
            content: `CANDIDATE PROFILE:
Name: ${profile.full_name}
Skills: ${profile.skills?.join(", ") || "Not specified"}
Target Roles: ${profile.preferred_titles?.join(", ") || "Not specified"}
Location: ${profile.location || "Not specified"}
Work Preference: ${profile.work_preference || "remote"}
Years of Experience: ${profile.years_experience} years
Summary: ${profile.experience_summary || "Not provided"}

JOB CONTENT:
Title: ${title}
URL: ${url}
Content: ${content.slice(0, 2000)}

---

STEP 1 — REALITY CHECK:
Is this a real job posting? Set is_real_job=false if it is a tweet, blog post, developer profile, newsletter, article, or any content that is not actively hiring.

STEP 2 — EXTRACT:
Pull out company name, exact job title, and location from the content.

STEP 3 — STRICT SCORING RULES:

Start at base score = 5.

ADDITIONS (add points):
- +1 for each skill from candidate profile that appears in job requirements (max +4, count carefully)
- +0.5 if company is an AI startup or emerging tech company
- +0.5 if role is fully remote and candidate prefers remote

HARD DEDUCTIONS (subtract points, these are serious):
- -3 if job requires significantly more years of experience than candidate has (e.g. job wants 7yrs, candidate has 2yrs)
- -2 if job title seniority is above candidate level (Lead, Principal, Staff, Architect, Director, VP)
- -2 if job requires tools/technologies the candidate has NO experience with (e.g. Kafka, Kubernetes, Docker, AWS if not on resume)
- -2 if job requires on-site or specific city relocation and candidate prefers remote
- -1 if job is in a country that typically requires visa/work permit and candidate is in Nigeria
- -1 for each major missing requirement (max -3)

HARD RULES:
- Score CANNOT be above 7 if candidate is missing 2 or more critical requirements
- Score CANNOT be above 5 if candidate is missing 3 or more critical requirements  
- Score CANNOT be above 3 if years of experience gap is more than 4 years
- Score of 9-10 is ONLY for roles where candidate meets 90%+ of requirements
- Do NOT give high scores just because some keywords match — gaps matter MORE than matches

FINAL SCORE BANDS:
- 9-10: Near-perfect fit — candidate meets almost all requirements
- 7-8: Good fit — candidate meets most requirements, minor gaps
- 5-6: Partial fit — candidate meets some requirements, notable gaps
- 3-4: Poor fit — significant gaps in experience or skills
- 0-2: Hard pass — major mismatch in experience, seniority, or location

STEP 4 — SHOW YOUR WORK:
Before giving the final score, think through:
1. Which exact skills from candidate profile appear in the job? List them.
2. What critical requirements does the candidate LACK? List them.
3. What is the experience gap (candidate years vs job requirement)?
4. Apply additions and deductions mathematically.
5. Apply hard rules if triggered.

For the reason field: write 2-3 sentences like a brutally honest senior recruiter. Mention specific skill matches AND specific gaps. Never write generic phrases. Be specific about what the candidate is missing.

Return ONLY this JSON:
{"is_real_job":true,"company":"Name","role":"Title","location":"Remote","score":6.5,"reason":"2-3 brutally honest sentences about match quality and specific gaps."}`,
          },
        ],
      }),
    });

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "{}";
    try {
      return JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      return match ? JSON.parse(match[0]) : null;
    }
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
  } catch (err) {
    console.error("[notify] error:", err);
  }
}

// ─── Main Scout ───────────────────────────────────────────────────────────────
async function scoutForUser(userId: string) {
  const { data: profile } = await supabase
    .from("profiles").select("*").eq("user_id", userId).single();
  if (!profile) {
    console.error(`No profile: ${userId}`);
    return { jobs_found: 0, jobs_inserted: 0, jobs_skipped: 0 };
  }

  const { data: seeds } = await supabase
    .from("search_seeds").select("query").eq("user_id", userId);
  if (!seeds || seeds.length === 0) {
    console.log(`No seeds: ${userId}`);
    return { jobs_found: 0, jobs_inserted: 0, jobs_skipped: 0 };
  }

  console.log(`[scout] ${seeds.length} seeds for user ${userId}`);
  console.log(`[scout] work_preference=${profile.work_preference} years_experience=${profile.years_experience}`);

  // Search all seeds in parallel via Exa
  const allResultsNested = await Promise.all(seeds.map((s) => exaSearch(s.query)));
  const allResults = allResultsNested.flat();
  console.log(`[scout] ${allResults.length} raw results from Exa`);

  // Dedup + block domains
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

  // Process in batches of 3
  for (let i = 0; i < candidates.length; i += 3) {
    const batch = candidates.slice(i, i + 3);
    await Promise.all(batch.map(async (result) => {
      const rawUrl = result.url;
      const normalizedUrl = normalizeUrl(rawUrl);

      // Skip duplicate in DB
      const { data: existing } = await supabase
        .from("jobs").select("id")
        .eq("user_id", userId)
        .eq("job_url_normalized", normalizedUrl)
        .maybeSingle();
      if (existing) { totalSkipped++; return; }

      // Use Exa content, fallback to Scrape.do if too short
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

      // ── PRE-FILTER: check before calling GPT (saves API costs) ──
      const { skip, reason } = shouldSkipEarly(result.title, content, profile);
      if (skip) {
        console.log(`[scout] PRE-FILTER SKIP ${reason}`);
        totalSkipped++;
        return;
      }

      // One-shot analyze + score
      const analysis = await analyzeJob(content, result.title, rawUrl, profile);
      if (!analysis) { totalSkipped++; return; }

      if (!analysis.is_real_job) {
        console.log(`[scout] SKIP not_a_job: ${result.title.slice(0, 50)}`);
        totalSkipped++;
        return;
      }

      if (analysis.score < 7) {
        console.log(`[scout] SKIP score=${analysis.score}: ${analysis.company}`);
        totalSkipped++;
        return;
      }

      // Skip rejected company
      const { data: rejected } = await supabase
        .from("jobs").select("id")
        .eq("user_id", userId)
        .eq("company", analysis.company)
        .eq("status", "rejected")
        .maybeSingle();
      if (rejected) { totalSkipped++; return; }

      // Insert
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
          score: analysis.score,
          score_reason: analysis.reason,
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