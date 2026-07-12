import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Loader2, AlertCircle, LogOut } from "lucide-react";
import { BackupSection } from "@/components/BackupSection";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AccountSection() {
  const { user, loading, signIn, signUp, signOut } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signedUpMessage, setSignedUpMessage] = useState(false);

  if (loading) {
    return <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />;
  }

  if (user) {
    return (
      <div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">{user.email}</span>
          <button
            onClick={() => signOut()}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-destructive hover:opacity-80 transition-opacity"
          >
            <LogOut className="w-3.5 h-3.5" /> Esci
          </button>
        </div>
        <BackupSection userId={user.id} />
      </div>
    );
  }

  const validate = (): string | null => {
    if (!EMAIL_RE.test(email.trim())) return "Inserisci un'email valida.";
    if (password.length < 6) return "La password deve avere almeno 6 caratteri.";
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    setError(null);
    setSignedUpMessage(false);
    setSubmitting(true);
    const action = mode === "login" ? signIn : signUp;
    const result = await action(email.trim(), password, remember);
    setSubmitting(false);
    if (result.error) setError(result.error);
    else if (mode === "signup") setSignedUpMessage(true);
  };

  const inputCls = "w-full bg-secondary/20 border border-border rounded-xl px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary";

  return (
    <div className="space-y-3">
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="Email"
        autoComplete="email"
        className={inputCls}
      />
      <input
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        placeholder="Password"
        autoComplete={mode === "login" ? "current-password" : "new-password"}
        className={inputCls}
      />
      <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
        <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} className="accent-primary" />
        Ricordami
      </label>

      {error && (
        <p role="alert" className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> {error}
        </p>
      )}
      {signedUpMessage && (
        <p className="text-xs text-primary">Controlla la tua email per confermare l'account.</p>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground disabled:opacity-60"
      >
        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
        {mode === "login" ? "Accedi" : "Registrati"}
      </button>

      <button
        type="button"
        onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); setSignedUpMessage(false); }}
        className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {mode === "login" ? "Non hai un account? Registrati" : "Hai già un account? Accedi"}
      </button>
    </div>
  );
}
