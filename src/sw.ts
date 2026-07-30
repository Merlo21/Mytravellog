/// <reference lib="webworker" />
// Service worker della PWA, compilato da vite-plugin-pwa (injectManifest).
// Sostituisce il vecchio public/sw.js scritto a mano, che cacheava solo ciò
// che veniva visitato: le pagine lazy mai aperte (es. In programma) offline
// non si caricavano. Qui la build inietta in __WB_MANIFEST l'elenco COMPLETO
// degli asset (chunk lazy e font inclusi) e il precache li scarica subito.
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from "workbox-precaching";
import type { PrecacheEntry } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { NetworkFirst, CacheFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { clientsClaim } from "workbox-core";

declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<PrecacheEntry | string> };

self.skipWaiting();
clientsClaim();

// Precache di tutta l'app (asset con hash nel nome: restano validi finché
// non cambiano d'indirizzo); le revisioni vecchie vengono eliminate da sole.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Le cache del VECCHIO sw.js a mano ("navta-cache-*") vanno eliminate
// esplicitamente: Workbox pulisce solo le proprie.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith("navta-cache-")).map((k) => caches.delete(k))),
    ),
  );
});

// Navigazione network-first (stessa scelta del vecchio SW: con la rete l'app
// è sempre fresca al primo caricamento); offline si ricade sulla shell
// precache-ata, disponibile anche al primissimo avvio senza rete.
const navFallback = createHandlerBoundToURL(import.meta.env.BASE_URL + "index.html");
const navStrategy = new NetworkFirst({ cacheName: "navta-pages", networkTimeoutSeconds: 3 });
registerRoute(
  new NavigationRoute(async (params) => {
    try {
      return await navStrategy.handle(params);
    } catch {
      return navFallback(params);
    }
  }),
);

// Tessere/stili/glyph di MapTiler: cache-first con tetto — offline il globo
// mostra le zone già viste invece di restare nero. purgeOnQuotaError: se lo
// spazio finisce, si sacrifica questa cache (ricostruibile), mai il precache.
registerRoute(
  ({ url }) => url.hostname === "api.maptiler.com",
  new CacheFirst({
    cacheName: "navta-tiles",
    plugins: [new ExpirationPlugin({ maxEntries: 500, maxAgeSeconds: 30 * 24 * 3600, purgeOnQuotaError: true })],
  }),
);
