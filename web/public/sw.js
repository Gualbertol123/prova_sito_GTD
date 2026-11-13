// -----------------------------------------------------------------------------
// Service worker — makes the site installable and quick to open.
//
// It caches the app's CODE only (the HTML shell and the hashed files under
// /assets, icons, fonts). It never touches board data: Supabase lives on
// another origin and is never intercepted, and only GET requests to this
// site are looked at, so tasks, notes and reflections stay in memory only,
// exactly as without it.
//
//   page loads (navigation)  network first, so a deploy shows up at once;
//                            the cached shell only when offline
//   /assets/* (hashed)       cache first: a hashed file never changes
//   other same-site files    network first, cached copy when offline
//
// Change VERSION to drop every cached file on the next visit.
// -----------------------------------------------------------------------------

const VERSION = "v1";
const SHELL = `gtd-shell-${VERSION}`;
const ASSETS = `gtd-assets-${VERSION}`;
const MAX_ASSETS = 80; // old builds' files are dropped beyond this

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.addAll(["/", "/manifest.webmanifest", "/icons/icon-192.png"]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== ASSETS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_ASSETS; i++) await cache.delete(keys[i]);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase, Google Fonts: untouched
  if (url.pathname.startsWith("/.netlify/")) return; // the report PDF function

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(SHELL).then((c) => c.put("/", copy));
          }
          return res;
        })
        .catch(() => caches.match("/", { cacheName: SHELL }).then((r) => r || Response.error()))
    );
    return;
  }

  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.open(ASSETS).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) {
          await cache.put(req, res.clone());
          trim(cache);
        }
        return res;
      })
    );
    return;
  }

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || Response.error()))
  );
});
