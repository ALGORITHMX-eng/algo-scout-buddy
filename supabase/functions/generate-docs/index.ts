import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN")!;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { user_id, job_id, instruction, current_resume, current_cover_letter } = await req.json();

    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resolvedInstruction = instruction || "Generate a tailored resume and cover letter for this job.";

    const { data: job } = await supabase
      .from("jobs")
      .select("company, role, raw_text")
      .eq("id", job_id)
      .single();

    const res = await fetch("https://models.inference.ai.azure.com/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 4000,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are an expert resume and cover letter editor. Apply the user's instruction precisely to their documents.

Return ONLY valid JSON in this exact shape:
{
  "resume": {
    "name": "",
    "email": "",
    "phone": "",
    "location": "",
    "linkedin": "",
    "github": "",
    "portfolio": "",
    "targetTitle": "",
    "summary": "",
    "experience": [{ "title": "", "company": "", "duration": "", "bullets": [] }],
    "skills": [],
    "projects": [{ "name": "", "description": "", "tech": [] }],
    "education": { "degree": "", "school": "", "year": "", "achievements": "" }
  },
  "cover_letter": "full cover letter text",
  "message": "one sentence confirming what you changed"
}

Rules:
- Keep all existing data intact unless the instruction targets it
- Never invent new jobs, degrees, or credentials
- If instruction is only about resume, return cover_letter unchanged
- If instruction is only about cover letter, return resume unchanged
- Page cap: 3+ jobs = max 3 bullets each, 2 jobs = max 4 each, 1 job = max 6`,
          },
          {
            role: "user",
            content: `JOB: ${job?.company} — ${job?.role}
JOB DESCRIPTION: ${(job?.raw_text || "").slice(0, 3000)}

CURRENT RESUME:
${JSON.stringify(current_resume, null, 2)}

CURRENT COVER LETTER:
${current_cover_letter}

INSTRUCTION: ${resolvedInstruction}`,
          },
        ],
      }),
    });

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "{}";

    let result;
    try {
      result = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      result = match ? JSON.parse(match[0]) : null;
    }

    if (!result) {
      return new Response(JSON.stringify({ error: "Failed to parse AI response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (job_id) {
      await supabase.from("jobs").update({
        resume_notes: JSON.stringify(result.resume),
        cover_letter_notes: result.cover_letter,
      }).eq("id", job_id);
    }

    return new Response(
      JSON.stringify({
        resume: result.resume,
        cover_letter: result.cover_letter,
        message: result.message || "Done — updated your docs.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    console.error("generate-docs error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});