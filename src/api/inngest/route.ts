import { serve } from "inngest/next";
import { inngest } from "../../inngest/client";
import { scheduledScout } from "../../inngest/scout";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [scheduledScout],
});
