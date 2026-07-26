import { describe, it, expect, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppHeader } from "./AppHeader";

// La nav è ora un unico menu a tendina (hamburger) ovunque, desktop = mobile.
// Radix DropdownMenu in jsdom richiede questi stub per aprirsi, e va aperto via
// tastiera (i pointer sintetici non bastano) — vedi reference_radix_dropdown_jsdom_test.
beforeAll(() => {
  const p = window.HTMLElement.prototype as any;
  if (!p.hasPointerCapture) p.hasPointerCapture = () => false;
  if (!p.releasePointerCapture) p.releasePointerCapture = () => {};
  if (!p.scrollIntoView) p.scrollIntoView = () => {};
  if (!(window as any).ResizeObserver) (window as any).ResizeObserver = class { observe(){} unobserve(){} disconnect(){} };
  if (!(window as any).matchMedia) (window as any).matchMedia = () => ({ matches: false, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} });
});

function mount() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppHeader />
    </MemoryRouter>
  );
}

/** Apre il menu hamburger (via tastiera, affidabile in jsdom). */
function openMenu() {
  fireEvent.keyDown(screen.getByRole("button", { name: "Menu" }), { key: "Enter" });
}

describe("AppHeader", () => {
  it("mostra il logo NAV·TA", () => {
    mount();
    expect(screen.getByText("NAV")).toBeInTheDocument();
    expect(screen.getByText("TA")).toBeInTheDocument();
  });

  it("il menu contiene i link a viaggi, statistiche, impostazioni, nuovo viaggio, importa GPX", () => {
    mount();
    openMenu();
    // Radix rende le voci-link con role="menuitem" (non "link").
    expect(screen.getByRole("menuitem", { name: /I miei viaggi/i })).toHaveAttribute("href", "/miei-viaggi");
    expect(screen.getByRole("menuitem", { name: /Statistiche/i })).toHaveAttribute("href", "/statistiche");
    expect(screen.getByRole("menuitem", { name: /Impostazioni/i })).toHaveAttribute("href", "/impostazioni");
    expect(screen.getByRole("menuitem", { name: /Nuovo viaggio/i })).toHaveAttribute("href", "/nuovo-viaggio");
    expect(screen.getByRole("menuitem", { name: /Importa da GPX/i })).toHaveAttribute("href", "/importa-gpx");
  });

  it("logo linka alla home", () => {
    mount();
    const homeLinks = screen.getAllByRole("link").filter(a => a.getAttribute("href") === "/");
    expect(homeLinks.length).toBeGreaterThan(0);
  });
});
