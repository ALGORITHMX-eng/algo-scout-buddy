import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SKYVERN_API_KEY = Deno.env.get("SKYVERN_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Your personal details for Skyvern to fill forms
const APPLICANT = {
  full_name: "Johnson Olalere",
  email: "algorithmengineer4@gmail.com",
  phone: "+2348155667497",
  location: "Ile-Ife, Nigeria",
  linkedin: "https://linkedin.com/in/johnson-olalere",
  github: "https://github.com/ALGORITHMX-eng",
  portfolio: "https://your-portfolio.com",
  years_experience: "3",
  work_authorization: "Remote contractor available worldwide",
};

// Skyvern task prompt
function buildPrompt(job: {
  role: string;
  company: string;
  resume_notes: string;
  cover_letter_notes: string;
}): string {
  return `
You are applying for the role of "${job.role}" at "${job.company}" on behalf of Johnson Olalere.

APPLICANT DETAILS:
- Full Name: ${APPLICANT.full_name}
- Email: ${APPLICANT.email}
- Phone: ${APPLICANT.phone}
- Location: ${APPLICANT.location}
- LinkedIn: ${APPLICANT.linkedin}
- GitHub: ${APPLICANT.github}
- Portfolio: ${APPLICANT.portfolio}
- Years of Experience: ${APPLICANT.years_experience}
- Work Authorization: ${APPLICANT.work_authorization}

COVER LETTER / ADDITIONAL INFO:
${job.cover_letter_notes || "I am excited to apply for this role and believe my experience in AI systems, LangChain, RAG pipelines, and automation engineering makes me a strong fit."}

INSTRUCTIONS:
1. Fill in all required form fields with the applicant details above
2. If asked for a cover letter or additional info, use the cover letter notes
3. If asked to upload a resume, skip that field — we will handle separately
4. Submit the application
5. Take a screenshot of the confirmation page
6. Return the confirmation URL or text

Do NOT fill in salary expectations unless required.
Do NOT create accounts unless necessary to apply.
If the application requires account creation, use ${APPLICANT.email} and note the password used.
`;
}

Deno.serve(async (req) => {
  try {
    const { job_id } = await req.json();

    if (!job_id) {
      return new Response(JSON.stringify({ error: "job_id required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Fetch job from Supabase
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", job_id)
      .single();

    if (jobError || !job) {
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Create Skyvern task
    const skyvernRes = await fetch("https://api.skyvern.com/api/v1/tasks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": SKYVERN_API_KEY,
      },
      body: JSON.stringify({
        url: job.job_url,
        webhook_callback_url: `${SUPABASE_URL}/functions/v1/skyvern-webhook`,
        totp_verification_url: null,
        navigation_goal: buildPrompt({
          role: job.role,
          company: job.company,
          resume_notes: job.resume_notes || "",
          cover_letter_notes: job.cover_letter_notes || "",
        }),
        data_extraction_goal:
          "Extract the application confirmation number, confirmation message, or any proof of submission.",
        proxy_location: "RESIDENTIAL",
        max_steps_override: 50,
      }),
    });

    const skyvernData = await skyvernRes.json();
    const taskId = skyvernData.task_id;

    if (!taskId) {
      throw new Error(`Skyvern error: ${JSON.stringify(skyvernData)}`);
    }

    // Update job status to "applied" + store Skyvern task ID
    await supabase
      .from("jobs")
      .update({
        status: "applied",
        skyvern_task_id: taskId,
        skyvern_status: "running",
        applied_at: new Date().toISOString(),
      })
      .eq("id", job_id);

    return new Response(
      JSON.stringify({ success: true, task_id: taskId }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});