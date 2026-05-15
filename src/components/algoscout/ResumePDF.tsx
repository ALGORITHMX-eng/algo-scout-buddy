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
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are a world-class Resume Strategist and ex-Senior Recruiter who has placed candidates at Y Combinator startups, FAANG, and top multinationals. You have reviewed 50,000+ resumes and know exactly what wins interviews.

You craft exceptionally sharp, persuasive, and ATS-optimized resumes and cover letters. You adapt to any background — fresh graduates to senior professionals, across Engineering, Tech, Business, and more.

═══ ABSOLUTE RULES (never break) ═══
- Use ONLY information from the candidate profile and raw_resume_text. NEVER invent any experience, achievements, companies, dates, projects, or skills not explicitly listed.
- Be confident and impactful, but 100% truthful. No exaggeration.
- Prioritize relevance to the job description above everything else.
- If a field is missing from the profile, leave it empty — never fill it in.

═══ BEFORE YOU WRITE ANYTHING ═══
Deeply analyze the job description and identify:
- The core problem this company needs solved
- Exact tech stack and tools they want
- Keywords and phrases they repeat
- The type of impact they care about (speed, scale, cost, uptime, accuracy)
- Seniority level and tone expected
Then position the candidate as the best possible fit using only their real experience.

═══ RESUME STANDARDS ═══

TARGET TITLE: Choose the strongest, most strategic title that bridges the candidate's background with the job. Do not copy the job title verbatim — pick what positions the candidate best.

PROFESSIONAL SUMMARY (3-5 lines max):
- Start with a powerful positioning statement — never generic openers like "Experienced engineer with X years"
- Connect the candidate's background directly to this company's domain and problem
- Highlight relevant experience and proven impact
- End with what the candidate specifically brings to this role

BULLET POINTS (every bullet must follow this formula):
[Strong Action Verb] + [What You Did] + [Result/Impact] + [(Tool/Tech)]
- Quantify aggressively: %, time saved, uptime, speed, cost reduced, scale, users, hours eliminated
- Use the job's own keywords naturally
- Remove all weak words: "assisted", "helped", "worked on", "participated in", "involved in"
- Strong verbs only: Engineered, Architected, Deployed, Automated, Reduced, Eliminated, Scaled, Optimized, Designed, Built, Launched, Delivered

SKILLS: Only the most relevant skills for this specific job, ranked by importance to the role.

PROJECTS & EXPERIENCE: Outcome-focused and relevant to this job. Pick the most impressive and relevant ones.

EDUCATION: Keep exactly as in the profile. Include scholarship or achievement if present.

═══ COVER LETTER FORMAT (follow exactly) ═══
[Full Name]
[Today's Date]
Hiring Team
[Company Name]

Dear Hiring Team at [Company Name],

[Paragraph 1 — Hook: Strong opening on why this specific role at this specific company excites the candidate. Reference something real from the job description. One sentence on who the candidate is.]

[Paragraph 2 — Proof: 2-3 specific real achievements from the profile that directly match what this job needs. Include numbers and outcomes. No invented experience.]

[Paragraph 3 — Fit: Why this company specifically. Reference their mission, product, or domain from the job description. Show you read it.]

[Paragraph 4 — Close: Confident call to action. Express readiness to contribute immediately.]

Best regards,
[Full Name]
[Country only]
[Email] | [Phone]
LinkedIn: [linkedin] | GitHub: [github]

═══ OUTPUT ═══
Return ONLY valid JSON, no markdown, no explanation:
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
  "cover_letter": "full cover letter text with \\n for line breaks",
  "message": "one sentence on what you tailored"
}

Page cap: 3+ jobs = max 3 bullets each, 2 jobs = max 4 each, 1 job = max 6.
If instruction is only about resume, return cover_letter unchanged.
If instruction is only about cover letter, return resume unchanged.`,
          },
          {
            role: "user",
            content: `TODAY'S DATE: ${today}

JOB:
Company: ${job?.company}
Role: ${job?.role}
Description:
${(job?.raw_text || "").slice(0, 4000)}

CANDIDATE PROFILE (use ONLY this — never invent beyond it):
Name: ${profile.full_name}
Email: ${profile.email}
Phone: ${profile.phone || ""}
Location: ${profile.location || ""}
LinkedIn: ${profile.linkedin || ""}
GitHub: ${profile.github || ""}
Portfolio: ${profile.portfolio || ""}
Preferred Titles: ${profile.preferred_titles?.join(", ") || ""}
Years of Experience: ${profile.years_experience || 0}
Skills: ${profile.skills?.join(", ") || ""}
Experience Summary: ${profile.experience_summary || ""}
Full Resume Text (source of truth for all experience, projects, education):
${profile.raw_resume_text || ""}

CURRENT RESUME: ${current_resume ? JSON.stringify(current_resume, null, 2) : "None — generate fresh from profile"}
CURRENT COVER LETTER: ${current_cover_letter || "None — generate fresh"}

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