import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SKYVERN_API_KEY = Deno.env.get("SKYVERN_API_KEY")!;
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
    const { job_id, user_id } = await req.json();

    if (!job_id || !user_id) {
      return new Response(JSON.stringify({ error: "job_id and user_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // FIX: use user_id column not id
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

    const { data: resume } = await supabase
      .from("resumes")
      .select("tailored_json")
      .eq("user_id", user_id)
      .eq("job_id", job_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const { data: coverLetter } = await supabase
      .from("cover_letters")
      .select("content")
      .eq("user_id", user_id)
      .eq("job_id", job_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // FIX: check docs before building prompt
    if (!coverLetter?.content) {
      return new Response(
        JSON.stringify({
          error: "Please generate your tailored resume and cover letter before applying.",
          code: "DOCS_NOT_GENERATED",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resumeJson = resume?.tailored_json || {};

    const navigationGoal = `
You are applying for the role of "${job.role}" at "${job.company}" on behalf of ${profile.full_name}.

APPLICANT DETAILS:
- Full Name: ${profile.full_name}
- Email: ${profile.email}
- Phone: ${profile.phone}
- Location: ${profile.location}
- LinkedIn: ${profile.linkedin || ""}
- GitHub: ${profile.github || ""}
- Portfolio: ${profile.portfolio || ""}
- Years of Experience: ${profile.years_experience}
- Work Authorization: Remote contractor available worldwide

COVER LETTER:
${coverLetter.content}

RESUME SUMMARY:
${resumeJson?.summary || profile.experience_summary || ""}

INSTRUCTIONS:
1. Fill in all required form fields with the applicant details above
2. If asked for a cover letter, use the cover letter above
3. If asked to upload a resume, skip that field
4. Submit the application
5. Return the confirmation URL or message

Do NOT fill in salary expectations unless required.
Do NOT create accounts unless necessary — use ${profile.email} if needed.
`;

    const skyvernRes = await fetch("https://api.skyvern.com/api/v1/tasks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": SKYVERN_API_KEY,
      },
      body: JSON.stringify({
        url: job.job_url,
        webhook_callback_url: `${SUPABASE_URL}/functions/v1/skyvern-webhook?secret=${SCOUT_SECRET}`,
        navigation_goal: navigationGoal,
        data_extraction_goal: "Extract the application confirmation number or message.",
        proxy_location: "RESIDENTIAL",
        max_steps_override: 50,
      }),
    });

    const skyvernData = await skyvernRes.json();
    const taskId = skyvernData.task_id;

    if (!taskId) {
      throw new Error(`Skyvern error: ${JSON.stringify(skyvernData)}`);
    }

    await supabase
      .from("jobs")
      .update({
        status: "applying",
        skyvern_task_id: taskId,
        skyvern_status: "running",
        applied_at: new Date().toISOString(),
      })
      .eq("id", job_id);

    return new Response(
      JSON.stringify({ success: true, task_id: taskId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    console.error("apply error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});