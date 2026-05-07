import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-scout-secret",
};

function base64UrlToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function sendPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string
): Promise<boolean> {
  try {
    const signingKey = await crypto.subtle.importKey(
      "pkcs8",
      base64UrlToUint8Array(VAPID_PRIVATE_KEY),
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"]
    );

    const header = { alg: "ES256", typ: "JWT" };
    const now = Math.floor(Date.now() / 1000);
    const origin = new URL(subscription.endpoint).origin;
    const claims = { aud: origin, exp: now + 86400, sub: "mailto:support@algoscout.app" };

    const encode = (obj: object) =>
      btoa(JSON.stringify(obj)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

    const unsignedToken = `${encode(header)}.${encode(claims)}`;

    const signature = await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      signingKey,
      new TextEncoder().encode(unsignedToken)
    );

    const jwt = `${unsignedToken}.${btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")}`;

    const res = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Authorization": `vapid t=${jwt},k=${VAPID_PUBLIC_KEY}`,
        "Content-Type": "application/octet-stream",
        "TTL": "86400",
      },
      body: new TextEncoder().encode(payload),
    });

    return res.ok;
  } catch (err) {
    console.error("Push send error:", err);
    return false;
  }
}

function buildNotification(record: any): { title: string; body: string; url: string } {
  const notifType = record.notification_type || "new_job";

  if (notifType === "applied") {
    return {
      title: `✅ Applied to ${record.company}`,
      body: `${record.role} — Application submitted successfully`,
      url: `/algoscout/job/${record.id}`,
    };
  }

  if (notifType === "needs_help") {
    return {
      title: `⚠️ Action needed at ${record.company}`,
      body: `Skyvern paused: ${record.question?.slice(0, 80) || "Unknown question"}`,
      url: `/algoscout/job/${record.id}`,
    };
  }

  // Default: new job found
  return {
    title: `${record.score}/10 match at ${record.company}`,
    body: `${record.role} — Review now`,
    url: `/algoscout/job/${record.id}`,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const payload = await req.json();
    const record = payload.record;

    if (!record) {
      return new Response("No record", { status: 400 });
    }

    // Get user_id from record
    const userId = record.user_id;

    // Fetch push subscriptions for this user
    let query = supabase.from("push_subscriptions").select("*");
    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data: subs } = await query;

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ message: "No subscribers" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const notification = buildNotification(record);
    const message = JSON.stringify(notification);

    const results = await Promise.all(
      subs.map((sub) => sendPush(sub, message))
    );

    const sent = results.filter(Boolean).length;

    return new Response(
      JSON.stringify({ notified: sent, total: subs.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    console.error("notify error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});