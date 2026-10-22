import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

export function SignInPage() {
  const { user, signIn, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/me" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signin") await signIn(email, password);
      else await register(email, password, displayName);
      navigate("/me");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <h1>{mode === "signin" ? "Welcome back" : "Start your family web"}</h1>
      <p className="sub">
        {mode === "signin"
          ? "Sign in to see your relatives and keep adding to the web."
          : "Create an account, add yourself, then connect the people you know."}
      </p>

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={mode === "signin"} className={mode === "signin" ? "tab active" : "tab"}
          onClick={() => { setMode("signin"); setError(null); }}>Sign in</button>
        <button role="tab" aria-selected={mode === "register"} className={mode === "register" ? "tab active" : "tab"}
          onClick={() => { setMode("register"); setError(null); }}>Create account</button>
      </div>

      <form className="form" onSubmit={onSubmit}>
        {mode === "register" && (
          <label>
            Your name
            <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Amina Nakato" autoComplete="name" />
          </label>
        )}
        <label>
          Email
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            autoComplete="email" />
        </label>
        <label>
          Password
          <input type="password" required minLength={8} value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "signin" ? "current-password" : "new-password"} />
          {mode === "register" && <span className="hint">At least 8 characters.</span>}
        </label>
        {error && <p className="err">{error}</p>}
        <button type="submit" disabled={busy}>
          {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>
    </div>
  );
}
