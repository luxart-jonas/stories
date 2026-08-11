/* Minimaler Service Worker – wird ausschließlich benötigt, damit der Browser die Seite als
   "installierbar" (Desktop-/Handy-App) erkennt. Er cached nur die App-Hülle selbst (index.html)
   als Offline-Fallback; alle echten Daten- bzw. KI-Aufrufe (POST-Requests) werden hier bewusst
   NICHT abgefangen, sondern laufen immer normal übers Netz. */

const CACHE_NAME = 'stories-shell-v1';
const SHELL_FILES = ['./', './index.html'];

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
