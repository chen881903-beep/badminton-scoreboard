"use strict";
// Bump VERSION whenever any shell file changes. Keep old tabs on their old bundle.
const VERSION = "2.2.0";
const SCOPE = self.registration.scope;
const PREFIX = "xiangyun-scoreboard:" + SCOPE + ":";
const CACHE = PREFIX + VERSION;
const SHELL = [
  "index.html", "style.css?v=2.1-court-first", "scoring.js", "app.js?v=2.1",
  "pwa.js?v=2.2.0", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png"
].map(path => new URL(path, SCOPE).href);
const INDEX = new URL("index.html", SCOPE).href;

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // All files must download successfully before this worker can activate.
    await cache.addAll(SHELL.map(url => new Request(url, {cache: "reload"})));
  })());
  // Intentionally no skipWaiting: do not replace a running match's app bundle.
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)));
    // No localStorage / IndexedDB deletion. Caches from other apps are untouched.
  })());
});
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== new URL(SCOPE).origin) return;
  const isAppPage = request.mode === "navigate" &&
    (url.pathname === new URL(SCOPE).pathname || url.pathname === new URL(INDEX).pathname);
  // Cache only our explicit shell, never other GitHub Pages projects or APIs.
  if (!isAppPage && !SHELL.includes(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(isAppPage ? INDEX : request);
    return cached || fetch(request);
  })());
});
