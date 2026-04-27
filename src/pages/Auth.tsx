import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Globe2, Compass } from "lucide-react";

export default function Auth() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/", { replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate("/", { replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        toast.success("Account creato! Sei dentro.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bentornato esploratore!");
      }
    } catch (err: any) {
      toast.error(err.message ?? "Qualcosa è andato storto");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-glow pointer-events-none" />
      <div className="absolute top-10 left-10 opacity-20">
        <Globe2 className="w-72 h-72 text-primary animate-pulse-glow" strokeWidth={0.5} />
      </div>

      <div className="relative w-full max-w-md glass-card p-8 animate-fade-up">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-11 h-11 rounded-xl bg-gradient-aurora flex items-center justify-center shadow-glow">
            <Compass className="w-6 h-6 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Atlas</h1>
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">trip tracker</p>
          </div>
        </div>

        <h2 className="text-3xl font-bold mb-2">
          {mode === "signin" ? "Riprendi il viaggio" : "Inizia a esplorare"}
        </h2>
        <p className="text-muted-foreground mb-6">
          {mode === "signin" ? "Accedi al tuo atlante personale." : "Crea un account in 5 secondi."}
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@mondo.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <Button type="submit" disabled={loading} variant="hero" size="lg" className="w-full">
            {loading ? "Attendi..." : mode === "signin" ? "Accedi" : "Crea account"}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-6 w-full text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          {mode === "signin" ? "Non hai un account? Registrati" : "Hai già un account? Accedi"}
        </button>
      </div>
    </main>
  );
}
