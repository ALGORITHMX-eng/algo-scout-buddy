import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const JINA_API_KEY = Deno.env.get("JINA_API_KEY")!;
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

// ─── Step 1: Jina Search ──────────────────────────────────────────────────────
async function jinaSearch(query: string): Promise<Array<{ url: string; title: string; content: string }>> {
  try {
    const res = await fetch(`https://s.jina.ai/?q=${encodeURIComponent(query)}`, {
      headers: {
        "Accept": "application/json",
        "X-Return-Format": "markdown",
        "Authorization": `Bearer ${JINA_API_KEY}`,
      },
    });
    if (!res.ok) {
      console.error(`[jina-search] failed: ${res.status}`);
      return [];
    }
    const data = await res.json();
    return (data.data || []).map((r: any) => ({
      url: r.url || "",
      title: r.title || "",
      content: (r.content || r.description || "").slice(0, 3000),
    }));
  } catch (err) {
    console.error("[jina-search] error:", err);
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

// ─── Step 3: One-Shot Analyze + Score ────────────────────────────────────────
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
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are ALGOscout, an elite AI job matching engine. Return only valid JSON, no markdown.
When writing the reason field, write like a senior technical recruiter explaining the match — be specific, reference actual technologies and company details from the job content, not generic phrases.`,
          },
          {
            role: "user",
            content: `CANDIDATE PROFILE:
Name: ${profile.full_name}
Skills: ${profile.skills?.join(", ") || "Not specified"}
Target Roles: ${profile.preferred_titles?.join(", ") || "Not specified"}
Location: ${profile.location}
Work Preference: ${profile.work_preference || "remote"}
Experience: ${profile.years_experience} years
Summary: ${profile.experience_summary || "Not provided"}

JOB CONTENT:
Title: ${title}
URL: ${url}
Content: ${content.slice(0, 2000)}

STEP 1 — REALITY CHECK:
Is this a real job posting? Set is_real_job=false if it is a tweet, blog post, developer profile, newsletter, article, or any content that is not actively hiring.

STEP 2 — EXTRACT:
Pull out company name, exact job title, and location from the content.

STEP 3 — SCORE using this exact logic:
- Hard Pass → score=0 if: on-site only, outsourcing farm, completely unrelated field
- Base score = 4
- +2 for each skill match from candidate profile (max 5 skills = max +10, cap at 10)
- +1 bonus if: AI startup, high-growth company, emerging market focus, LLM infrastructure
- Final score capped at 10

Score bands:
- 9-10: Perfect — role matches exactly + 3 or more skills + remote
- 7-8: Good — most skills align + remote friendly
- 5-6: Partial — some skill overlap
- 1-4: Poor — few skills match
- 0: Hard pass — on-site only, outsourcing farm, or unrelated field

Think step by step:
1. List which exact skills from the candidate profile appear in the job content
2. Count them
3. Calculate: base(4) + skill_count x 2 + bonuses
4. Output final JSON

IMPORTANT: Calculate score mathematically. Do not round to a clean number. Each job gets a unique score based on actual skill matches counted one by one.

For the reason field: write 2-3 sentences like a senior recruiter. Mention specific technologies from the job that match the candidate, the company type, and any standout positives or red flags. Be specific — do not write generic phrases like "good match" or "relevant experience".

Return ONLY this JSON:
{"is_real_job":true,"company":"Name","role":"Title","location":"Remote","score":7.5,"reason":"2-3 specific sentences about why this matches or doesn't."}`,
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

  // Search all seeds in parallel
  const allResultsNested = await Promise.all(seeds.map((s) => jinaSearch(s.query)));
  const allResults = allResultsNested.flat();
  console.log(`[scout] ${allResults.length} raw results from Jina Search`);

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

      // Use Jina content, fallback to Scrape.do if too short
      let content = result.content;
      if (!content || content.length < 200) {
        console.log(`[scout] Jina short → Scrape.do: ${rawUrl.slice(0, 50)}`);
        content = await scrapeDoExtract(rawUrl);
      }
      if (!content || content.length < 100) {
        console.log(`[scout] SKIP no_content: ${rawUrl.slice(0, 50)}`);
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