import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import NotFound from "./NotFound";

describe("NotFound", () => {
  let errSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { errSpy = vi.spyOn(console, "error").mockImplementation(() => {}); });
  afterEach(() => { errSpy.mockRestore(); });

  const future = { v7_startTransition: true, v7_relativeSplatPath: true } as const;

  it("mostra il messaggio 404", () => {
    render(<MemoryRouter initialEntries={["/rotta-inesistente"]} future={future}><NotFound /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "404" })).toBeInTheDocument();
    expect(screen.getByText(/Page not found/i)).toBeInTheDocument();
  });

  it("propone il link di ritorno alla home", () => {
    render(<MemoryRouter future={future}><NotFound /></MemoryRouter>);
    expect(screen.getByRole("link", { name: /Return to Home/i })).toHaveAttribute("href", "/");
  });

  it("logga un errore con il pathname", () => {
    render(<MemoryRouter initialEntries={["/foo/bar"]} future={future}><NotFound /></MemoryRouter>);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining("404"), "/foo/bar");
  });
});
