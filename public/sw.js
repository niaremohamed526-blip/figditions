// FIGDITIONS application worker. This file lives in public/ so every hosting
// target (including Vercel) serves /sw.js directly.
importScripts("/push-sw.js");

const CACHE_VERSION = "figditions-app-20261102-offline-v5";
const PAGE_CACHE = `${CACHE_VERSION}-pages`;
const ASSET_CACHE = `${CACHE_VERSION}-assets`;
// Data read from Supabase, kept across app updates so the last known data
// stays readable offline. The page deletes it on sign-out.
const DATA_CACHE = "figditions-data";
const OFFLINE_URL = "/";

// Developers can rehearse a network cut from the page; the app never sends it.
// The switch is kept in a cache so it survives worker restarts.
const TEST_CACHE = "figditions-test";
let coupureSimulee = caches.open(TEST_CACHE).then((c) => c.match("/__coupure")).then((r) => !!r).catch(() => false);
let coupureActive = false;
coupureSimulee.then((v) => { coupureActive = v; });
const reseau = async (input, init) => {
  if (await coupureSimulee) throw new TypeError("Failed to fetch (coupure simulée)");
  return fetch(input, init);
};

// App pages saved at install, so each one opens offline even if never visited.
const APP_PAGES = [
  "/", "/login", "/dashboard", "/manuscrits", "/auteurs", "/stocks", "/finances",
  "/contrats", "/contrats/modeles", "/imprimeries", "/estimateur", "/conversions",
  "/medmo", "/parametres",
];

/** Saves every page and every code file of the current version on the device. */
async function preparerHorsLigne() {
  const pages = await caches.open(PAGE_CACHE);
  const assets = await caches.open(ASSET_CACHE);
  await Promise.all(APP_PAGES.map((p) =>
    fetch(new Request(p, { cache: "reload", credentials: "same-origin" }))
      .then((r) => (r.ok ? pages.put(p, r) : undefined))
      .catch(() => undefined),
  ));
  // Code files: those named in the home page, then every chunk the main file loads.
  const html = await (await pages.match("/"))?.text();
  if (!html) return;
  const urls = new Set(html.match(/\/assets\/[A-Za-z0-9_.-]+\.(?:js|css)/g) || []);
  for (const u of [...urls]) {
    if (!/\/assets\/index-[^/]+\.js$/.test(u)) continue;
    try {
      const code = await (await fetch(u)).text();
      (code.match(/assets\/[A-Za-z0-9_.-]+\.(?:js|css)/g) || []).forEach((c) => urls.add(`/${c}`));
    } catch { /* offline during install: next visit fills the cache */ }
  }
  await Promise.all([...urls].map(async (u) => {
    if (await assets.match(u)) return;
    try {
      const r = await fetch(u);
      if (r.ok) await assets.put(u, r);
    } catch { /* ignore */ }
  }));
  // Code of earlier releases is no longer needed: keep the device light.
  if (urls.size > 20) {
    for (const req of await assets.keys()) {
      const chemin = new URL(req.url).pathname;
      if (/\/assets\/[^/]+\.(?:js|css)$/.test(chemin) && !urls.has(chemin)) await assets.delete(req);
    }
  }
}

/** A new release went live: save its pages and code on the device too, once. */
let versionConnue = null;
async function suivreVersion(response) {
  const principal = (await response.text()).match(/\/assets\/index-[A-Za-z0-9_-]+\.js/)?.[0];
  if (!principal || principal === versionConnue) return;
  versionConnue = principal;
  if (await caches.match(principal, { cacheName: ASSET_CACHE })) return;
  await preparerHorsLigne();
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(preparerHorsLigne().catch(() => undefined));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(keys
          .filter((key) => !key.startsWith(CACHE_VERSION) && key !== DATA_CACHE && key !== TEST_CACHE)
          .map((key) => caches.delete(key))),
      ),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "figditions:clear-data") event.waitUntil(caches.delete(DATA_CACHE));
  if (event.data?.type === "figditions:test-offline") {
    const on = !!event.data.on;
    coupureSimulee = Promise.resolve(on);
    coupureActive = on;
    event.waitUntil(on
      ? caches.open(TEST_CACHE).then((c) => c.put("/__coupure", new Response("1")))
      : caches.delete(TEST_CACHE));
  }
});

/** Supabase reads: database rows, the signed-in user, public files (logos). */
function estLectureSupabase(url) {
  if (!url.hostname.endsWith(".supabase.co")) return false;
  return url.pathname.startsWith("/rest/v1/")
    || url.pathname === "/auth/v1/user"
    || url.pathname.startsWith("/storage/v1/object/public/");
}

/** Same URL can be read as a list or as one row: keep both apart. */
function cleDonnees(request) {
  const url = new URL(request.url);
  url.searchParams.set("__accept", request.headers.get("accept") || "");
  url.searchParams.set("__prefer", request.headers.get("prefer") || "");
  return url.href;
}

/** Network first; when the network fails, the last copy saved on the device. */
async function lectureDonnees(request) {
  const cle = cleDonnees(request);
  try {
    const response = await reseau(request);
    if (response.ok) {
      const copie = response.clone();
      const body = await copie.arrayBuffer();
      // Cache API refuses 206 (ranged) answers: store them as 200.
      const saved = new Response(body, { status: 200, statusText: "OK", headers: copie.headers });
      caches.open(DATA_CACHE).then((c) => c.put(cle, saved)).catch(() => undefined);
    }
    return response;
  } catch (err) {
    const cached = await caches.match(cle, { cacheName: DATA_CACHE });
    if (cached) return cached;
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  // Rehearsed cut: Supabase writes and sign-in renewals fail like a real one.
  if (coupureActive && request.method !== "GET" && url.hostname.endsWith(".supabase.co")) {
    event.respondWith(Response.error());
    return;
  }
  if (request.method !== "GET") return;

  if (estLectureSupabase(url)) {
    event.respondWith(lectureDonnees(request));
    return;
  }
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/lecture/")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      reseau(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(PAGE_CACHE).then((cache) => cache.put(request, copy));
            event.waitUntil(suivreVersion(response.clone()).catch(() => undefined));
          }
          return response;
        })
        .catch(async () =>
          (await caches.match(request, { ignoreSearch: true }))
          || (await caches.match("/dashboard"))
          || (await caches.match(OFFLINE_URL))),
    );
    return;
  }

  // Application code must be network-first so a deployment can never remain
  // hidden behind an older cached interface. The cache remains an offline
  // fallback when the device has no connection.
  if (["script", "style"].includes(request.destination) || url.pathname.startsWith("/assets/")) {
    event.respondWith(
      reseau(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => (await caches.match(request, { ignoreSearch: true })) || Response.error()),
    );
    return;
  }

  if (["font", "image", "manifest"].includes(request.destination)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = reseau(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        });
        return cached || network;
      }),
    );
  }
});
