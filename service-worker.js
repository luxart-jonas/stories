/* Ein einziger Service Worker für die ganze arkaa-Seite (Startseite, /interview/, /archiv/) –
   Scope "/", damit eine als App installierte Version zwischen allen drei Bereichen navigieren
   kann, ohne aus dem Standalone-Fenster in den Browser auszubrechen. Cached nur die Seiten-
   Hüllen selbst als Offline-Fallback; POST-Requests (KI-API-Aufrufe) werden nie abgefangen. */

const CACHE_NAME = 'arkaa-shell-v2';
const SHELL_FILES = ['./', './index.html', './interview/index.html', './archiv/index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return; // KI-API-Aufrufe (POST) nie abfangen
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
