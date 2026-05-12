import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN")!;
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

    const skills = profile.skills?.join(", ") || "";
    const titles = profile.preferred_titles?.join(", ") || "";
    const location = profile.location || "";
    const experience = profile.experience_summary || "";
    const workPref = profile.work_preference || "remote";

    const res = await fetch("https://models.inference.ai.azure.com/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 500,
        temperature: 0.8,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You are a job search expert. Return only valid JSON, no markdown.",
          },
          {
            role: "user",
            content: `Generate 8 highly targeted job search queries for this candidate.

CANDIDATE:
Name: ${profile.full_name}
Target Roles: ${titles}
Skills: ${skills}
Experience: ${experience}
Location: ${location}
Work Preference: ${workPref}

RULES:
- Write natural Google search queries like a recruiter would search
- Include job board names naturally in the query: "wellfound", "remotive", "workatastartup", "greenhouse", "lever"
- Include hiring signals in queries: "hiring", "job opening", "we are looking for", "join our team"
- Include "remote" in most queries
- Do NOT use site: operator
- Mix different angles: some by skill, some by role title, some by company type (startup, AI company, SaaS)
- Vary the queries so they find different jobs across different boards
- Example good query: "remote AI Engineer LangChain RAG startup hiring 2026 wellfound"
- Example good query: "agentic AI systems architect remote job opening greenhouse"

Return ONLY this JSON structure:
{"queries": ["query 1", "query 2", "query 3", "query 4", "query 5", "query 6", "query 7", "query 8"]}`,
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
});const { data: profile, error: profileError } = await supabase