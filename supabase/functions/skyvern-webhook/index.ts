import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SCOUT_SECRET = Deno.env.get("SCOUT_SECRET")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to call notify with proper auth
async function callNotify(record: Record<string, any>) {
  await fetch(`${SUPABASE_URL}/functions/v1/notify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, // FIX: was missing
      "x-scout-secret": SCOUT_SECRET,                          // FIX: was missing
    },
    body: JSON.stringify({ record }),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // FIX: validate Skyvern webhook — check a shared secret in query param
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  if (secret !== SCOUT_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const payload = await req.json();
    console.log("Skyvern webhook:", JSON.stringify(payload));

    const taskId = payload.task_id;
    const status = payload.status;
    const extractedInfo = payload.extracted_information;

    if (!taskId) {
      return new Response("No task_id", { status: 400 });
    }

    const { data: job } = await supabase
      .from("jobs")
      .select("*")
      .eq("skyvern_task_id", taskId)
      .single();

    if (!job) {
      return new Response("Job not found", { status: 404 });
    }

    // FIX: fetch profile separately (no FK relationship between jobs and profiles)
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("user_id", job.user_id)
      .single();

    if (status === "completed") {
      await supabase
        .from("jobs")
        .update({
          status: "applied",
          skyvern_status: "completed",
          application_confirmation: JSON.stringify(extractedInfo),
          applied_at: new Date().toISOString(),
        })
        .eq("skyvern_task_id", taskId);

      await callNotify({
        ...job,
        notification_type: "applied",
        user_name: profile?.full_name,
      });

    } else if (status === "failed") {
      await supabase
        .from("jobs")
        .update({ status: "failed", skyvern_status: "failed" })
        .eq("skyvern_task_id", taskId);

    } else if (status === "needs_help") {
      const question = payload.question || "Unknown question encountered";

      await supabase
        .from("jobs")
        .update({ skyvern_status: "needs_help", skyvern_question: question })
        .eq("skyvern_task_id", taskId);

      await callNotify({
        ...job,
        notification_type: "needs_help",
        question,
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