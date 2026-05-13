import { serve } from "inngest/next";
import { Inngest } from "inngest";
import { createClient } from "@supabase/supabase-js";

const inngest = new Inngest({ id: "algoscout" });

const scheduledScout = inngest.createFunction(
  { id: "scheduled-scout", concurrency: 5 },
  { cron: "*/30 * * * *" },
  async ({ step }) => {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY!
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
          const res = await fetch(
            `${process.env.VITE_SUPABASE_URL}/functions/v1/scout`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-scout-secret": process.env.VITE_SCOUT_SECRET!,
              },
              body: JSON.stringify({ user_id: u.user_id }),
            }
          );
          const data = await res.json();
          console.log(`[inngest] scout result for ${u.user_id}:`, data);
          return data;
        })
      )
    );

    return { ran: dueUsers.length };
  }
);

export default serve({
  client: inngest,
  functions: [scheduledScout],
});
