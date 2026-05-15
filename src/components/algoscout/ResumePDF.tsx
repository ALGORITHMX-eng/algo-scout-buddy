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

    // Fetch job
    const { data: job } = await supabase
      .from("jobs")
      .select("company, role, raw_text")
      .eq("id", job_id)
      .single();

    // Fetch real user profile — never hallucinate candidate info
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user_id)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: "Profile not found. Please complete your profile first." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

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
            content: `You are an expert resume and cover letter writer. You ONLY use the exact candidate information provided. You NEVER invent jobs, companies, degrees, dates, or credentials that are not in the profile.

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
  "message": "one sentence confirming what you did"
}

Rules:
- ONLY use data from the CANDIDATE PROFILE — never invent anything not listed there
- targetTitle: read the job description and the candidate background carefully, then pick the most fitting professional title — do NOT just copy the job title verbatim, use judgment to find the best match
- Tailor the summary and bullet points to highlight what matters most for this specific job
- Keep all real experience, projects, and education exactly as given in the profile
- skills: return only the skills from the profile that are most relevant to this job, ordered by relevance
- cover_letter must follow this EXACT format (replace placeholders with real data):

[Candidate Full Name]
[Today's Date]
Hiring Team
[Company Name]

Dear Hiring Team at [Company Name],

[Paragraph 1: Express genuine excitement about the specific role + one sentence on who the candidate is]
[Paragraph 2: 2-3 specific real achievements from their profile that directly match the job requirements — NO invented experience]
[Paragraph 3: Why this specific company excites the candidate — reference something real from the job description]
[Paragraph 4: Confident close + call to action]

Best regards,
[Full Name]
[Location]
[Email] | [Phone]
LinkedIn: [linkedin] | GitHub: [github]

- If instruction is only about resume, return cover_letter unchanged
- If instruction is only about cover letter, return resume unchanged
- Page cap: 3+ jobs = max 3 bullets each, 2 jobs = max 4 each, 1 job = max 6`,
          },
          {
            role: "user",
            content: `TODAY'S DATE: ${today}

JOB: ${job?.company} — ${job?.role}
JOB DESCRIPTION:
${(job?.raw_text || "").slice(0, 3000)}

CANDIDATE PROFILE (use ONLY this data — never invent anything):
Name: ${profile.full_name}
Email: ${profile.email}
Phone: ${profile.phone || ""}
Location: ${profile.location || ""}
LinkedIn: ${profile.linkedin || ""}
GitHub: ${profile.github || ""}
Portfolio: ${profile.portfolio || ""}
Target Titles: ${profile.preferred_titles?.join(", ") || ""}
Years of Experience: ${profile.years_experience || 0}
Skills: ${profile.skills?.join(", ") || ""}
Experience Summary: ${profile.experience_summary || ""}
Full Resume Text (extract all experience, projects, education from here — this is the source of truth):
${profile.raw_resume_text || ""}

CURRENT RESUME (if tweaking, use this as base — otherwise generate fresh from profile):
${current_resume ? JSON.stringify(current_resume, null, 2) : "None — generate from scratch using profile above"}

CURRENT COVER LETTER:
${current_cover_letter || "None — generate from scratch"}

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
        message: result.message || "Done — your tailored docs are ready.",
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