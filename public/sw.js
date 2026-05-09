// Credentials injected via postMessage from the app after login
let supabaseUrl = null;
let supabaseAnonKey = null;
let accessToken = null;

// App sends credentials when user logs in
self.addEventListener("message", (event) => {
  if (event.data?.type === "SET_SUPABASE_CREDS") {
    supabaseUrl = event.data.supabaseUrl;
    supabaseAnonKey = event.data.anonKey;
    accessToken = event.data.accessToken;
  }
});

// Fetch latest unread notification from Supabase
async function fetchLatestNotification() {
  if (!supabaseUrl || !accessToken) return null;
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/notifications?read=eq.false&order=created_at.desc&limit=1`,
      {
        headers: {
          "apikey": supabaseAnonKey,
          "Authorization": `Bearer ${accessToken}`,
        },
      }
    );
    const data = await res.json();
    return data?.[0] || null;
  } catch {
    return null;
  }
}

// Mark notification as read
async function markRead(id) {
  if (!supabaseUrl || !accessToken) return;
  try {
    await fetch(`${supabaseUrl}/rest/v1/notifications?id=eq.${id}`, {
      method: "PATCH",
      headers: {
        "apikey": supabaseAnonKey,
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ read: true }),
    });
  } catch {}
}

self.addEventListener("push", (event) => {
  event.waitUntil(
    fetchLatestNotification().then((notif) => {
      const title = notif?.title || "AlgoScout";
      const options = {
        body: notif?.body || "You have a new high-score match.",
        icon: "/placeholder.svg",
        badge: "/placeholder.svg",
        data: { url: notif?.url || "/algoscout", id: notif?.id },
      };
      if (notif?.id) markRead(notif.id);
      return self.registration.showNotification(title, options);
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || "/algoscout"));
});