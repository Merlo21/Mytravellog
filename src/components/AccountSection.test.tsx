import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AccountSection } from "./AccountSection";
import * as authModule from "@/lib/auth";
import React from "react";

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return { ...actual, useAuth: vi.fn() };
});

const mockUseAuth = authModule.useAuth as unknown as ReturnType<typeof vi.fn>;

function setAuthState(overrides: Partial<ReturnType<typeof authModule.useAuth>> = {}) {
  mockUseAuth.mockReturnValue({
    user: null,
    loading: false,
    signIn: vi.fn().mockResolvedValue({}),
    signUp: vi.fn().mockResolvedValue({}),
    signOut: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  });
}

describe("AccountSection", () => {
  beforeEach(() => { mockUseAuth.mockReset(); });

  it("mostra un loader mentre loading=true", () => {
    setAuthState({ loading: true });
    const { container } = render(<AccountSection/>);
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("mostra email utente e bottone Esci quando loggato", () => {
    setAuthState({ user: { email: "utente@test.it" } as any });
    render(<AccountSection/>);
    expect(screen.getByText("utente@test.it")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /esci/i })).toBeInTheDocument();
  });

  it("click su Esci chiama signOut", () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    setAuthState({ user: { email: "utente@test.it" } as any, signOut });
    render(<AccountSection/>);
    fireEvent.click(screen.getByRole("button", { name: /esci/i }));
    expect(signOut).toHaveBeenCalled();
  });

  it("mostra il form di login quando non loggato", () => {
    setAuthState();
    render(<AccountSection/>);
    expect(screen.getByPlaceholderText("Email")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accedi" })).toBeInTheDocument();
  });

  it("valida l'email prima di chiamare signIn", async () => {
    const signIn = vi.fn();
    setAuthState({ signIn });
    render(<AccountSection/>);
    fireEvent.change(screen.getByPlaceholderText("Email"), { target: { value: "non-una-email" } });
    fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "Accedi" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/email valida/i);
    expect(signIn).not.toHaveBeenCalled();
  });

  it("valida la lunghezza minima della password", async () => {
    const signIn = vi.fn();
    setAuthState({ signIn });
    render(<AccountSection/>);
    fireEvent.change(screen.getByPlaceholderText("Email"), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: "123" } });
    fireEvent.click(screen.getByRole("button", { name: "Accedi" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/6 caratteri/i);
    expect(signIn).not.toHaveBeenCalled();
  });

  it("con dati validi chiama signIn con email, password e remember", async () => {
    const signIn = vi.fn().mockResolvedValue({});
    setAuthState({ signIn });
    render(<AccountSection/>);
    fireEvent.change(screen.getByPlaceholderText("Email"), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "Accedi" }));
    await waitFor(() => expect(signIn).toHaveBeenCalledWith("a@b.com", "password123", true));
  });

  it("deselezionando 'Ricordami' passa remember=false", async () => {
    const signIn = vi.fn().mockResolvedValue({});
    setAuthState({ signIn });
    render(<AccountSection/>);
    fireEvent.click(screen.getByLabelText("Ricordami"));
    fireEvent.change(screen.getByPlaceholderText("Email"), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "Accedi" }));
    await waitFor(() => expect(signIn).toHaveBeenCalledWith("a@b.com", "password123", false));
  });

  it("mostra l'errore restituito da signIn", async () => {
    const signIn = vi.fn().mockResolvedValue({ error: "Email o password non corretti." });
    setAuthState({ signIn });
    render(<AccountSection/>);
    fireEvent.change(screen.getByPlaceholderText("Email"), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "Accedi" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Email o password non corretti.");
  });

  it("passa da login a registrazione cliccando il link di switch", () => {
    setAuthState();
    render(<AccountSection/>);
    fireEvent.click(screen.getByText(/non hai un account/i));
    expect(screen.getByRole("button", { name: "Registrati" })).toBeInTheDocument();
  });

  it("dopo una registrazione riuscita mostra il messaggio di conferma email", async () => {
    const signUp = vi.fn().mockResolvedValue({});
    setAuthState({ signUp });
    render(<AccountSection/>);
    fireEvent.click(screen.getByText(/non hai un account/i));
    fireEvent.change(screen.getByPlaceholderText("Email"), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrati" }));
    expect(await screen.findByText(/controlla la tua email/i)).toBeInTheDocument();
  });
});
