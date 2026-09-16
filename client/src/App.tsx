import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type PersonView } from "./lib/api";

export function App() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PersonView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); setSearched(false); return; }
    const t = setTimeout(() => {
      setError(null);
      api<{ results: PersonView[] }>(`/api/people/search?q=${encodeURIComponent(q)}`)
        .then((d) => { setResults(d.results); setSearched(true); })
        .catch((e: Error) => setError(e.message));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="wrap">
      <h1>Kinweb</h1>
      <p className="sub">One shared family web, built one true connection at a time.</p>

      <div className="row">
        <input
          id="search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name…"
          aria-label="Search for a person by name"
        />
      </div>

      {error && <p className="err">{error}</p>}

      <div className="list">
        {results.map((p) => <PersonCard key={p.id} person={p} />)}
      </div>

      {searched && results.length === 0 && !error && (
        <p className="empty">No profiles match that you're able to see.</p>
      )}

      <p className="note">
        Search only returns profiles you're entitled to see. Profiles of living people
        default to family-only, profiles of under-18s are never searchable by anyone,
        and a profile whose subject has asked to be removed shows nothing at all.
      </p>
    </div>
  );
}

export function PersonCard({ person }: { person: PersonView }) {
  if (person.visibility === "LOCKED") {
    return (
      <div className="card">
        <div className="name locked">Profile removed at this person's request</div>
        <div className="meta">Their connections are kept so the web stays intact.</div>
      </div>
    );
  }
  const years = [person.birthYear ?? null, person.deathYear ?? null];
  const lifespan = years[0] || years[1] ? `${years[0] ?? "?"} – ${years[1] ?? ""}`.trim() : null;

  return (
    <Link className="card" to={`/p/${person.id}`}>
      <div className="name">
        {person.displayName}
        {person.visibility === "LIMITED" && <span className="tag">limited</span>}
        {person.claimed && <span className="tag">claimed</span>}
      </div>
      <div className="meta">
        {person.visibility === "LIMITED"
          ? "Connected to the web — details visible to family only."
          : lifespan ?? "No dates recorded."}
      </div>
    </Link>
  );
}
