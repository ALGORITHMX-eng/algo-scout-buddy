import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Platform knowledge base ──────────────────────────────────────────────────
// GPT picks from these based on the candidate's profile
const PLATFORM_CONTEXT = `
AVAILABLE JOB PLATFORMS (choose the most relevant ones for this candidate):

ATS Platforms (individual job pages, best for quality):
- greenhouse.io — used by funded AI startups, ML companies, most top tech firms
- lever.co — popular with Scale AI, Cohere, AI infrastructure companies  
- ashbyhq.com — fast growing AI startups, early stage companies
- workable.com — mid-size global tech companies
- breezy.hr — mid-size companies globally
- recruitee.com — European tech startups

Remote Job Boards (good for remote-first roles):
- himalayas.app — remote only, very clean job pages, Nigeria-friendly
- remotive.com — remote focused, good individual job pages
- jobgether.com — global remote, good for international candidates
- weworkremotely.com — remote engineering roles

Startup Focused:
- workatastartup.com/companies — YC companies, early stage AI startups
- wellfound.com/role — individual job pages only (not search pages)

AI/ML Specific:
- huggingface.co/jobs — AI research and engineering roles
- mlops.community/jobs — MLOps and AI engineering

IMPORTANT: Only pick platforms that make sense for the candidate's role and experience level.
For junior/mid candidates: prefer himalayas, remotive, ashbyhq, workatastartup
For senior candidates: prefer greenhouse, lever, wellfound individual roles
For AI/ML specific: always include huggingface or mlops.community in at least one query
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { user_id } = await req.json();

    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .or(`user_id.eq.${user_id},id.eq.${user_id}`)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const skills = profile.skills?.join(", ") || "Not specified";
    const titles = profile.preferred_titles?.join(", ") || "Software Engineer";
    const workPref = profile.work_preference || "remote";
    const yearsExp = profile.years_experience || 0;
    const location = profile.location || "";
    const summary = profile.experience_summary || "";

    // Determine seniority label for prompt context
    let seniorityLabel = "junior to mid-level";
    if (yearsExp >= 6) seniorityLabel = "senior to principal level";
    else if (yearsExp >= 3) seniorityLabel = "mid to senior level";

    // Determine work preference context
    const workPrefList = workPref.split(",").map((p: string) => p.trim());
    const isRemoteOnly = workPrefList.includes("remote") && workPrefList.length === 1;
    const acceptsHybrid = workPrefList.includes("hybrid");
    const acceptsOnsite = workPrefList.includes("on-site");

    const workContext = isRemoteOnly
      ? "remote only — never include on-site or city-specific roles"
      : acceptsHybrid && location
      ? `prefers remote but open to hybrid in ${location}`
      : `open to remote, hybrid, and on-site in ${location}`;

    const res = await fetch("https://models.inference.ai.azure.com/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 800,
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are a job search strategist. Your job is to generate highly targeted search queries that will find INDIVIDUAL job posting pages — not listing pages or search result pages. Return only valid JSON, no markdown.`,
          },
          {
            role: "user",
            content: `Generate 10 search queries for this candidate that will find individual job postings.

CANDIDATE PROFILE:
Target Roles: ${titles}
Key Skills: ${skills}
Years of Experience: ${yearsExp} (${seniorityLabel})
Work Preference: ${workContext}
Career Summary: ${summary}

${PLATFORM_CONTEXT}

QUERY STRATEGY:
1. Each query must target a SPECIFIC platform from the list above
2. Each query must reflect the candidate's ACTUAL skills and roles — not generic terms
3. Vary the platforms across queries — do not repeat the same platform more than twice
4. For remote-only candidates, every query must include "remote" 
5. For hybrid/onsite candidates, mix remote queries with location-specific ones using "${location}"
6. Match platform choice to seniority:
   - ${seniorityLabel} candidate rules:
   ${yearsExp < 3 
     ? "- Prefer: himalayas.app, remotive.com, ashbyhq.com, workatastartup.com — avoid senior-heavy boards like lever.co for big companies"
     : yearsExp < 5
     ? "- Prefer: ashbyhq.com, greenhouse.io, workatastartup.com, himalayas.app — mix startup and mid-size companies"
     : "- Prefer: greenhouse.io, lever.co, ashbyhq.com, wellfound.com individual roles — target funded and growth stage companies"
   }
7. Include hiring signals: "hiring", "job opening", "apply", "join our team", "we are looking for"
8. Queries should be natural language — how a recruiter would write a job post title
9. Target individual job pages: use platform subdirectories like "lever.co/jobs", "greenhouse.io/jobs", "workatastartup.com/companies"
10. NEVER use site: operator — write natural queries

Generate exactly 10 queries. Make each one unique in angle:
- 2 queries by specific skill stack
- 2 queries by role title variation  
- 2 queries by company type (startup, AI company, SaaS, etc)
- 2 queries by platform (ATS platforms)
- 2 queries by niche (AI-specific boards or remote boards)

Return ONLY this JSON:
{"queries": ["query1", "query2", "query3", "query4", "query5", "query6", "query7", "query8", "query9", "query10"]}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("GPT-4o API error:", errText);
      return new Response(JSON.stringify({ error: "GPT-4o API failed", detail: errText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "{}";

    let queries: string[] = [];
    try {
      const parsed = JSON.parse(text);
      queries = parsed.queries || [];
    } catch {
      const match = text.match(/\[[\s\S]*\]/);
      queries = match ? JSON.parse(match[0]) : [];
    }

    if (queries.length === 0) {
      return new Response(JSON.stringify({ error: "Failed to generate seeds" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Delete old seeds then insert new ones
    await supabase.from("search_seeds").delete().eq("user_id", user_id);

    const { error: insertError } = await supabase.from("search_seeds").insert(
      queries.map((query: string) => ({ user_id, query, source: "generated" }))
    );

    if (insertError) {
      console.error("Seeds insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to save seeds", detail: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[generate-seeds] Generated ${queries.length} seeds for user ${user_id}`);
    console.log("[generate-seeds] Seeds:", queries);

    return new Response(
      JSON.stringify({ success: true, seeds: queries }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    console.error("generate-seeds error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});