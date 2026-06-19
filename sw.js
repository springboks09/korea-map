// Minimal service worker: instant loads + offline app shell.
// Bump CACHE when you change index.html so phones pick up the new version.
const CACHE = "korea-map-v2";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  // The curated places list must always be fresh — never serve it from cache.
  if (new URL(req.url).pathname.endsWith("/places.json")) {
    e.respondWith(fetch(req).catch(() => new Response("[]", {headers: {"Content-Type": "application/json"}})));
    return;
  }

  // Navigations / the page itself: network-first so updates aren't stuck stale.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then(res => {
        caches.open(CACHE).then(c => c.put("index.html", res.clone()));
        return res;
      }).catch(() => caches.match("index.html").then(r => r || caches.match("./")))
    );
    return;
  }

  // Everything else (fonts, map libs, tiles, icons): stale-while-revalidate.
  e.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(res => {
        if (res && (res.ok || res.type === "opaque")) {
          caches.open(CACHE).then(c => c.put(req, res.clone()));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
