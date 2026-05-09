import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY")!;
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SCOUT_SECRET = Deno.env.get("SCOUT_SECRET")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-scout-secret",
};

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.search = "";
    return u.toString().toLowerCase().replace(/\/$/, "");
  } catch {
    return url.toLowerCase().trim();
  }
}

function parseTitle(title: string, url: string): { company: string; role: string } {
  let role = title;
  let company = "Unknown";

  const atMatch = title.match(/^(.+?)\s+at\s+(.+?)(\s*[\|\-\–]|$)/i);
  if (atMatch) {
    role = atMatch[1].trim();
    company = atMatch[2].trim();
  } else {
    const dashMatch = title.match(/^(.+?)\s*[-–]\s*(.+)$/);
    if (dashMatch) {
      company = dashMatch[1].trim();
      role = dashMatch[2].trim();
    } else {
      try {
        const domain = new URL(url).hostname.replace("www.", "").split(".")[0];
        company = domain.charAt(0).toUpperCase() + domain.slice(1);
      } catch {}
    }
  }

  role = role.replace(/\[hiring\]/gi, "").replace(/^\s*[\|\-\–]\s*/, "").trim();
  company = company.replace(/\[hiring\]/gi, "").trim();
  return { company, role };
}

async function searchJobs(query: string): Promise<any[]> {
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({
        query,
        limit: 8,
        scrapeOptions: { formats: ["markdown"] },
      }),
    });
    const data = await res.json();
    return data.data || [];
  } catch (err) {
    console.error("Firecrawl error:", err);
    return [];
  }
}

async function scoreJob(
  jobText: string,
  company: string,
  role: string,
  profile: any
): Promise<{ score: number; reason: string }> {
  try {
    const skills = profile.skills?.join(", ") || "Not specified";
    const titles = profile.preferred_titles?.join(", ") || "Not specified";

    const res = await fetch("https://models.inference.ai.azure.com/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 200,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You are ALGOscout, an AI job scoring engine. Return only valid JSON, no markdown.",
          },
          {
            role: "user",
            content: `CANDIDATE PROFILE:
Name: ${profile.full_name}
Location: ${profile.location} — ${profile.work_preference || "remote"} only
Years of Experience: ${profile.years_experience || "Not specified"}
Skills: ${skills}
Target Roles: ${titles}
Experience Summary: ${profile.experience_summary || "Not provided"}

SCORING RULES:
- Score 9-10: Perfect match — role title matches exactly + 3+ skills match + remote
- Score 7-8: Good match — most skills align + remote
- Score 5-6: Partial match — some skills overlap
- Score 1-4: Poor fit — few skills match
- Score 0: Hard pass — on-site only, outsourcing farm, completely unrelated field

SCORING LOGIC:
1. Hard Pass → Score 0 if on-site only or outsourcing farm
2. Base score = 4
3. +2 per skill match (max 5 matches)
4. +1 per bonus: AI startup, high-growth, emerging market, LLM infra
5. Cap at 10

JOB:
Company: ${company}
Role: ${role}
Description: ${jobText.slice(0, 2000)}

Respond ONLY in this JSON format:
{"score": 8.5, "reason": "Strong match because..."}`,
          },
        ],
      }),
    });

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '{"score": 0, "reason": "Failed"}';
    try {
      return JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      return match ? JSON.parse(match[0]) : { score: 0, reason: "Parse error" };
    }
  } catch {
    return { score: 0, reason: "Scoring failed" };
  }
}

// FIX 1: added Authorization header
async function notifyUser(userId: string, job: any) {
  try {
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", userId);

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
    console.error("Notify error:", err);
  }
}

async function scoutForUser(userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!profile) {
    console.error(`Profile not found for user ${userId}`);
    return { jobs_found: 0, jobs_inserted: 0, jobs_skipped: 0 };
  }

  const { data: seeds } = await supabase
    .from("search_seeds")
    .select("query")
    .eq("user_id", userId);

  if (!seeds || seeds.length === 0) {
    console.log(`No search seeds for user ${userId}`);
    return { jobs_found: 0, jobs_inserted: 0, jobs_skipped: 0 };
  }

  const seedIndex = Math.floor(Date.now() / (30 * 60 * 1000)) % seeds.length;
  const query = seeds[seedIndex].query;

  console.log(`[scout] User ${userId} → query: ${query}`);

  const results = await searchJobs(query);
  let jobsFound = results.length;
  let jobsInserted = 0;
  let jobsSkipped = 0;

  for (const result of results) {
    const rawUrl = result.url || result.sourceURL || "";
    const normalizedUrl = normalizeUrl(rawUrl);
    const rawText = result.markdown || result.content || "";
    const title = result.title || result.metadata?.title || "";

    const { company, role } = parseTitle(title, rawUrl);

    const { data: existing } = await supabase
      .from("jobs")
      .select("id")
      .eq("user_id", userId)
      .eq("job_url_normalized", normalizedUrl)
      .maybeSingle();

    if (existing) { jobsSkipped++; continue; }
    if (!rawText || rawText.length < 100) { jobsSkipped++; continue; }

    const { data: rejected } = await supabase
      .from("jobs")
      .select("id")
      .eq("user_id", userId)
      .eq("company", company)
      .eq("status", "rejected")
      .maybeSingle();

    if (rejected) { jobsSkipped++; continue; }

    const { score, reason } = await scoreJob(rawText, company, role, profile);

    if (score < 7) { jobsSkipped++; continue; }

    const { data: newJob } = await supabase
      .from("jobs")
      .insert({
        user_id: userId,
        job_url: rawUrl,
        job_url_normalized: normalizedUrl,
        company,
        role,
        raw_text: rawText,
        score,
        score_reason: reason,
        status: "pending",
        found_at: new Date().toISOString(),
      })
      .select()
      .single();

    jobsInserted++;

    if (score >= 8 && newJob) {
      await notifyUser(userId, newJob);
    }
  }

  // FIX 2: added user_id to scout_runs insert
  await supabase.from("scout_runs").insert({
    user_id: userId,
    jobs_found: jobsFound,
    jobs_inserted: jobsInserted,
    jobs_skipped_duplicate: jobsSkipped,
    error: null,
  });

  return { jobs_found: jobsFound, jobs_inserted: jobsInserted, jobs_skipped: jobsSkipped };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const secret = req.headers.get("x-scout-secret");
  if (secret !== SCOUT_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const userId = body.user_id;

    if (!userId) {
      return new Response(JSON.stringify({ error: "user_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await scoutForUser(userId);

    await supabase
      .from("profiles")
      .update({ last_scouted_at: new Date().toISOString() })
      .eq("user_id", userId);

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});