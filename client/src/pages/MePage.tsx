import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { api, type PersonView } from "../lib/api";
import { useAuth } from "../lib/auth";
import { PersonCard } from "../App";

export function MePage() {
  const { user, ready } = useAuth();
  const [mine, setMine] = useState<PersonView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api<{ people: PersonView[] }>("/api/people/mine")
      .then((d) => setMine(d.people))
      .catch((e: Error) => setError(e.message));
  }, [user]);

  if (!ready) return <p className="empty">Loading…</p>;
  if (!user) return <Navigate to="/signin" replace />;

  return (
    <>
      <h1>Hello, {user.displayName}</h1>
      <p className="sub">Your place in the web, and everyone you've connected to it.</p>
      {error && <p className="err">{error}</p>}
      {mine === null && !error && <p className="empty">Loading…</p>}
      {mine && mine.length === 0 && <CreateSelf defaultName={user.displayName} />}
      {mine && mine.length > 0 && (
        <>
          <h2 className="h2">Your profile</h2>
          <div className="list">
            {mine.map((p) => <PersonCard key={p.id} person={p} />)}
          </div>
          <p className="note">
            Open your profile to add parents, children, a spouse or siblings. Each relative
            you add becomes part of your family web, and you'll be able to find them in search.
          </p>
        </>
      )}
    </>
  );
}

function CreateSelf({ defaultName }: { defaultName: string }) {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(defaultName);
  const [birthYear, setBirthYear] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const d = await api<{ person: PersonView }>("/api/people", {
        method: "POST",
        body: JSON.stringify({
          displayName: displayName.trim(),
          birthYear: birthYear ? Number(birthYear) : null,
          bio: bio.trim() || null,
          claimAsSelf: true,
        }),
      });
      navigate(`/p/${d.person.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <h2 className="h2" style={{ marginTop: 0 }}>Step 1 — add yourself</h2>
      <p className="meta">
        Your profile is the centre of your web. It starts <strong>family-only</strong>: only
        relatives you're connected to can see it.
      </p>
      <form className="form" onSubmit={onSubmit}>
        <label>
          Full name
          <input type="text" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </label>
        <label>
          Birth year <span className="hint">(optional)</span>
          <input type="number" min={1000} max={2200} value={birthYear}
            onChange={(e) => setBirthYear(e.target.value)} placeholder="e.g. 1990" />
        </label>
        <label>
          A line about you <span className="hint">(optional)</span>
          <textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={2000} />
        </label>
        {error && <p className="err">{error}</p>}
        <button type="submit" disabled={busy || !displayName.trim()}>
          {busy ? "Saving…" : "Create my profile"}
        </button>
      </form>
    </div>
  );
}
