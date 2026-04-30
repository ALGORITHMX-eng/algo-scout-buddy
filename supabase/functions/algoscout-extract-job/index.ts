// Extract job posting details from a screenshot + generate tailored resume & cover letter.
import { corsHeaders } from "@supabase/supabase-js/cors";

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

type Body = {
  company: string;
  role: string;
  imageDataUrl?: string; // data:image/...;base64,...
  userProfile?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const body = (await req.json()) as Body;
    const company = (body.company || "").trim();
    const role = (body.role || "").trim();
    if (!company || !role) {
      return new Response(JSON.stringify({ error: "company and role are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tools = [
      {
        type: "function",
        function: {
          name: "save_job_posting",
          description: "Extract job posting details and generate tailored resume + cover letter.",
          parameters: {
            type: "object",
            properties: {
              description: { type: "string", description: "Full job description, 2-4 paragraphs." },
              location: { type: "string", description: "Location / remote policy. Best guess if unclear." },
              applyUrl: { type: "string", description: "Application URL if visible, else empty string." },
              reason: { type: "string", description: "One sentence: why this job might be a fit." },
              score: { type: "number", description: "Match score 0-10 based on the role and description." },
              resume: { type: "string", description: "Tailored resume bullet points as plain text, 5-8 bullets starting with •." },
              coverLetter: { type: "string", description: "Tailored cover letter, 2-3 short paragraphs addressed to the company." },
              breakdown: {
                type: "object",
                properties: {
                  skills: { type: "number" },
                  salary: { type: "number" },
                  location: { type: "number" },
                  culture: { type: "number" },
                },
                required: ["skills", "salary", "location", "culture"],
                additionalProperties: false,
              },
            },
            required: ["description", "location", "applyUrl", "reason", "score", "resume", "coverLetter", "breakdown"],
            additionalProperties: false,
          },
        },
      },
    ];

    const userContent: any[] = [
      {
        type: "text",
        text:
          `Company: ${company}\nRole: ${role}\n\n` +
          (body.imageDataUrl
            ? "A screenshot of the job posting is attached. Extract the description, requirements, and location from it. "
            : "No screenshot was provided — use general knowledge about this kind of role to synthesize a realistic description. ") +
          "Then generate a tailored resume (bullets) and a cover letter targeted at this role. " +
          "Also give a match score 0-10 and a 4-part breakdown (skills, salary, location, culture, each 0-10).",
      },
    ];
    if (body.imageDataUrl) {
      userContent.push({ type: "image_url", image_url: { url: body.imageDataUrl } });
    }

    const res = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You are AlgoScout, an AI job-matching assistant. Extract accurate data from screenshots when provided. Output must call the save_job_posting tool exactly once.",
          },
          { role: "user", content: userContent },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "save_job_posting" } },
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      if (res.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (res.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Settings → Workspace → Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("AI gateway error:", res.status, txt);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "AI did not return structured output" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const extracted = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ extracted }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-job error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
