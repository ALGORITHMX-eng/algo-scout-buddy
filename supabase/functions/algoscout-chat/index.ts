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

// ─── Step 1: Exa Search ───────────────────────────────────────────────────────
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
        contents: { text: { maxCharacters: 3000 } },
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

// ─── Step 3: Analyze + Score ──────────────────────────────────────────────────
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
} | null> {
  const skills = profile.skills?.join(", ") || "Not specified";
  const titles = profile.preferred_titles?.join(", ") || "Not specified";
  const yearsExp = profile.years_experience || 0;
  const workPref = profile.work_preference || "remote";

  try {
    const res = await fetch("https://models.inference.ai.azure.com/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 1000,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are ALGOscout, an elite AI job matching engine. Return only valid JSON, no markdown. Be strict and honest — never inflate scores.`,
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
Is this a real job posting? Set is_real_job=false if it is a tweet, blog post, developer profile, newsletter, article, or any content that is not a real job posting actively hiring.

STEP 2 — EXTRACT:
Pull out company name, exact job title, location, and a clean 2-3 paragraph job description from the content.

STEP 3 — SCORE using this exact formula, no exceptions:

SKILLS MATCH (max 4 points):
Candidate skills: ${skills}
Count how many of the job's REQUIRED skills appear in the candidate's skill list.
+4 = 80%+ of required skills matched
+3 = 60–79% matched
+2 = 40–59% matched
+1 = 20–39% matched
+0 = less than 20% matched

ROLE MATCH (max 2 points):
Candidate target roles: ${titles}
+2 = job title is identical or very close to one of the target roles
+1 = job title is related but not a direct match
+0 = job title is unrelated to all target roles

EXPERIENCE LEVEL (max 2 points):
Candidate years of experience: ${yearsExp}
Extract the required years from the job description.
+2 = required years within ±1 year of candidate experience
+1 = candidate is over or under by 2–3 years
+0 = mismatch of more than 3 years or no experience requirement found

LOCATION / REMOTE (max 1 point):
Candidate work preference: ${workPref}
+1 = job location/remote policy matches candidate preference exactly
+0 = mismatch

COMPANY SIGNAL (max 1 point):
+1 = company is funded, well-known, or recognizable in the industry
+0 = unknown, unclear, or no company info found

FINAL SCORE = sum of all 5 sections (max 10).
Be strict. 9–10 = extremely rare, only perfect match on everything.
Most jobs should score 5–7. Never inflate. Never round up.

For the reason field: write 2-3 sentences like a senior recruiter. Be specific — mention actual technologies from the job, company type, and standout positives or red flags. No generic phrases.

Return ONLY this JSON:
{
  "is_real_job": true,
  "company": "Company Name",
  "role": "Exact Job Title",
  "location": "Remote or City, Country",
  "description": "Clean 2-3 paragraph job description extracted from the content",
  "score": 7,
  "reason": "2-3 specific sentences about why this matches or doesn't"
}`,
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

      // Analyze + score
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

      // Insert — now includes description
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
          score: Math.min(10, Math.max(0, Math.round(analysis.score))),
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

  // Update scout run log
  await supabase.from("scout_runs").insert({
    user_id: userId,
    jobs_found: allResults.length,
    jobs_inserted: totalInserted,
    jobs_skipped_duplicate: totalSkipped,
    error: null,
  });

  // Update last_scouted_at on profile
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

    // AWAIT directly — no waitUntil — pipeline runs fully before response
    const result = await scoutForUser(userId);

    return new Response(
      JSON.stringify({ success: true, ...result }),
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