import { inngest } from "./client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SCOUT_SECRET = import.meta.env.VITE_SCOUT_SECRET;

export const scheduledScout = inngest.createFunction(
  { id: "scheduled-scout", concurrency: 5 },
  { cron: "*/30 * * * *" },
  async ({ step }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY
    );

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
          await fetch(`${SUPABASE_URL}/functions/v1/scout`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-scout-secret": SCOUT_SECRET,
            },
            body: JSON.stringify({ user_id: u.user_id }),
          });
        })
      )
    );

    return { ran: dueUsers.length };
  }
);
