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

    const {
      user_id,
      job_id,
      interview_type,
      messages,
      session_id,
      generate_feedback, // 🆕 client sends this = true when interview ends
    } = await req.json();

    if (!user_id || !job_id) {
      return new Response(JSON.stringify({ error: "user_id and job_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch job, profile, resume, cover letter
    const [{ data: job }, { data: profile }, { data: resume }, { data: coverLetter }] =
      await Promise.all([
        supabase.from("jobs").select("*").eq("id", job_id).single(),
        supabase.from("profiles").select("*").eq("id", user_id).single(),
        supabase
          .from("resumes")
          .select("tailored_json")
          .eq("user_id", user_id)
          .eq("job_id", job_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single(),
        supabase
          .from("cover_letters")
          .select("content")
          .eq("user_id", user_id)
          .eq("job_id", job_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single(),
      ]);

    const skills = profile?.skills?.join(", ") || "";
    const resumeContext = resume?.tailored_json
      ? JSON.stringify(resume.tailored_json)
      : profile?.raw_resume_text || "";

    // ─────────────────────────────────────────────
    // 🆕 FEEDBACK MODE — triggered when interview ends
    // ─────────────────────────────────────────────
    if (generate_feedback && session_id && messages?.length) {
      const feedbackPrompt = `You are an expert interview coach. Analyze the following ${interview_type?.toUpperCase() || "HR"} interview transcript between an interviewer and a candidate applying for "${job?.role}" at "${job?.company}".

TRANSCRIPT:
${messages
  .map((m: { role: string; content: string }) =>
    `[${m.role.toUpperCase()}]: ${m.content}`
  )
  .join("\n\n")}

Generate a detailed post-interview feedback report in the following JSON format ONLY (no extra text):

{
  "overall_score": <number 0-100>,
  "overall_verdict": "<one sentence summary of performance>",
  "sections": [
    {
      "category": "Communication",
      "score": <0-100>,
      "strength": "<what they did well>",
      "improvement": "<what to fix>"
    },
    {
      "category": "Technical Knowledge",
      "score": <0-100>,
      "strength": "<what they did well>",
      "improvement": "<what to fix>"
    },
    {
      "category": "Confidence & Delivery",
      "score": <0-100>,
      "strength": "<what they did well>",
      "improvement": "<what to fix>"
    },
    {
      "category": "Relevance of Answers",
      "score": <0-100>,
      "strength": "<what they did well>",
      "improvement": "<what to fix>"
    },
    {
      "category": "Storytelling & Examples",
      "score": <0-100>,
      "strength": "<what they did well>",
      "improvement": "<what to fix>"
    }
  ],
  "top_strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "critical_gaps": ["<gap 1>", "<gap 2>", "<gap 3>"],
  "recommended_drills": [
    {
      "drill": "<exercise name>",
      "why": "<why this helps>",
      "how": "<how to practice it>"
    }
  ],
  "hire_likelihood": "<Strong Yes | Yes | Maybe | No>",
  "coach_note": "<motivational closing note from the coach>"
}`;

      const feedbackRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          max_tokens: 2000,
          temperature: 0.4, // lower = more consistent scoring
          messages: [{ role: "user", content: feedbackPrompt }],
          stream: false,
        }),
      });

      const feedbackData = await feedbackRes.json();
      const raw = feedbackData.choices?.[0]?.message?.content || "{}";

      let feedback;
      try {
        // Strip possible markdown fences
        const clean = raw.replace(/```json|```/g, "").trim();
        feedback = JSON.parse(clean);
      } catch {
        feedback = { error: "Failed to parse feedback", raw };
      }

      // Save feedback to interview session
      await supabase
        .from("interview_sessions")
        .update({
          feedback,
          completed_at: new Date().toISOString(),
          messages,
        })
        .eq("id", session_id);

      return new Response(JSON.stringify({ success: true, feedback }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─────────────────────────────────────────────
    // NORMAL INTERVIEW MODE (streaming)
    // ─────────────────────────────────────────────
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
Tailored Resume: ${resumeContext.slice(0, 1500)}
Cover Letter sent: ${coverLetter?.content || "Not available"}

INTERVIEW TYPE GUIDANCE:
${typeGuidance}

YOUR BEHAVIOR:
- You are the INTERVIEWER, not a coach
- Ask ONE question at a time
- Wait for the candidate's answer before asking the next question
- Reference specific things from their resume — "You mentioned X, can you elaborate?"
- If answer is weak, probe deeper — "Can you give a specific example?"
- After 8-10 questions, wrap up with: "That concludes our interview. We'll be in touch soon. Thank you [name]!" — this signals the end
- Track the flow naturally like a real interview

START: Greet the candidate warmly, introduce yourself as the interviewer from ${job?.company || "the company"}, and ask your first question.

STRICTLY FORBIDDEN:
- Do not break character
- Do not give coaching advice during the interview
- Do not reveal you are an AI unless directly asked
- Do not discuss topics unrelated to the interview`;

    // Create session if new
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

    // Save messages
    if (messages?.length) {
      await supabase
        .from("interview_sessions")
        .update({ messages })
        .eq("id", sessionId);
    }

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