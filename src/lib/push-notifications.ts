// Push notifications require a backend (Lovable Cloud) to store subscriptions
// and a server with the matching VAPID private key to send pushes.
// Until Cloud is enabled here, this acts as a graceful no-op that registers
// the service worker and surfaces a clear message.
export const enablePushNotifications = async (): Promise<{ ok: boolean; message: string }> => {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, message: "Push notifications are not supported in this browser." };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, message: "Notification permission was not granted." };
  }

  try {
    await (navigator.serviceWorker.getRegistration("/sw.js") ||
      navigator.serviceWorker.register("/sw.js"));
    await navigator.serviceWorker.ready;
  } catch {
    // ignore — SW registration is best-effort here
  }

  return {
    ok: false,
    message: "Enable Lovable Cloud to deliver push notifications from the server.",
  };
};
