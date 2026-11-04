// Jaiyq service worker — installability, app-shell cache and (P3.6) weak-network data cache.
// Network-first everywhere, so a working connection always gets fresh data and new deploys.

const SHELL = "jaiyq-shell-v2";
const DATA = "jaiyq-data-v1";
const DATA_MAX_AGE_MS = 7 * 24 * 3600e3; // older cached data is dropped, not shown

// Role-gated or personal endpoints are never cached (another user could see them offline).
const PRIVATE_API = /^\/api\/(auth|admin|complaints|officer|moderation|export|reports|agent|analyze|layer-ai|translate|telegram|keys-status)\b/;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== DATA).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

async function notifyStale(url, cachedAt) {
  const clients = await self.clients.matchAll({ type: "window" });
  for (const c of clients) c.postMessage({ type: "jaiyq-stale", url, cachedAt });
}

async function dataFirstNetwork(req) {
  const cache = await caches.open(DATA);
  try {
    const res = await fetch(req);
    if (res.ok) {
      // Store a copy stamped with the time it was fetched.
      const body = await res.clone().blob();
      const headers = new Headers(res.headers);
      headers.set("x-jaiyq-cached-at", String(Date.now()));
      await cache.put(req, new Response(body, { status: res.status, statusText: res.statusText, headers }));
    }
    return res;
  } catch (err) {
    const hit = await cache.match(req);
    const cachedAt = Number(hit?.headers.get("x-jaiyq-cached-at"));
    if (!hit || !cachedAt || Date.now() - cachedAt > DATA_MAX_AGE_MS) throw err; // → UI shows "дерек жоқ"
    await notifyStale(new URL(req.url).pathname, cachedAt);
    return hit;
  }
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) {
    if (PRIVATE_API.test(url.pathname) || req.headers.has("Authorization")) return;
    e.respondWith(dataFirstNetwork(req));
    return;
  }
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(SHELL).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req))
  );
});
