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

/* v4 (nach einem weiteren echten Vorfall: "Das Archiv konnte gerade nicht geladen werden
   (Archiv-API-Fehler 401)"): der fetch-Handler unten fing bisher JEDE GET-Anfrage der ganzen
   arkaa-Seite ab - nicht nur die eigenen Seiten-Dateien, sondern auch die GET-Aufrufe von
   archiv/index.html und interview/index.html an die Supabase-API (z.B. .../rest/v1/categories),
   und baute die durchgelassene Anfrage dabei über "fetch(event.request.url, {cache:'no-store'})"
   NEU aus der reinen URL zusammen. Das verliert dabei die Original-Header - insbesondere "apikey"
   und "Authorization", die genau diese Supabase-Aufrufe zur Authentifizierung mitschicken (siehe
   supaGet() in archiv/index.html). Ohne diese Header lehnt Supabase die Anfrage mit 401 ab, auch
   wenn der Schlüssel selbst gültig ist. Fix: der fetch-Handler fängt jetzt NUR NOCH Anfragen an
   die eigene Seite (gleicher Origin) ab - alles andere (jede Supabase-API-Anfrage) läuft komplett
   ungehindert am Service Worker vorbei, mit allen Original-Headern intakt. CACHE_NAME wurde
   hochgezählt, damit der activate-Handler den alten, fehlerhaften Service Worker sofort ersetzt. */

const CACHE_NAME = 'arkaa-shell-v4';
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
  // v4: NUR die eigene Seite betrifft diesen Service Worker überhaupt etwas ("Seiten-Hüllen als
  // Offline-Fallback", siehe Kommentar oben) - jede Anfrage an eine andere Herkunft (allen voran
  // die Supabase-API-Aufrufe von archiv/index.html und interview/index.html) läuft hier komplett
  // unangetastet durch, mit allen Original-Headern (apikey/Authorization) intakt. Vorher wurden
  // auch diese fremden Anfragen abgefangen und unten neu (ohne ihre Header) zusammengebaut - das
  // hat genau diese API-Aufrufe mit 401 fehlschlagen lassen (siehe Kommentar ganz oben, v4).
  if (new URL(event.request.url).origin !== self.location.origin) return;
  // v2: bewusst NICHT "fetch(event.request, { cache: 'no-store' })" - bei einer normalen
  // Seiten-Navigation hat event.request den speziellen Modus "navigate", und ein Request mit
  // diesem Modus lässt sich in manchen Browsern nicht klonen/verändern (führt zu einem Fehler
  // "Cannot construct a Request with a RequestInit whose mode member is set as 'navigate'").
  // Stattdessen wird hier ganz neu anhand der reinen URL (String, ohne den navigate-Modus)
  // angefragt - das umgeht dieses Problem zuverlässig und erzwingt trotzdem denselben
  // "niemals aus dem HTTP-Cache" - Effekt (siehe Erklärung oben). Für die eigene Seite (nur
  // HTML/JS/CSS-Dateien ohne eigene Auth-Header) ist das unbedenklich.
  event.respondWith(
    fetch(event.request.url, { cache: 'no-store' }).catch(() => caches.match(event.request))
  );
});
