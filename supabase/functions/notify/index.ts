import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const SCOUT_SECRET = Deno.env.get("SCOUT_SECRET")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-scout-secret",
};

function base64UrlToUint8Array(base64: string): Uint8Array {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

// FIX: import raw EC key (VAPID keys are raw P-256, not PKCS8)
async function importVapidPrivateKey(rawBase64: string): Promise<CryptoKey> {
  const rawBytes = base64UrlToUint8Array(rawBase64);

  // VAPID private key is 32 raw bytes — wrap into JWK for import
  const jwk = {
    kty: "EC",
    crv: "P-256",
    d: rawBase64,
    // derive x,y from public key
    x: VAPID_PUBLIC_KEY.slice(0, 43),
    y: VAPID_PUBLIC_KEY.slice(43),
  };

  // If raw bytes length is 32, it's a raw EC key — use JWK
  if (rawBytes.length === 32) {
    return await crypto.subtle.importKey(
      "jwk", jwk,
      { name: "ECDSA", namedCurve: "P-256" },
      false, ["sign"]
    );
  }

  // Otherwise assume PKCS8
  return await crypto.subtle.importKey(
    "pkcs8", rawBytes,
    { name: "ECDSA", namedCurve: "P-256" },
    false, ["sign"]
  );
}

async function buildVapidJwt(endpoint: string): Promise<string> {
  const signingKey = await importVapidPrivateKey(VAPID_PRIVATE_KEY);

  const encode = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const now = Math.floor(Date.now() / 1000);
  const origin = new URL(endpoint).origin;
  const header = { alg: "ES256", typ: "JWT" };
  const claims = { aud: origin, exp: now + 43200, sub: "mailto:support@algoscout.app" };

  const unsigned = `${encode(header)}.${encode(claims)}`;
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    signingKey,
    new TextEncoder().encode(unsigned)
  );

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  return `${unsigned}.${sigB64}`;
}

// FIX: send empty push — no body = no encryption needed
async function sendEmptyPush(endpoint: string): Promise<boolean> {
  try {
    const jwt = await buildVapidJwt(endpoint);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `vapid t=${jwt},k=${VAPID_PUBLIC_KEY}`,
        "TTL": "86400",
        "Content-Length": "0",
      },
    });

    if (!res.ok) {
      console.error(`Push failed: ${res.status} ${await res.text()}`);
    }
    return res.ok;
  } catch (err) {
    console.error("Push send error:", err);
    return false;
  }
}

function buildNotification(record: any): { title: string; body: string; url: string } {
  const type = record.notification_type || "new_job";

  if (type === "applied") {
    return {
      title: `✅ Applied to ${record.company}`,
      body: `${record.role} — Application submitted`,
      url: `/algoscout/job/${record.id}`,
    };
  }
  if (type === "needs_help") {
    return {
      title: `⚠️ Action needed at ${record.company}`,
      body: `Skyvern paused: ${record.question?.slice(0, 80) || "Unknown"}`,
      url: `/algoscout/job/${record.id}`,
    };
  }
  return {
    title: `${record.score}/10 match at ${record.company}`,
    body: `${record.role} — Review now`,
    url: `/algoscout/job/${record.id}`,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // FIX: validate scout secret
  const secret = req.headers.get("x-scout-secret");
  if (secret !== SCOUT_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const payload = await req.json();
    const record = payload.record;

    if (!record?.user_id) {
      return new Response("No record or user_id", { status: 400 });
    }

    const userId = record.user_id;
    const notification = buildNotification(record);

    // Store notification in DB — SW fetches this when it wakes up
    await supabase.from("notifications").insert({
      user_id: userId,
      title: notification.title,
      body: notification.body,
      url: notification.url,
    });

    // Get push subscriptions
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("endpoint")
      .eq("user_id", userId);

    if (!subs || subs.length === 0) {
      return new Response(
        JSON.stringify({ message: "Notification saved, no push subscribers" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send empty push to each subscription — SW will fetch notification from DB
    const results = await Promise.all(subs.map((s) => sendEmptyPush(s.endpoint)));
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