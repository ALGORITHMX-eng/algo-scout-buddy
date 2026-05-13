import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SCOUT_SECRET = Deno.env.get("SCOUT_SECRET")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET")!;
const EXA_API_KEY = Deno.env.get("EXA_API_KEY")!;
const SCRAPEDO_API_KEY = Deno.env.get("SCRAPEDO_API_KEY")!;
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret, x-scout-secret",
};

const BLOCKED_DOMAINS = [
  "linkedin.com", "reddit.com", "youtube.com", "quora.com",
  "medium.com", "substack.com", "twitter.com",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.search = "";
    return u.toString().toLowerCase().replace(/\/$/, "");
  } catch {
    return url.toLowerCase().trim();
  }
}

function intervalToMs(interval: string): number {
  if (!interval) return 24 * 60 * 60 * 1000;
  const hours = interval.match(/(\d+)\s*hour/)?.[1];
  const minutes = interval.match(/(\d+)\s*min/)?.[1];
  const hms = interval.match(/^(\d+):(\d+):(\d+)$/);
  if (hms) {
    return (
      parseInt(hms[1]) * 3600000 +
      parseInt(hms[2]) * 60000 +
      parseInt(hms[3]) * 1000
    );
  }
  return (
    (parseInt(hours || "0") * 3600000) +
    (parseInt(minutes || "0") * 60000) ||
    24 * 3600000
  );
}

// ─── Exa Search ───────────────────────────────────────────────────────────────
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
    if (!res.ok) { console.error(`[exa] failed: ${res.status}`); return []; }
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

// ─── Generate Seeds ───────────────────────────────────────────────────────────
async function generateSeeds(userId: string, profile: any): Promise<string[]> {
  // First try fetching existing seeds from DB
  const { data: existing } = await supabase
    .from("search_seeds")
    .select("query")
    .eq("user_id", userId);

  if (existing && existing.length > 0) {
    console.log(`[seeds] using ${existing.length} existing seeds`);
    return existing.map((s: any) => s.query);
  }

  // Generate new seeds via AI
  const skills = profile.skills?.join(", ") || "";
  const titles = profile.preferred_titles?.join(", ") || "";

  try {
    const res = await fetch("https://models.inference.ai.azure.com/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 500,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Return only valid JSON, no markdown." },
          {
            role: "user",
            content: `Generate 8 job search queries for this candidate.

Skills: ${skills}
Target Roles: ${titles}
Work Preference: ${profile.work_preference || "remote"}

Return: {"queries": ["query1", "query2", ...]}
Each query should be specific, include "job" or "hiring", and target real job boards.`,
          },
        ],
      }),
    });
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(text);
    const queries: string[] = parsed.queries || [];

    // Save to DB for next time
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
            content: "You are ALGOscout, an elite AI job matching engine. Return only valid JSON, no markdown. Be strict and honest in scoring — never inflate scores.",
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
Is this a real job posting? Set is_real_job=false if it is a tweet, blog post, developer profile, newsletter, or any content that is not actively hiring.

STEP 2 — EXTRACT:
Pull out company name, exact job title, location, and a clean 2-3 paragraph job description.

STEP 3 — SCORE using this exact formula, no exceptions:

SKILLS MATCH (max 4 points):
Candidate skills: ${skills}
Count how many of the job REQUIRED skills appear in candidate skill list.
+4 = 80%+ matched
+3 = 60–79% matched
+2 = 40–59% matched
+1 = 20–39% matched
+0 = less than 20% matched

ROLE MATCH (max 2 points):
Candidate target roles: ${titles}
+2 = job title identical or very close to target roles
+1 = related but not direct match
+0 = unrelated

EXPERIENCE LEVEL (max 2 points):
Candidate years: ${yearsExp}
+2 = required years within ±1 year of candidate
+1 = over or under by 2–3 years
+0 = mismatch more than 3 years

LOCATION / REMOTE (max 1 point):
Candidate preference: ${workPref}
+1 = matches exactly
+0 = mismatch

COMPANY SIGNAL (max 1 point):
+1 = funded, well-known, recognizable company
+0 = unknown or unclear

FINAL SCORE = sum of all 5 sections (max 10).
9–10 = extremely rare. Most jobs should score 5–7. Never inflate.

