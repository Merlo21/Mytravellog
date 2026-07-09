import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import NotFound from "@/pages/NotFound";

// Mirrors the route table in src/main.tsx. Pages other than NotFound are
// mocked out: this test only guards the catch-all wiring, not page content.
vi.mock("@/pages/Index", () => ({ default: () => <div>Home</div> }));
vi.mock("@/pages/Stats", () => ({ default: () => <div>Stats</div> }));
vi.mock("@/pages/NuovoViaggio", () => ({ default: () => <div>NuovoViaggio</div> }));
vi.mock("@/pages/ModificaViaggio", () => ({ default: () => <div>ModificaViaggio</div> }));
vi.mock("@/pages/Settings", () => ({ default: () => <div>Settings</div> }));
vi.mock("@/pages/MieiViaggi", () => ({ default: () => <div>MieiViaggi</div> }));

import Home from "@/pages/Index";
import Stats from "@/pages/Stats";
import NuovoViaggio from "@/pages/NuovoViaggio";
import ModificaViaggio from "@/pages/ModificaViaggio";
import SettingsPage from "@/pages/Settings";
import MieiViaggi from "@/pages/MieiViaggi";

function renderAppRoutes(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/statistiche" element={<Stats />} />
        <Route path="/impostazioni" element={<SettingsPage />} />
        <Route path="/nuovo-viaggio" element={<NuovoViaggio />} />
        <Route path="/modifica-viaggio/:id" element={<ModificaViaggio />} />
        <Route path="/miei-viaggi" element={<MieiViaggi />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("Route table (src/main.tsx) — catch-all 404", () => {
  it("mostra la pagina NotFound su una rotta non esistente", () => {
    renderAppRoutes("/questa-rotta-non-esiste");
    expect(screen.getByRole("heading", { name: "404" })).toBeInTheDocument();
  });

  it("mostra la home su '/' (non finisce sul catch-all)", () => {
    renderAppRoutes("/");
    expect(screen.getByText("Home")).toBeInTheDocument();
  });
});
