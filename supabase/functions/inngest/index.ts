import { Inngest } from "https://esm.sh/inngest@3";
import { serve } from "https://esm.sh/inngest@3/edge";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const inngest = new Inngest({
  id: "algoscout",
  eventKey: Deno.env.get("INNGEST_EVENT_KEY")!,
});

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SCOUT_SECRET = Deno.env.get("SCOUT_SECRET")!;

const scheduledScout = inngest.createFunction(
  { id: "scheduled-scout", concurrency: 5 },
  { cron: "*/30 * * * *" },
  async ({ step }) => {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const dueUsers = await step.run("get-due-users", async () => {
      const { data } = await supabase
        .from("user_schedules")
        .select("user_id, scan_interval")
        .eq("status", "active")
        .lte("next_run_time", new Date().toISOString())
        .limit(50);
      return data || [];
    });

    await Promise.all(
      dueUsers.map((u: any) =>
        step.run(`scout-${u.user_id}`, async () => {
          const res = await fetch(`${SUPABASE_URL}/functions/v1/scout`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-scout-secret": SCOUT_SECRET,
            },
            body: JSON.stringify({ user_id: u.user_id }),
          });
          return res.json();
        })
      )
    );

    return { ran: dueUsers.length };
  }
);

// ✅ Correct handler for Supabase Edge Functions (Deno)
const handler = serve({
  client: inngest,
  functions: [scheduledScout],
  signingKey: Deno.env.get("INNGEST_SIGNING_KEY"),
});

Deno.serve((req) => {
  console.log("SIGNING KEY prefix:", Deno.env.get("INNGEST_SIGNING_KEY")?.slice(0, 15));
  return handler(req);
});