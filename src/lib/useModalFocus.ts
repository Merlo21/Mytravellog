import { useEffect, useRef } from "react";

const FOCUSABLE = [
  "a[href]", "button:not([disabled])", "input:not([disabled])",
  "textarea:not([disabled])", "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Tiene il focus dentro un pannello a schermo intero finché è aperto, e lo
 * restituisce a chi l'ha aperto quando si chiude.
 *
 * Serviva: i pannelli dell'app dichiaravano `aria-modal="true"` ma il Tab
 * usciva tranquillamente verso la pagina sottostante — una promessa non
 * mantenuta. E alla chiusura il focus finiva sul nulla (body), costringendo
 * chi naviga da tastiera a ripartire dall'inizio della pagina.
 *
 * Uso: `const ref = useModalFocus(true); <div ref={ref} role="dialog" …>`
 */
export function useModalFocus<T extends HTMLElement = HTMLDivElement>(active = true) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    if (!node) return;

    // Chi aveva il focus prima dell'apertura: lì va restituito alla chiusura.
    const previous = document.activeElement as HTMLElement | null;

    // Visibilità via stile calcolato, NON via offsetParent: jsdom non fa
    // layout e offsetParent è sempre null, quindi lì scarterebbe tutto.
    const visible = (el: HTMLElement) => {
      if (el.hasAttribute("hidden") || el.getAttribute("aria-hidden") === "true") return false;
      const s = getComputedStyle(el);
      return s.display !== "none" && s.visibility !== "hidden";
    };
    const focusables = () =>
      Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(visible);

    // Il focus va sul PANNELLO, non sul suo primo controllo: quello è quasi
    // sempre la X in alto, e partire da lì sembra un invito a chiudere. Su
    // telefono, poi, dare il focus a un campo aprirebbe subito la tastiera
    // coprendo mezzo schermo. Da qui il primo Tab entra comunque nei controlli.
    node.setAttribute("tabindex", "-1");
    node.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const list = focusables();
      if (list.length === 0) { e.preventDefault(); return; }
      const firstEl = list[0], lastEl = list[list.length - 1];
      // Il ciclo va chiuso a mano: il browser da solo uscirebbe dal pannello.
      if (e.shiftKey && (document.activeElement === firstEl || !node.contains(document.activeElement))) {
        e.preventDefault(); lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault(); firstEl.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      // isConnected: se chi ha aperto il pannello nel frattempo è sparito dal
      // DOM, dargli il focus non farebbe nulla di utile.
      if (previous && previous.isConnected) previous.focus();
    };
  }, [active]);

  return ref;
}
