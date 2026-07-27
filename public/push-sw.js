// Imported into the generated /sw.js by vite-plugin-pwa (workbox.importScripts).
// Handles incoming Web Push messages and notification clicks.

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { titre: "FIGDITIONS", message: event.data ? event.data.text() : "" };
  }
  const title = data.titre || "FIGDITIONS";
  const options = {
    body: data.message || "",
    icon: "/pwa-192.png?v=5",
    badge: "/pwa-192.png?v=5",
    tag: data.tag || "figditions",
    renotify: true,
    vibrate: [200, 100, 200],
    data: { url: data.lien || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of all) {
        if ("focus" in c) {
          try {
            await c.focus();
            if ("navigate" in c && url) await c.navigate(url);
            return;
          } catch {
            /* fall through */
          }
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(url);
    })(),
  );
});
