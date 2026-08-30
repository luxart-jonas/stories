/* Ein einziger Service Worker für die ganze arkaa-Seite (Startseite, /interview/, /archiv/) –
   Scope "/", damit eine als App installierte Version zwischen allen drei Bereichen navigieren
   kann, ohne aus dem Standalone-Fenster in den Browser auszubrechen. Cached nur die Seiten-
   Hüllen selbst als Offline-Fallback; POST-Requests (KI-API-Aufrufe) werden nie abgefangen.

   v2 (nach einem echten Vorfall: Jonas hat ein Update auf GitHub Pages hochgeladen, aber sowohl
   die Startseite als auch /interview/ zeigten für ihn - sogar im Inkognito-Fenster - noch lange
   die alte Version): der bisherige fetch-Handler rief zwar "fetch(event.request)" auf ("Netzwerk
   zuerst"), aber ein normaler fetch() OHNE explizite cache-Option unterliegt weiterhin dem
   normalen HTTP-Cache des Browsers - GitHub Pages darf den Seiten also einen Cache-Control-Header
   mitgeben, der einen "frischen" fetch() für einige Minuten trotzdem aus dem Browser-Cache
   beantwortet, OHNE je wirklich das Netzwerk zu kontaktieren. Das erklärte, warum ein neu
   veröffentlichtes Update erst nach einer Weile (oder erst nach manuellem Cache-Löschen) sichtbar
   wurde - "Netzwerk zuerst" war in der Praxis eher "HTTP-Cache zuerst, wenn er noch nicht
   abgelaufen ist". Fix: { cache: 'no-store' } zwingt jeden fetch() hier IMMER zu einer echten
   Netzwerk-Anfrage, nie zu einer Antwort aus dem HTTP-Cache - nur wenn diese Netzwerk-Anfrage
   selbst fehlschlägt (also wirklich kein Internet da ist), greift weiterhin der Offline-Fallback
   aus der eigenen Cache Storage (SHELL_FILES). CACHE_NAME wurde zusätzlich hochgezählt, damit der
   activate-Handler den alten, evtl. noch veralteten Offline-Fallback-Cache sofort verwirft, statt
   ihn stehen zu lassen. */

const CACHE_NAME = 'arkaa-shell-v3';
const SHELL_FILES = ['./', './index.html', './interview/index.html', './archiv/index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // v2: auch das erstmalige Befüllen des Offline-Fallback-Caches erzwingt echte
      // Netzwerk-Anfragen (cache: 'reload') statt sich hier schon auf einen evtl. veralteten
      // HTTP-Cache zu verlassen - der Offline-Fallback soll den zum Installationszeitpunkt
      // tatsächlich aktuellen Stand enthalten, nicht irgendeinen älteren.
      Promise.all(SHELL_FILES.map((url) =>
        fetch(url, { cache: 'reload' }).then((res) => cache.put(url, res)).catch(() => {})
      ))
    )
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
  // v2: bewusst NICHT "fetch(event.request, { cache: 'no-store' })" - bei einer normalen
  // Seiten-Navigation hat event.request den speziellen Modus "navigate", und ein Request mit
  // diesem Modus lässt sich in manchen Browsern nicht klonen/verändern (führt zu einem Fehler
  // "Cannot construct a Request with a RequestInit whose mode member is set as 'navigate'").
  // Stattdessen wird hier ganz neu anhand der reinen URL (String, ohne den navigate-Modus)
  // angefragt - das umgeht dieses Problem zuverlässig und erzwingt trotzdem denselben
  // "niemals aus dem HTTP-Cache" - Effekt (siehe Erklärung oben).
  event.respondWith(
    fetch(event.request.url, { cache: 'no-store' }).catch(() => caches.match(event.request))
  );
});
