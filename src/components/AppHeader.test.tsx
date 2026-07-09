import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppHeader } from "./AppHeader";

function mount() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppHeader />
    </MemoryRouter>
  );
}

describe("AppHeader", () => {
  it("mostra il logo NAV·TA", () => {
    mount();
    expect(screen.getByText("NAV")).toBeInTheDocument();
    expect(screen.getByText("TA")).toBeInTheDocument();
  });

  it("contiene link ai viaggi, statistiche, impostazioni, nuovo viaggio", () => {
    mount();
    expect(screen.getByRole("link", { name: /I miei viaggi/i })).toHaveAttribute("href", "/miei-viaggi");
    expect(screen.getByRole("link", { name: /Statistiche/i })).toHaveAttribute("href", "/statistiche");
    expect(screen.getByRole("link", { name: /Impostazioni/i })).toHaveAttribute("href", "/impostazioni");
    expect(screen.getByRole("link", { name: /Nuovo viaggio/i })).toHaveAttribute("href", "/nuovo-viaggio");
  });

  it("logo linka alla home", () => {
    mount();
    const homeLinks = screen.getAllByRole("link").filter(a => a.getAttribute("href") === "/");
    expect(homeLinks.length).toBeGreaterThan(0);
  });
});
