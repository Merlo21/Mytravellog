import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { Loader2 } from "lucide-react";
import { SettingsProvider } from "./lib/settings";
import { AuthProvider } from "./lib/auth";
import "./index.css";

const Home = lazy(() => import("./pages/Index"));
const Stats = lazy(() => import("./pages/Stats"));
const NuovoViaggio = lazy(() => import("./pages/NuovoViaggio"));
const ModificaViaggio = lazy(() => import("./pages/ModificaViaggio"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const MieiViaggi = lazy(() => import("./pages/MieiViaggi"));
const NotFound = lazy(() => import("./pages/NotFound"));

function RouteFallback() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Loader2 className="w-6 h-6 animate-spin" style={{ color: "rgba(255,255,255,0.3)" }} />
    </div>
  );
}

// Solo in produzione: in dev il service worker intercetterebbe le richieste
// dei moduli di Vite e romperebbe l'hot reload.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // installazione PWA non disponibile su questo browser: l'app
      // funziona comunque normalmente, semplicemente senza offline/installabilità.
    });
  });
}

const rootEl = document.getElementById("root")!;
rootEl.style.backgroundColor = "#060e1e";
rootEl.style.minHeight = "100vh";
ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <SettingsProvider>
      <AuthProvider>
        <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/statistiche" element={<Stats />} />
              <Route path="/impostazioni" element={<SettingsPage />} />
              <Route path="/nuovo-viaggio" element={<NuovoViaggio />} />
              <Route path="/modifica-viaggio/:id" element={<ModificaViaggio />} />
              <Route path="/miei-viaggi" element={<MieiViaggi />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          <Toaster richColors position="top-right" />
        </HashRouter>
      </AuthProvider>
    </SettingsProvider>
  </React.StrictMode>
);
