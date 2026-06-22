import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { SettingsProvider } from "./lib/settings";
import "./index.css";
import Home from "./pages/Home";
import Stats from "./pages/Stats";
import SettingsPage from "./pages/Settings";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SettingsProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/statistiche" element={<Stats />} />
          <Route path="/impostazioni" element={<SettingsPage />} />
        </Routes>
        <Toaster richColors position="top-right" />
      </BrowserRouter>
    </SettingsProvider>
  </React.StrictMode>
);
