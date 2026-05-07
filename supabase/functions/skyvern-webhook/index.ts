import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const payload = await req.json();
    console.log("Skyvern webhook:", JSON.stringify(payload));

    const taskId = payload.task_id;
    const status = payload.status;
    const extractedInfo = payload.extracted_information;

    if (!taskId) {
      return new Response("No task_id", { status: 400 });
    }

    // Find job by skyvern task id
    const { data: job } = await supabase
      .from("jobs")
      .select("*, profiles(*)")
      .eq("skyvern_task_id", taskId)
      .single();

    if (!job) {
      return new Response("Job not found", { status: 404 });
    }

    // Handle different Skyvern statuses
    if (status === "completed") {
      // Application submitted successfully
      await supabase
        .from("jobs")
        .update({
          status: "applied",
          skyvern_status: "completed",
          application_confirmation: JSON.stringify(extractedInfo),
          applied_at: new Date().toISOString(),
        })
        .eq("skyvern_task_id", taskId);

      // Notify user of success
      await fetch(`${SUPABASE_URL}/functions/v1/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          record: {
            ...job,
            status: "applied",
            score: job.score,
            company: job.company,
            role: job.role,
            notification_type: "applied",
          },
        }),
      });

    } else if (status === "failed") {
      // Application failed
      await supabase
        .from("jobs")
        .update({
          status: "failed",
          skyvern_status: "failed",
        })
        .eq("skyvern_task_id", taskId);

    } else if (status === "needs_help") {
      // Skyvern paused — unknown question
      const question = payload.question || "Unknown question encountered";

      // Save the question to DB
      await supabase
        .from("jobs")
        .update({
          skyvern_status: "needs_help",
          skyvern_question: question,
        })
        .eq("skyvern_task_id", taskId);

      // Push notification to user — needs their input
      await fetch(`${SUPABASE_URL}/functions/v1/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          record: {
            ...job,
            notification_type: "needs_help",
            question,
          },
        }),
      });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("skyvern-webhook error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});