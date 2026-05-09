import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

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
    const { user_id, resumeBase64, mimeType } = await req.json();

    if (!user_id || !resumeBase64) {
      return new Response(JSON.stringify({ error: "user_id and resumeBase64 required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resumeText = atob(resumeBase64);

    const res = await fetch("https://models.inference.ai.azure.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GITHUB_TOKEN}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 2000,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You are a resume parser. Always return only valid JSON, no markdown, no explanation.",
          },
          {
            role: "user",
            content: `Extract all information from this resume and return ONLY a JSON object with these fields: full_name, email, phone, location, linkedin, github, portfolio, years_experience (number), skills (array of strings), preferred_titles (array of strings), experience_summary (2-3 sentences), raw_resume_text (full text). Resume: ${resumeText}`,
          },
        ],
      }),
    });

    const data = await res.json();
    console.log("GPT status:", res.status, JSON.stringify(data).slice(0, 300));

    const text = data.choices?.[0]?.message?.content || "{}";

    let parsed: Record<string, any> = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : {};
    }

    const { error: upsertError } = await supabase.from("profiles").upsert(
      {
        id: user_id,
        user_id: user_id,
        full_name: parsed.full_name || "",
        email: parsed.email || "",
        phone: parsed.phone || "",
        location: parsed.location || "",
        linkedin: parsed.linkedin || "",
        github: parsed.github || "",
        portfolio: parsed.portfolio || "",
        years_experience: parsed.years_experience || 0,
        skills: parsed.skills || [],
        preferred_titles: parsed.preferred_titles || [],
        experience_summary: parsed.experience_summary || "",
        raw_resume_text: parsed.raw_resume_text || "",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (upsertError) {
      console.error("Profile upsert error:", upsertError);
      return new Response(
        JSON.stringify({ error: "Failed to save profile", detail: upsertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ success: true, profile: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("parse-resume error:", e instanceof Error ? e.message : e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});