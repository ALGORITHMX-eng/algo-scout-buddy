import { supabase } from "@/integrations/supabase/client";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export const enablePushNotifications = async (): Promise<{ ok: boolean; message: string }> => {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, message: "Push notifications are not supported in this browser." };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, message: "Notification permission was not granted." };
  }

  try {
    // Register SW and subscribe directly from the registration — no .ready()
    const reg = await navigator.serviceWorker.register("/sw.js");

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: VAPID_PUBLIC_KEY,
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, message: "Not logged in." };

    const { error } = await supabase.from("push_subscriptions").upsert({
      user_id: user.id,
      endpoint: sub.endpoint,
      p256dh: btoa(String.fromCharCode(...new Uint8Array(sub.getKey("p256dh")!))),
      auth: btoa(String.fromCharCode(...new Uint8Array(sub.getKey("auth")!))),
    }, { onConflict: "endpoint" });

    if (error) throw error;

    return { ok: true, message: "Notifications enabled! You'll be alerted for 8+ matches." };
  } catch (err: any) {
    return { ok: false, message: err?.message || "Failed to enable notifications." };
  }
};