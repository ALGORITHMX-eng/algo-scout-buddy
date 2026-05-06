import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")!;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { user_id, job_id, interview_type, messages, session_id } = await req.json();

    if (!user_id || !job_id) {
      return new Response(JSON.stringify({ error: "user_id and job_id required" }), {
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

    // Fetch user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user_id)
      .single();

    // Fetch tailored resume for this job
    const { data: resume } = await supabase
      .from("resumes")
      .select("tailored_json")
      .eq("user_id", user_id)
      .eq("job_id", job_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // Fetch cover letter for this job
    const { data: coverLetter } = await supabase
      .from("cover_letters")
      .select("content")
      .eq("user_id", user_id)
      .eq("job_id", job_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const skills = profile?.skills?.join(", ") || "";
    const resumeContext = resume?.tailored_json
      ? JSON.stringify(resume.tailored_json)
      : profile?.raw_resume_text || "";

    const interviewTypes: Record<string, string> = {
      technical: `Focus on technical skills, coding concepts, system design, and problem-solving. Ask about specific technologies mentioned in the job description. Test depth of knowledge.`,
      hr: `Focus on behavioral questions, culture fit, motivation, career goals, and soft skills. Use STAR method prompts. Ask about salary expectations, availability, and work style.`,
      final: `Mix of technical and behavioral. Focus on leadership, vision alignment, and high-level problem solving. Ask about past impact and future goals.`,
    };

    const typeGuidance = interviewTypes[interview_type] || interviewTypes.hr;

    const systemPrompt = `You are an expert interviewer conducting a ${interview_type?.toUpperCase() || "HR"} interview for the following position.

JOB DETAILS:
Company: ${job?.company || "Unknown"}
Role: ${job?.role || "Unknown"}
Job Description: ${(job?.raw_text || "").slice(0, 1500)}

CANDIDATE:
Name: ${profile?.full_name || "Candidate"}
Skills: ${skills}
Experience Summary: ${profile?.experience_summary || ""}
Tailored Resume for this job: ${resumeContext.slice(0, 1500)}
Cover Letter sent: ${coverLetter?.content || "Not available"}

INTERVIEW TYPE GUIDANCE:
${typeGuidance}

YOUR BEHAVIOR:
- You are the INTERVIEWER, not a coach
- Ask ONE question at a time
- Wait for the candidate's answer before asking the next question
- Give brief feedback after each answer (1-2 sentences max)
- Reference specific things from their resume — "You mentioned X, can you elaborate?"
- If answer is weak, probe deeper — "Can you give a specific example?"
- After 8-10 questions, wrap up professionally
- Track the flow naturally like a real interview

START: Greet the candidate warmly, introduce yourself as the interviewer from ${job?.company || "the company"}, and ask your first question.

STRICTLY FORBIDDEN:
- Do not break character
- Do not give coaching advice during the interview
- Do not reveal you are an AI unless directly asked
- Do not discuss topics unrelated to the interview`;

    // Create or update interview session
    let sessionId = session_id;
    if (!sessionId) {
      const { data: session } = await supabase
        .from("interview_sessions")
        .insert({
          user_id,
          job_id,
          interview_type: interview_type || "hr",
          messages: [],
        })
        .select()
        .single();
      sessionId = session?.id;
    }

    // Call Groq for real-time voice-ready response
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 500,
        temperature: 0.8,
        messages: [
          { role: "system", content: systemPrompt },
          ...(messages || []),
        ],
        stream: true,
      }),
    });

    // Save messages to session
    if (messages?.length) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg) {
        await supabase
          .from("interview_sessions")
          .update({
            messages: messages,
          })
          .eq("id", sessionId);
      }
    }

    if (!res.ok) {
      const t = await res.text();
      console.error("Groq error:", res.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(res.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "X-Session-Id": sessionId || "",
      },
    });

  } catch (e) {
    console.error("interview error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});