import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN")!;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { job_id, user_id } = await req.json();

    if (!job_id || !user_id) {
      return new Response(JSON.stringify({ error: "job_id and user_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch job
    const { data: job } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", job_id)
      .single();

    if (!job) {
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch user profile
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

    // Fetch previous cover letters to avoid repetition
    const { data: prevLetters } = await supabase
      .from("cover_letters")
      .select("content")
      .eq("user_id", user_id)
      .order("created_at", { ascending: false })
      .limit(3);

    const prevLetterContext = prevLetters?.length
      ? `Previous cover letters for context (avoid repeating same phrases):\n${prevLetters.map((l) => l.content).join("\n---\n")}`
      : "";

    const skills = profile.skills?.join(", ") || "";
    const titles = profile.preferred_titles?.join(", ") || "";

    // Step 1 — Generate tailored resume JSON with GPT-4o
    const resumeRes = await fetch("https://models.inference.ai.azure.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GITHUB_TOKEN}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 1500,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You are an expert resume writer. Return only valid JSON, no markdown.",
          },
          {
            role: "user",
            content: `Tailor this candidate's resume for the specific job below.

CANDIDATE:
Name: ${profile.full_name}
Location: ${profile.location}
Skills: ${skills}
Target Roles: ${titles}
Years of Experience: ${profile.years_experience}
Experience Summary: ${profile.experience_summary || ""}
Raw Resume: ${profile.raw_resume_text || ""}

JOB:
Company: ${job.company}
Role: ${job.role}
Description: ${(job.raw_text || "").slice(0, 2000)}

Return ONLY a JSON object in this exact format:
{
  "name": "candidate full name",
  "email": "email",
  "phone": "phone",
  "location": "location",
  "linkedin": "linkedin url",
  "github": "github url",
  "summary": "2-3 sentence professional summary tailored to this role",
  "experience": [
    {
      "title": "Job Title",
      "company": "Company",
      "duration": "Jan 2024 - Present",
      "bullets": ["achievement 1", "achievement 2", "achievement 3"]
    }
  ],
  "skills": ["skill1", "skill2", "skill3"],
  "projects": [
    {
      "name": "Project Name",
      "description": "one line description",
      "tech": ["tech1", "tech2"]
    }
  ],
  "education": {
    "degree": "degree name",
    "school": "school name",
    "year": "graduation year"
  }
}`,
          },
        ],
      }),
    });

    const resumeData = await resumeRes.json();
    const resumeText = resumeData.choices?.[0]?.message?.content || "{}";

    let resumeJson;
    try {
      resumeJson = JSON.parse(resumeText);
    } catch {
      const match = resumeText.match(/\{[\s\S]*\}/);
      resumeJson = match ? JSON.parse(match[0]) : {};
    }

    // Step 2 — Generate cover letter with GPT-4o
    const coverRes = await fetch("https://models.inference.ai.azure.com/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 800,
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content: `You are an expert cover letter writer. Write compelling, personalized cover letters that get interviews. Never use generic phrases like "I am writing to express my interest". Be specific, confident, and show genuine knowledge of the company.`,
          },
          {
            role: "user",
            content: `Write a tailored cover letter for this candidate and job.

CANDIDATE:
Name: ${profile.full_name}
Skills: ${skills}
Experience: ${profile.experience_summary || ""}
Raw Resume: ${profile.raw_resume_text || ""}

JOB:
Company: ${job.company}
Role: ${job.role}
Description: ${(job.raw_text || "").slice(0, 2000)}

${prevLetterContext}

Requirements:
- 3 short paragraphs max
- First paragraph: specific hook about the company/role
- Second paragraph: 2-3 concrete achievements that match their needs
- Third paragraph: confident close with call to action
- Tone: confident, direct, human
- No fluff, no clichés
- Address to hiring team if no specific name

Return ONLY the cover letter text, no subject line, no formatting.`,
          },
        ],
      }),
    });

    const coverData = await coverRes.json();
    const coverLetter = coverData.choices?.[0]?.message?.content || "";

    // Step 3 — Save to Supabase
    const { data: savedResume } = await supabase
      .from("resumes")
      .insert({
        user_id,
        job_id,
        tailored_json: resumeJson,
      })
      .select()
      .single();

    const { data: savedCover } = await supabase
      .from("cover_letters")
      .insert({
        user_id,
        job_id,
        content: coverLetter,
      })
      .select()
      .single();

    // Update job with resume/cover letter notes
    await supabase
      .from("jobs")
      .update({
        resume_notes: JSON.stringify(resumeJson),
        cover_letter_notes: coverLetter,
      })
      .eq("id", job_id);

    return new Response(
      JSON.stringify({
        resume: resumeJson,
        coverLetter,
        resumeId: savedResume?.id,
        coverId: savedCover?.id,
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