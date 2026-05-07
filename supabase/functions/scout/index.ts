import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY")!;
const GROK_FAST_API_KEY = Deno.env.get("GROK_FAST_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SCOUT_SECRET = Deno.env.get("SCOUT_SECRET")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-scout-secret",
};

// --- URL normalizer ---
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.search = "";
    return u.toString().toLowerCase().replace(/\/$/, "");
  } catch {
    return url.toLowerCase().trim();
  }
}

// --- Parse title into company + role ---
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

// --- Firecrawl search ---
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

// --- Grok scoring per user profile ---
async function scoreJob(
  jobText: string,
  company: string,
  role: string,
  profile: any
): Promise<{ score: number; reason: string }> {
  try {
    const skills = profile.skills?.join(", ") || "Not specified";
    const titles = profile.preferred_titles?.join(", ") || "Not specified";

    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROK_FAST_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-4-flash",
        max_tokens: 200,
        temperature: 0.1,
        messages: [
          {
            role: "user",
            content: `You are ALGOscout, an AI job scoring engine.

CANDIDATE PROFILE:
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

Respond ONLY in this JSON format, no markdown:
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

// --- Send push notification ---
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
        "x-scout-secret": SCOUT_SECRET,
      },
      body: JSON.stringify({ record: job }),
    });
  } catch (err) {
    console.error("Notify error:", err);
  }
}

// --- Main scout function for one user ---
async function scoutForUser(userId: string) {
  // 1. Fetch user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (!profile) {
    console.error(`Profile not found for user ${userId}`);
    return { jobs_found: 0, jobs_inserted: 0, jobs_skipped: 0 };
  }

  // 2. Fetch user's search seeds
  const { data: seeds } = await supabase
    .from("search_seeds")
    .select("query")
    .eq("user_id", userId);

  if (!seeds || seeds.length === 0) {
    console.log(`No search seeds for user ${userId}`);
    return { jobs_found: 0, jobs_inserted: 0, jobs_skipped: 0 };
  }

  // 3. Pick one seed per run (rotate)
  const seedIndex = Math.floor(Date.now() / (30 * 60 * 1000)) % seeds.length;
  const query = seeds[seedIndex].query;

  console.log(`[scout] User ${userId} → query: ${query}`);

  // 4. Search with Firecrawl
  const results = await searchJobs(query);
  let jobsFound = results.length;
  let jobsInserted = 0;
  let jobsSkipped = 0;

  // 5. Process each result
  for (const result of results) {
    const rawUrl = result.url || result.sourceURL || "";
    const normalizedUrl = normalizeUrl(rawUrl);
    const rawText = result.markdown || result.content || "";
    const title = result.title || result.metadata?.title || "";

    const { company, role } = parseTitle(title, rawUrl);

    // Pre-filter 1: Already seen by this user?
    const { data: existing } = await supabase
      .from("jobs")
      .select("id")
      .eq("user_id", userId)
      .eq("job_url_normalized", normalizedUrl)
      .maybeSingle();

    if (existing) {
      jobsSkipped++;
      continue;
    }

    // Pre-filter 2: Skip if no meaningful content
    if (!rawText || rawText.length < 100) {
      jobsSkipped++;
      continue;
    }

    // Pre-filter 3: User already rejected this company?
    const { data: rejected } = await supabase
      .from("jobs")
      .select("id")
      .eq("user_id", userId)
      .eq("company", company)
      .eq("status", "rejected")
      .maybeSingle();

    if (rejected) {
      jobsSkipped++;
      continue;
    }

    // 6. Score with Grok using THIS user's profile
    const { score, reason } = await scoreJob(rawText, company, role, profile);

    // 7. Skip if score below 7
    if (score < 7) {
      jobsSkipped++;
      continue;
    }

    // 8. Insert job for this user
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

    // 9. Notify if score 8+
    if (score >= 8 && newJob) {
      await notifyUser(userId, newJob);
    }
  }

  // 10. Log scout run
  await supabase.from("scout_runs").insert({
    jobs_found: jobsFound,
    jobs_inserted: jobsInserted,
    jobs_skipped_duplicate: jobsSkipped,
    error: null,
  });

  return { jobs_found: jobsFound, jobs_inserted: jobsInserted, jobs_skipped: jobsSkipped };
}

// --- Main handler ---
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

    // Update last_scouted_at
    await supabase
      .from("profiles")
      .update({ last_scouted_at: new Date().toISOString() })
      .eq("id", userId);

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