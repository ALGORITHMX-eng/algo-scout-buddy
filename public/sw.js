self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { title: "AlgoScout", body: event.data ? event.data.text() : "" }; }
  const title = data.title || "AlgoScout";
  const options = {
    body: data.body || "You have a new high-score match.",
    icon: data.icon || "/placeholder.svg",
    badge: data.badge || "/placeholder.svg",
    data: data.url || "/algoscout",
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data || "/algoscout"));
});
