// Bump della versione a ogni cambio di strategia di caching: alla activate
// le cache con nome diverso vengono eliminate, ripartendo da zero.
const CACHE_NAME = "navta-cache-v2";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first per la navigazione (index.html): con la connessione resta
// sempre aggiornata, offline ricade sull'ultima copia salvata. Cache-first
// per tutto il resto dello stesso dominio (JS/CSS/immagini con hash nel
// nome, quindi sicuri da tenere finché non cambiano d'indirizzo).
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || !request.url.startsWith(self.location.origin)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Solo risposte valide: mettere in cache un 404/500 transitorio
          // servirebbe la pagina di errore a ogni avvio offline successivo.
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        // Fallback offline: l'URL esatto, poi la shell dell'app allo scope del
        // service worker (in produzione /Mytravellog/, non la radice "/").
        .catch(() => caches.match(request).then((cached) => cached || caches.match(self.registration.scope)))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
