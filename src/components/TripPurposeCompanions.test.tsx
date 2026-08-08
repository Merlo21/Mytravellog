import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { TripPurposeCompanions } from "./TripPurposeCompanions";
import { saveTrips, Trip } from "@/lib/storage";

// I suggerimenti vengono dai compagni dei viaggi già salvati (loadTrips).
const aTrip = {
  id: "t1", title: "Parigi", trip_date: "2025-01-01", city: "Parigi",
  latitude: 48.86, longitude: 2.35, companions: ["Giulia", "Giuseppe"],
} as unknown as Trip;

/** Harness controllato: lo stato vive nel form, come nell'app reale. */
function Harness() {
  const [purpose, setPurpose] = useState<string | null>(null);
  const [companions, setCompanions] = useState<string[]>([]);
  return (
    <div>
      <TripPurposeCompanions purpose={purpose} setPurpose={setPurpose}
        companions={companions} setCompanions={setCompanions} />
      <output data-testid="companions">{companions.join(",")}</output>
    </div>
  );
}

const input = () => screen.getByPlaceholderText(/Aggiungi un nome/);
const companionsOut = () => screen.getByTestId("companions").textContent;

describe("TripPurposeCompanions — suggerimenti da tastiera", () => {
  beforeEach(() => {
    localStorage.clear();
    saveTrips([aTrip]);
  });

  it("digitando compaiono i suggerimenti, nessuno evidenziato", () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: "giu" } });
    const opts = screen.getAllByRole("option");
    expect(opts.map(o => o.textContent)).toEqual([
      "Giulia · già usato", "Giuseppe · già usato",
    ]);
    expect(opts.every(o => o.getAttribute("aria-selected") === "false")).toBe(true);
  });

  it("frecce + Invio scelgono il suggerimento evidenziato (con wrap-around)", () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: "giu" } });
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    expect(screen.getAllByRole("option")[1].getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(input(), { key: "ArrowDown" }); // wrap → di nuovo il primo
    expect(screen.getAllByRole("option")[0].getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(companionsOut()).toBe("Giulia");
    expect((input() as HTMLInputElement).value).toBe("");
  });

  it("Invio senza evidenziazione aggiunge il testo digitato (comportamento storico)", () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: "Marco" } });
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(companionsOut()).toBe("Marco");
  });

  it("Escape chiude la lista; riprendere a digitare la riapre", () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: "giu" } });
    fireEvent.keyDown(input(), { key: "Escape" });
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    fireEvent.change(input(), { target: { value: "giul" } });
    expect(screen.getAllByRole("option")).toHaveLength(1);
  });

  it("il mouse continua a funzionare come prima (mousedown, non click)", () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: "giu" } });
    fireEvent.mouseDown(screen.getAllByRole("option")[1]);
    expect(companionsOut()).toBe("Giuseppe");
  });
});
