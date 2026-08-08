import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { useModalFocus } from "./useModalFocus";

/**
 * I pannelli a schermo intero dichiaravano aria-modal="true" ma il Tab usciva
 * verso la pagina sotto, e alla chiusura il focus finiva nel nulla.
 */

function Modale({ onClose }: { onClose: () => void }) {
  const ref = useModalFocus<HTMLDivElement>();
  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-label="Pannello">
      <button>Primo</button>
      <button>Secondo</button>
      <button onClick={onClose}>Chiudi</button>
    </div>
  );
}

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(true)}>Apri pannello</button>
      <button>Fuori</button>
      {open && <Modale onClose={() => setOpen(false)} />}
    </div>
  );
}

describe("useModalFocus", () => {
  // Il focus va sul pannello, NON sul suo primo controllo: quello è quasi
  // sempre la X, e partire da lì sembra un invito a chiudere; su telefono un
  // campo aprirebbe la tastiera.
  it("all'apertura il focus va sul pannello, non sul primo pulsante", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("Apri pannello"));
    const dialog = screen.getByRole("dialog");
    expect(document.activeElement).toBe(dialog);
    expect(document.activeElement).not.toBe(screen.getByText("Primo"));
  });

  it("dal pannello il Tab entra comunque nei controlli", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("Apri pannello"));
    // Con il focus sul contenitore il Tab prosegue naturalmente nel primo
    // controllo: la guardia scatta solo agli estremi.
    fireEvent.keyDown(document, { key: "Tab" });
    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);
  });

  it("alla chiusura il focus torna a chi ha aperto", () => {
    render(<Harness />);
    const trigger = screen.getByText("Apri pannello");
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByText("Chiudi"));
    expect(document.activeElement).toBe(trigger);
  });

  it("Tab sull'ultimo controllo torna al primo invece di uscire", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("Apri pannello"));
    const chiudi = screen.getByText("Chiudi");
    chiudi.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByText("Primo"));
  });

  it("Shift+Tab sul primo controllo va all'ultimo, non fuori", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("Apri pannello"));
    screen.getByText("Primo").focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(screen.getByText("Chiudi"));
  });
});