Return ONLY this JSON:
{
  "is_real_job": true,
  "company": "Company Name",
  "role": "Exact Job Title",
  "location": "Remote or City",
  "description": "Clean 2-3 paragraph job description",
  "score": 7,
  "reason": "2-3 specific sentences about why this matches or doesn't"
}`,
          },
        ],
      }),
    });

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "{}";
    try { return JSON.parse(text); }
    catch {
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

// ─── Scout For One User ───────────────────────────────────────────────────────
async function scoutForUser(userId: string) {
  console.log(`[scout] starting for user ${userId}`);

  const { data: profile } = await supabase
    .from("profiles").select("*").eq("user_id", userId).single();
  if (!profile) {
    console.error(`[scout] no profile for ${userId}`);
    return { jobs_found: 0, jobs_inserted: 0, jobs_skipped: 0 };
  }

  // Get or generate seeds
  const seeds = await generateSeeds(userId, profile);
  if (seeds.length === 0) {
    console.log(`[scout] no seeds for ${userId}`);
    return { jobs_found: 0, jobs_inserted: 0, jobs_skipped: 0 };
  }

  console.log(`[scout] ${seeds.length} seeds`);

  // Search all seeds in parallel
  const allResultsNested = await Promise.all(seeds.map((q) => exaSearch(q)));
  const allResults = allResultsNested.flat();
  console.log(`[scout] ${allResults.length} raw results`);

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

  console.log(`[scout] ${candidates.length} unique candidates`);

  let totalInserted = 0;
  let totalSkipped = 0;

  // Process in batches of 3
  for (let i = 0; i < candidates.length; i += 3) {
    const batch = candidates.slice(i, i + 3);
    await Promise.all(batch.map(async (result) => {
      const rawUrl = result.url;
      const normalizedUrl = normalizeUrl(rawUrl);

      // Skip if already in DB
      const { data: existing } = await supabase
        .from("jobs").select("id")
        .eq("user_id", userId)
        .eq("job_url_normalized", normalizedUrl)
        .maybeSingle();
      if (existing) { totalSkipped++; return; }

      // Get content
      let content = result.content;
      if (!content || content.length < 200) {
        content = await scrapeDoExtract(rawUrl);
      }
      if (!content || content.length < 100) {
        totalSkipped++;
        return;
      }

      // Analyze + score
      const analysis = await analyzeJob(content, result.title, rawUrl, profile);
      if (!analysis || !analysis.is_real_job) { totalSkipped++; return; }

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

  // Update user_schedules
  await supabase
    .from("user_schedules")
    .update({ last_scouted_at: new Date().toISOString() })
    .eq("user_id", userId);

  // Update profile
  await supabase.from("profiles")
    .update({ last_scouted_at: new Date().toISOString() })
    .eq("user_id", userId);

  console.log(`[scout] DONE inserted=${totalInserted} skipped=${totalSkipped}`);
  return { jobs_found: allResults.length, jobs_inserted: totalInserted, jobs_skipped: totalSkipped };
}

// ─── Scheduler: run all due users ────────────────────────────────────────────
async function runScheduler() {
  const { data: dueUsers, error } = await supabase
    .from("user_schedules")
    .select("user_id, scan_interval")
    .eq("status", "active")
    .lte("next_run_time", new Date().toISOString())
    .limit(50);

  if (error) throw new Error(`Failed to fetch due users: ${error.message}`);
  if (!dueUsers || dueUsers.length === 0) {
    console.log("[scheduler] No users due.");
    return { ran: 0 };
  }

  console.log(`[scheduler] ${dueUsers.length} users due`);

  const results = await Promise.allSettled(
    dueUsers.map(async ({ user_id, scan_interval }) => {
      try {
        const result = await scoutForUser(user_id);

        // Update next_run_time
        await supabase
          .from("user_schedules")
          .update({
            last_scouted_at: new Date().toISOString(),
            next_run_time: new Date(
              Date.now() + intervalToMs(scan_interval)
            ).toISOString(),
          })
          .eq("user_id", user_id);

        console.log(`[scheduler] ✓ Done for ${user_id}`, result);
        return result;
      } catch (err) {
        console.error(`[scheduler] ✗ Failed for ${user_id}:`, err);
      }
    })
  );

  return { ran: dueUsers.length, results };
}

// ─── Handler ──────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const body = await req.json().catch(() => ({}));
  const cronSecret = req.headers.get("x-cron-secret");

  // ── Path 1: GitHub Actions cron ──
  if (cronSecret === CRON_SECRET) {
    try {
      console.log("[scheduler] cron triggered");
      const result = await runScheduler();
      return new Response(
        JSON.stringify({ success: true, ...result }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (err: any) {
      console.error("[scheduler] error:", err);
      return new Response(
        JSON.stringify({ success: false, error: err.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  // ── Path 2: manual user trigger from dashboard ──
  const authHeader = req.headers.get("Authorization") || "";
  let userId = body.user_id;

  if (!userId && authHeader) {
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    userId = user?.id;
  }

  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Manual trigger — run in background so UI stays snappy
  // @ts-ignore
  EdgeRuntime.waitUntil(scoutForUser(userId).catch(console.error));
  return new Response(
    JSON.stringify({ success: true, message: "Scout started in background" }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});