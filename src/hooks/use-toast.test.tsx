import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useToast, toast } from "./use-toast";

describe("useToast — API pubblica", () => {
  beforeEach(() => {
    // svuota lo stato residuo tra i test
    const { result } = renderHook(() => useToast());
    act(() => result.current.dismiss());
  });

  it("aggiunge un toast con titolo e descrizione", () => {
    const { result } = renderHook(() => useToast());
    act(() => { toast({ title: "Ciao", description: "Mondo" }); });
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].title).toBe("Ciao");
    expect(result.current.toasts[0].description).toBe("Mondo");
    expect(result.current.toasts[0].open).toBe(true);
  });

  it("rispetta il limite di 1 toast simultaneo", () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      toast({ title: "A" });
      toast({ title: "B" });
      toast({ title: "C" });
    });
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].title).toBe("C");
  });

  it("dismiss mette open=false", () => {
    const { result } = renderHook(() => useToast());
    let handle: ReturnType<typeof toast>;
    act(() => { handle = toast({ title: "X" }); });
    act(() => { handle!.dismiss(); });
    expect(result.current.toasts[0].open).toBe(false);
  });

  it("update modifica un toast esistente", () => {
    const { result } = renderHook(() => useToast());
    let handle: ReturnType<typeof toast>;
    act(() => { handle = toast({ title: "Prima" }); });
    act(() => { handle!.update({ id: handle!.id, title: "Dopo" } as any); });
    expect(result.current.toasts[0].title).toBe("Dopo");
  });

  it("dismiss senza id chiude tutti i toast", () => {
    const { result } = renderHook(() => useToast());
    act(() => { toast({ title: "X" }); });
    act(() => { result.current.dismiss(); });
    expect(result.current.toasts.every(t => t.open === false)).toBe(true);
  });
});
