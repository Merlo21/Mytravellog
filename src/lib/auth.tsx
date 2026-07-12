import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { User } from "@supabase/supabase-js";

const REMEMBER_SESSION_KEY = "navta.remember_me";

interface AuthResult {
  error?: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string, remember: boolean) => Promise<AuthResult>;
  signUp: (email: string, password: string, remember: boolean) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// @supabase/supabase-js pesa ~217KB gzip: caricarlo staticamente qui
// rimetterebbe nel bundle iniziale il peso che il code-splitting delle
// route aveva già tolto (ogni pagina passa da qui, dato che AuthProvider
// avvolge l'intera app). Import dinamico: si scarica appena il primo
// componente monta, non prima, e resta in un chunk separato.
function getSupabase() {
  return import("@/integrations/supabase/client").then(m => m.supabase);
}

function mapAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Email o password non corretti.";
  if (m.includes("already registered") || m.includes("already exists") || m.includes("user already")) {
    return "Esiste già un account con questa email.";
  }
  if (m.includes("password") && m.includes("6")) return "La password deve avere almeno 6 caratteri.";
  return "Si è verificato un errore. Riprova.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | undefined;

    getSupabase().then(supabase => {
      if (!mounted) return;
      supabase.auth.getSession().then(({ data }) => {
        if (!mounted) return;
        setUser(data.session?.user ?? null);
        setLoading(false);
      });
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        if (mounted) setUser(session?.user ?? null);
      });
      unsubscribe = () => sub.subscription.unsubscribe();
    });

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  const signIn = async (email: string, password: string, remember: boolean): Promise<AuthResult> => {
    localStorage.setItem(REMEMBER_SESSION_KEY, String(remember));
    const supabase = await getSupabase();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { error: mapAuthError(error.message) } : {};
  };

  const signUp = async (email: string, password: string, remember: boolean): Promise<AuthResult> => {
    localStorage.setItem(REMEMBER_SESSION_KEY, String(remember));
    const supabase = await getSupabase();
    const { error } = await supabase.auth.signUp({ email, password });
    return error ? { error: mapAuthError(error.message) } : {};
  };

  const signOut = async () => {
    const supabase = await getSupabase();
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve essere usato dentro <AuthProvider>");
  return ctx;
}
