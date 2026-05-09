import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN")!;
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY")!;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { job_url, user_id } = await req.json();

    if (!job_url || !user_id) {
      return new Response(JSON.stringify({ error: "job_url and user_id are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch user profile for scoring context
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user_id)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1 — Firecrawl scrape the job URL
    const scrapeRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({
        url: job_url,
        formats: ["markdown"],
      }),
    });

    if (!scrapeRes.ok) {
      const err = await scrapeRes.text();
      console.error("Firecrawl error:", err);
      return new Response(JSON.stringify({ error: "Failed to scrape job URL" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const scrapeData = await scrapeRes.json();
    const rawText = scrapeData.data?.markdown || scrapeData.data?.content || "";

    if (!rawText || rawText.length < 100) {
      return new Response(JSON.stringify({ error: "Could not extract content from job URL" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const skills = profile.skills?.join(", ") || "Not specified";
    const titles = profile.preferred_titles?.join(", ") || "Not specified";

    // Step 2 — GPT-4o extracts + scores + generates docs
    const aiRes = await fetch("https://models.inference.ai.azure.com/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 2000,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You are AlgoScout, an AI job-matching assistant. Return only valid JSON, no markdown.",
          },
          {
            role: "user",
            content: `Extract and analyze this job posting for the candidate below.

CANDIDATE:
Name: ${profile.full_name}
Skills: ${skills}
Target Roles: ${titles}
Experience: ${profile.experience_summary || ""}
Years of Experience: ${profile.years_experience || 0}
Location: ${profile.location || ""}
Work Preference: ${profile.work_preference || "remote"}

JOB PAGE CONTENT:
${rawText.slice(0, 3000)}

Return ONLY this JSON:
{
  "company": "company name",
  "role": "job title",
  "description": "full job description 2-4 paragraphs",
  "location": "location or remote policy",
  "applyUrl": "direct apply URL or empty string",
  "reason": "one sentence why this job fits the candidate",
  "score": 8,
  "resume": "• Tailored bullet 1\\n• Tailored bullet 2\\n• Tailored bullet 3\\n• Tailored bullet 4\\n• Tailored bullet 5",
  "coverLetter": "Tailored cover letter 2-3 short paragraphs addressed to the company",
  "breakdown": {
    "skills": 8,
    "salary": 7,
    "location": 9,
    "culture": 8
  }
}`,
          },
        ],
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("GPT-4o error:", aiRes.status, txt);
      return new Response(JSON.stringify({ error: "AI extraction failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiRes.json();
    const text = aiData.choices?.[0]?.message?.content || "{}";

    let extracted;
    try {
      extracted = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      extracted = match ? JSON.parse(match[0]) : {};
    }

    // Step 3 — Save job to Supabase
    const normalizedUrl = (() => {
      try {
        const u = new URL(job_url);
        u.search = "";
        return u.toString().toLowerCase().replace(/\/$/, "");
      } catch {
        return job_url.toLowerCase().trim();
      }
    })();

    const { data: newJob } = await supabase
      .from("jobs")
      .insert({
        user_id,
        job_url,
        job_url_normalized: normalizedUrl,
        company: extracted.company || "Unknown",
        role: extracted.role || "Unknown",
        raw_text: rawText,
        score: extracted.score || 0,
        score_reason: extracted.reason || "",
        status: "pending",
        found_at: new Date().toISOString(),
      })
      .select()
      .single();

    return new Response(JSON.stringify({ success: true, extracted, job: newJob }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("extract-job error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});