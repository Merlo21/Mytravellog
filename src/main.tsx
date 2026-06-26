import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { SettingsProvider } from "./lib/settings";
import "./index.css";
import Home from "./pages/Index";
import Stats from "./pages/Stats";
import SettingsPage from "./pages/Settings";

const rootEl = document.getElementById("root")!;
rootEl.style.backgroundColor = "#060e1e";
rootEl.style.minHeight = "100vh";
ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <SettingsProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/statistiche" element={<Stats />} />
          <Route path="/impostazioni" element={<SettingsPage />} />
        </Routes>
        <Toaster richColors position="top-right" />
      </HashRouter>
    </SettingsProvider>
  </React.StrictMode>
);
