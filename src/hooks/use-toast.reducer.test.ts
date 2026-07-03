import { describe, it, expect } from "vitest";
import { reducer } from "@/hooks/use-toast";

function makeToast(id: string) {
  return { id, title: "Test " + id, open: true } as any;
}

describe("use-toast reducer", () => {
  const empty = { toasts: [] };

  it("ADD_TOAST aggiunge un toast allo stato", () => {
    const state = reducer(empty, { type: "ADD_TOAST", toast: makeToast("1") });
    expect(state.toasts).toHaveLength(1);
    expect(state.toasts[0].id).toBe("1");
  });

  it("ADD_TOAST rispetta TOAST_LIMIT=1: aggiungendo 2 ne rimane solo 1", () => {
    let state = reducer(empty, { type: "ADD_TOAST", toast: makeToast("1") });
    state = reducer(state, { type: "ADD_TOAST", toast: makeToast("2") });
    expect(state.toasts).toHaveLength(1);
    // Il più recente è in testa
    expect(state.toasts[0].id).toBe("2");
  });

  it("UPDATE_TOAST aggiorna solo il toast con id corrispondente", () => {
    let state = reducer(empty, { type: "ADD_TOAST", toast: makeToast("1") });
    state = reducer(state, { type: "UPDATE_TOAST", toast: { id: "1", title: "Aggiornato" } });
    expect(state.toasts[0].title).toBe("Aggiornato");
    expect(state.toasts[0].id).toBe("1");
  });

  it("DISMISS_TOAST con toastId setta open=false solo su quel toast", () => {
    let state = reducer(empty, { type: "ADD_TOAST", toast: makeToast("1") });
    state = reducer(state, { type: "DISMISS_TOAST", toastId: "1" });
    expect(state.toasts[0].open).toBe(false);
  });

  it("DISMISS_TOAST senza toastId setta open=false su tutti", () => {
    // Con TOAST_LIMIT=1 c'è solo 1 toast alla volta, ma testiamo il comportamento
    let state = reducer(empty, { type: "ADD_TOAST", toast: makeToast("1") });
    state = reducer(state, { type: "DISMISS_TOAST" });
    expect(state.toasts.every(t => t.open === false)).toBe(true);
  });

  it("REMOVE_TOAST con toastId rimuove il toast dall'array", () => {
    let state = reducer(empty, { type: "ADD_TOAST", toast: makeToast("1") });
    state = reducer(state, { type: "REMOVE_TOAST", toastId: "1" });
    expect(state.toasts).toHaveLength(0);
  });

  it("REMOVE_TOAST senza toastId svuota tutto", () => {
    let state = reducer(empty, { type: "ADD_TOAST", toast: makeToast("1") });
    state = reducer(state, { type: "REMOVE_TOAST" });
    expect(state.toasts).toHaveLength(0);
  });
});
