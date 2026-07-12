import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { AuthProvider, useAuth } from "./auth";
import React from "react";

const mockSignInWithPassword = vi.fn();
const mockSignUp = vi.fn();
const mockSignOut = vi.fn();
const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signUp: (...args: unknown[]) => mockSignUp(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
      getSession: (...args: unknown[]) => mockGetSession(...args),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
    },
  },
}));

function TestConsumer() {
  const { user, loading, signIn, signUp, signOut } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user-email">{user?.email ?? "nessuno"}</span>
      <button onClick={() => signIn("a@b.com", "password123", true)}>login</button>
      <button onClick={() => signUp("a@b.com", "password123", false)}>signup</button>
      <button onClick={() => signOut()}>logout</button>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <AuthProvider>
      <TestConsumer/>
    </AuthProvider>
  );
}

describe("AuthProvider / useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  });

  it("parte con loading=true e poi passa a false dopo getSession", async () => {
    renderWithProvider();
    expect(screen.getByTestId("loading").textContent).toBe("true");
    await act(async () => {});
    expect(screen.getByTestId("loading").textContent).toBe("false");
  });

  it("nessun utente all'avvio se getSession non ha una sessione", async () => {
    renderWithProvider();
    await act(async () => {});
    expect(screen.getByTestId("user-email").textContent).toBe("nessuno");
  });

  it("mostra l'utente se getSession ritorna una sessione esistente", async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { email: "già-loggato@test.it" } } } });
    renderWithProvider();
    await act(async () => {});
    expect(screen.getByTestId("user-email").textContent).toBe("già-loggato@test.it");
  });

  it("signIn imposta il flag 'ricordami' su localStorage prima della chiamata", async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null });
    renderWithProvider();
    await act(async () => {});
    await act(async () => { screen.getByText("login").click(); });
    expect(localStorage.getItem("navta.remember_me")).toBe("true");
    expect(mockSignInWithPassword).toHaveBeenCalledWith({ email: "a@b.com", password: "password123" });
  });

  it("signUp imposta remember=false quando richiesto", async () => {
    mockSignUp.mockResolvedValue({ error: null });
    renderWithProvider();
    await act(async () => {});
    await act(async () => { screen.getByText("signup").click(); });
    expect(localStorage.getItem("navta.remember_me")).toBe("false");
  });

  it("signIn con errore ritorna un messaggio in italiano leggibile", async () => {
    mockSignInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    let result: { error?: string } | undefined;
    function Capture() {
      const { signIn } = useAuth();
      return <button onClick={async () => { result = await signIn("a@b.com", "wrong", true); }}>go</button>;
    }
    render(<AuthProvider><Capture/></AuthProvider>);
    await act(async () => {});
    await act(async () => { screen.getByText("go").click(); });
    expect(result?.error).toBe("Email o password non corretti.");
  });

  it("signOut chiama supabase.auth.signOut", async () => {
    mockSignOut.mockResolvedValue({ error: null });
    renderWithProvider();
    await act(async () => {});
    await act(async () => { screen.getByText("logout").click(); });
    expect(mockSignOut).toHaveBeenCalled();
  });

  it("useAuth fuori da AuthProvider lancia un errore chiaro", () => {
    const Broken = () => { useAuth(); return null; };
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Broken/>)).toThrow(/AuthProvider/);
    spy.mockRestore();
  });
});
