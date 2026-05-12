import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SCOUT_SECRET = Deno.env.get("SCOUT_SECRET")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ── existing pipeline logic ───────────────────────────────────────────────────
async function run(userId: string) {
  const seedsRes = await fetch(`${SUPABASE_URL}/functions/v1/generate-seeds`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ user_id: userId }),
  });
  const seedsData = await seedsRes.json();
  if (!seedsRes.ok || !seedsData.success) {
    throw new Error(`Seed generation failed: ${seedsData.error || "unknown"}`);
  }
  console.log(`[trigger-scout] ${seedsData.seeds?.length || 0} seeds generated`);

  const scoutRes = await fetch(`${SUPABASE_URL}/functions/v1/scout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "x-scout-secret": SCOUT_SECRET,
    },
    body: JSON.stringify({ user_id: userId }),
  });
  const scoutData = await scoutRes.json();
  console.log(`[trigger-scout] Scout done for ${userId}:`, scoutData);
  return scoutData;
}

// ── scheduler: runs all due users ────────────────────────────────────────────
async function runScheduler() {
  const { data: dueUsers, error } = await serviceClient
    .from("user_schedules")
    .select("user_id, scan_interval")
    .eq("status", "active")
    .lte("next_run_time", new Date().toISOString())
    .limit(50);

  if (error) throw new Error(`Failed to fetch due users: ${error.message}`);
  if (!dueUsers || dueUsers.length === 0) {
    console.log("[scheduler] No users due.");
    return { ran: 0 };
  }

  console.log(`[scheduler] ${dueUsers.length} users due`);

  await Promise.allSettled(
    dueUsers.map(async ({ user_id, scan_interval }) => {
      try {
        await run(user_id);

        await serviceClient
          .from("user_schedules")
          .update({
            last_scouted_at: new Date().toISOString(),
            next_run_time: new Date(
              Date.now() + intervalToMs(scan_interval)
            ).toISOString(),
          })
          .eq("user_id", user_id);

        console.log(`[scheduler] ✓ Done for ${user_id}`);
      } catch (err) {
        console.error(`[scheduler] ✗ Failed for ${user_id}:`, err);
      }
    })
  );

  return { ran: dueUsers.length };
}

function intervalToMs(interval: string): number {
  if (!interval) return 24 * 60 * 60 * 1000;
  const hours = interval.match(/(\d+)\s*hour/)?.[1];
  const minutes = interval.match(/(\d+)\s*min/)?.[1];
  const hms = interval.match(/^(\d+):(\d+):(\d+)$/);
  if (hms) {
    return (
      parseInt(hms[1]) * 3600000 +
      parseInt(hms[2]) * 60000 +
      parseInt(hms[3]) * 1000
    );
  }
  return (
    (parseInt(hours || "0") * 3600000) +
    (parseInt(minutes || "0") * 60000) ||
    24 * 3600000
  );
}

// ── request handler ───────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const body = await req.json().catch(() => ({}));
  const cronSecret = req.headers.get("x-cron-secret");

  // ── Path 1: GitHub Actions / cron hits this with cron secret ──
  if (cronSecret === CRON_SECRET) {
    try {
      // AWAIT directly — no waitUntil — so GitHub Actions waits for full result
      const result = await runScheduler();
      return new Response(
        JSON.stringify({ success: true, ...result }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (err: any) {
      console.error("[scheduler] error:", err);
      return new Response(
        JSON.stringify({ success: false, error: err.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  // ── Path 2: user triggers their own scout manually ──
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  let userId = body.user_id;

  if (!userId && token) {
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    userId = user?.id;
  }

  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // For manual user triggers keep it background so UI stays snappy
  // @ts-ignore
  EdgeRuntime.waitUntil(run(userId).catch(console.error));
  return new Response(
    JSON.stringify({ success: true, message: "Scout started in background" }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});