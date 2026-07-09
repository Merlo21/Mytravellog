import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { NavLink } from "./NavLink";

function mount(initial: string) {
  return render(
    <MemoryRouter initialEntries={[initial]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <NavLink to="/a" className="base" activeClassName="on">A</NavLink>
              <NavLink to="/b" className="base" activeClassName="on">B</NavLink>
            </>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("NavLink", () => {
  it("renderizza i figli come anchor", () => {
    mount("/");
    const a = screen.getByText("A");
    expect(a.tagName).toBe("A");
    expect(a).toHaveAttribute("href", "/a");
  });

  it("applica activeClassName sulla rotta corrente", () => {
    mount("/a");
    expect(screen.getByText("A").className).toContain("on");
    expect(screen.getByText("B").className).not.toContain("on");
  });

  it("mantiene className di base sempre", () => {
    mount("/b");
    expect(screen.getByText("A").className).toContain("base");
    expect(screen.getByText("B").className).toContain("base");
  });
});
