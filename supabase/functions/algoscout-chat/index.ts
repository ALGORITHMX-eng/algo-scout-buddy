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

    const { user_id, messages } = await req.json();

    if (!user_id || !messages) {
      return new Response(JSON.stringify({ error: "user_id and messages required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user_id)
      .single();

    const { data: jobs } = await supabase
      .from("jobs")
      .select("company, role, status, score, found_at")
      .eq("user_id", user_id)
      .eq("status", "applied")
      .order("found_at", { ascending: false })
      .limit(10);

    const { data: history } = await supabase
      .from("coach_conversations")
      .select("role, content")
      .eq("user_id", user_id)
      .order("created_at", { ascending: false })
      .limit(20);

    const appliedJobs = jobs?.map((j) => `${j.role} at ${j.company}`).join(", ") || "None yet";
    const skills = profile?.skills?.join(", ") || "Not specified";

    const systemPrompt = `You are AlgoScout Career Coach — a focused, expert career assistant.

YOUR ROLE: Help users with job search strategy, resume optimization, interview preparation, salary negotiation, and career growth decisions.

USER CONTEXT:
Name: ${profile?.full_name || "User"}
Skills: ${skills}
Experience: ${profile?.experience_summary || "Not provided"}
Applied Jobs: ${appliedJobs}
Location: ${profile?.location || "Not specified"}
Work Preference: ${profile?.work_preference || "remote"}

STRICT BOUNDARIES:
You ONLY discuss career-related topics. If asked anything outside — respond EXACTLY with:
"I'm AlgoScout's career assistant and I only help with career-related questions. For other topics, try Claude.ai or ChatGPT 😊 Now, is there anything about your job search I can help with?"

COACHING STYLE:
- Be direct and actionable
- Give specific advice based on their profile
- Reference their actual skills and experience
- Be encouraging but honest
- Use markdown for clarity
- Keep responses concise — no fluff`;

    const lastUserMessage = messages[messages.length - 1];
    if (lastUserMessage?.role === "user") {
      await supabase.from("coach_conversations").insert({
        user_id,
        role: "user",
        content: lastUserMessage.content,
      });
    }

    const res = await fetch("https://models.inference.ai.azure.com/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 1000,
        temperature: 0.7,
        messages: [
          { role: "system", content: systemPrompt },
          ...(history?.reverse() || []),
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      console.error("GPT-4o error:", res.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(res.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (e) {
    console.error("algoscout-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});