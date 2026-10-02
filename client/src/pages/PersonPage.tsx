import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type PersonView, type WebEdge } from "../lib/api";
import { PersonCard } from "../App";

export function PersonPage() {
  const { id } = useParams<{ id: string }>();
  const [person, setPerson] = useState<PersonView | null>(null);
  const [nodes, setNodes] = useState<PersonView[]>([]);
  const [edges, setEdges] = useState<WebEdge[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setError(null);
    api<{ person: PersonView }>(`/api/people/${id}`)
      .then((d) => setPerson(d.person))
      .catch((e: Error) => setError(e.message));
    api<{ nodes: PersonView[]; edges: WebEdge[] }>(`/api/people/${id}/web`)
      .then((d) => { setNodes(d.nodes); setEdges(d.edges); })
      .catch(() => { /* the web is supplementary; the profile still renders */ });
  }, [id]);

  if (error) return <div className="wrap"><p className="err">{error}</p><Link to="/">Back</Link></div>;
  if (!person) return <div className="wrap"><p className="empty">Loading…</p></div>;

  if (person.visibility === "LOCKED") {
    return (
      <div className="wrap">
        <p className="locked">This profile was removed at the subject's request.</p>
        <Link to="/">Back to search</Link>
      </div>
    );
  }

  const relatives = nodes.filter((n) => n.id !== person.id);

  return (
    <div className="wrap">
      <Link to="/">← Search</Link>
      <h1 style={{ marginTop: 16 }}>{person.displayName}</h1>
      <p className="sub">
        {person.birthYear ?? "?"} – {person.deathYear ?? "present"}
        {person.visibility === "LIMITED" && <span className="tag">limited view</span>}
      </p>

      {person.photoUrl && (
        <img src={person.photoUrl} alt="" style={{ maxWidth: 180, borderRadius: 10 }} />
      )}
      {person.bio && <p>{person.bio}</p>}

      <h2 style={{ fontSize: 17, marginTop: 28 }}>
        Connected relatives <span className="tag">{relatives.length}</span>
      </h2>
      <div className="list">
        {relatives.map((p) => <PersonCard key={p.id} person={p} />)}
      </div>
      {relatives.length === 0 && <p className="empty">No connections visible to you yet.</p>}

      <p className="note">
        {edges.length} connection{edges.length === 1 ? "" : "s"} within two steps.
        The force-directed “web” view is the next thing to build here — this list is
        the same data in its plainest form.
      </p>
    </div>
  );
}
