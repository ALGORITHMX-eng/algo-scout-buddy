import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GROK_FAST_API_KEY = Deno.env.get("GROK_FAST_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Fetch user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user_id)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const skills = profile.skills?.join(", ") || "";
    const titles = profile.preferred_titles?.join(", ") || "";
    const location = profile.location || "";
    const experience = profile.experience_summary || "";
    const workPref = profile.work_preference || "remote";

    // Generate seeds with Grok
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROK_FAST_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-4-flash",
        max_tokens: 500,
        temperature: 0.8,
        messages: [
          {
            role: "user",
            content: `You are a job search expert. Generate 8 highly targeted job search queries for this candidate.

CANDIDATE:
Name: ${profile.full_name}
Target Roles: ${titles}
Skills: ${skills}
Experience: ${experience}
Location: ${location}
Work Preference: ${workPref}

RULES:
- Each query should target different job boards and sources
- Mix these sources: site:wellfound.com, site:remotive.com, site:workatastartup.com, site:x.com, site:linkedin.com/jobs
- Make queries specific to their skills and roles
- Include "remote" in most queries
- Vary the queries so they find different jobs
- Think about what companies hiring for their skills would post

Return ONLY a JSON array of 8 strings, no markdown:
["query 1", "query 2", "query 3", "query 4", "query 5", "query 6", "query 7", "query 8"]`,
          },
        ],
      }),
    });

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "[]";

    let queries: string[] = [];
    try {
      queries = JSON.parse(text);
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

    // Delete old seeds for this user
    await supabase
      .from("search_seeds")
      .delete()
      .eq("user_id", user_id);

    // Insert new seeds
    const seedRows = queries.map((query: string) => ({
      user_id,
      query,
      source: "generated",
    }));

    await supabase.from("search_seeds").insert(seedRows);

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