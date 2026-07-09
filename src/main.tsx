import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { SettingsProvider } from "./lib/settings";
import "./index.css";
import Home from "./pages/Index";
import Stats from "./pages/Stats";
import NuovoViaggio from "./pages/NuovoViaggio";
import ModificaViaggio from "./pages/ModificaViaggio";
import SettingsPage from "./pages/Settings";
import MieiViaggi from "./pages/MieiViaggi";
import NotFound from "./pages/NotFound";

const rootEl = document.getElementById("root")!;
rootEl.style.backgroundColor = "#060e1e";
rootEl.style.minHeight = "100vh";
ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <SettingsProvider>
      <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/statistiche" element={<Stats />} />
          <Route path="/impostazioni" element={<SettingsPage />} />
          <Route path="/nuovo-viaggio" element={<NuovoViaggio />} />
          <Route path="/modifica-viaggio/:id" element={<ModificaViaggio />} />
          <Route path="/miei-viaggi" element={<MieiViaggi />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Toaster richColors position="top-right" />
      </HashRouter>
    </SettingsProvider>
  </React.StrictMode>
);
