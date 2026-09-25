// public/sw.js
const CACHE_NAME = "liora-__BUILD_ID__";
const PRECACHE = __PRECACHE__;
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)),
  );
});
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((k) => k.startsWith("liora-") && k !== CACHE_NAME)
              .map((k) => caches.delete(k)),
          ),
        ),
      self.clients.claim(),
    ]),
  );
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  // An open SSE response would keep this worker alive and block its replacement.
  if (event.request.headers.get("accept")?.includes("text/event-stream"))
    return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) {
    event.respondWith(
      fetch(event.request).catch(
        () =>
          new Response(
            JSON.stringify({
              error: {
                code: "OFFLINE",
                message:
                  "Vous êtes hors ligne. Aucune modification n’a été envoyée ; réessayez au retour du réseau.",
              },
            }),
            {
              status: 503,
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-store",
              },
            },
          ),
      ),
    );
    return;
  }
  if (event.request.method !== "GET") return;
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request, { cache: "no-store" }).catch(
        async () =>
          (await caches.match("/")) ||
          new Response(
            "Liora est hors ligne. Reconnectez-vous puis rechargez.",
            { status: 503 },
          ),
      ),
    );
    return;
  }
  if (PRECACHE.includes(url.pathname)) {
    event.respondWith(
      caches
        .match(event.request)
        .then((cached) => cached || fetch(event.request)),
    );
  }
});
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data?.json() || {};
  } catch {}
  event.waitUntil(
    self.registration.showNotification("Liora", {
      body: "Une nouvelle notification vous attend dans votre espace.",
      icon: "/brand/icon-192.png",
      badge: "/brand/icon-192.png",
      tag: data.tag || "liora",
      data: data.url || "/",
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  let url = new URL("/", self.location.origin);
  try {
    const target = new URL(event.notification.data, self.location.origin);
    if (target.origin === self.location.origin && target.pathname === "/")
      url = target;
  } catch {}
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (windows) => {
        for (const client of windows) {
          if (new URL(client.url).origin === self.location.origin) {
            await client.navigate(url.href);
            return client.focus();
          }
        }
        return clients.openWindow(url.href);
      }),
  );
});
