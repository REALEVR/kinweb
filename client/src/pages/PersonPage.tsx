import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type PersonView, type WebEdge } from "../lib/api";
import { useAuth } from "../lib/auth";
import { PersonCard } from "../App";

type Relation = "PARENT" | "CHILD" | "SPOUSE" | "SIBLING";

const RELATION_LABEL: Record<Relation, string> = {
  PARENT: "Parent",
  CHILD: "Child",
  SPOUSE: "Spouse / partner",
  SIBLING: "Sibling",
};

/** How `other` relates to `self`, read from a direct edge (PARENT: a is parent of b). */
function relationTo(selfId: string, otherId: string, edges: WebEdge[]): Relation | null {
  for (const e of edges) {
    if (e.type === "PARENT") {
      if (e.a === otherId && e.b === selfId) return "PARENT";
      if (e.a === selfId && e.b === otherId) return "CHILD";
    } else if ((e.a === selfId && e.b === otherId) || (e.b === selfId && e.a === otherId)) {
      return e.type as Relation;
    }
  }
  return null;
}

interface ProfileResponse { person: PersonView; mine: boolean; privacyTier?: string }

export function PersonPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [nodes, setNodes] = useState<PersonView[]>([]);
  const [edges, setEdges] = useState<WebEdge[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    setError(null);
    api<ProfileResponse>(`/api/people/${id}`)
      .then(setProfile)
      .catch((e: Error) => setError(e.message));
    api<{ nodes: PersonView[]; edges: WebEdge[] }>(`/api/people/${id}/web`)
      .then((d) => { setNodes(d.nodes); setEdges(d.edges); })
      .catch(() => { /* the web is supplementary; the profile still renders */ });
  }, [id]);

  // Reload when the signed-in user changes: what they may see changes with it.
  useEffect(load, [load, user?.id]);

  if (error) return <><p className="err">{error}</p><Link to="/">Back to search</Link></>;
  if (!profile) return <p className="empty">Loading…</p>;

  const { person, mine } = profile;

  if (person.visibility === "LOCKED") {
    return (
      <>
        <p className="locked">This profile was removed at the subject's request.</p>
        <Link to="/">Back to search</Link>
      </>
    );
  }

  const others = nodes.filter((n) => n.id !== person.id);
  const direct = others
    .map((n) => ({ n, rel: relationTo(person.id, n.id, edges) }))
    .filter((x): x is { n: PersonView; rel: Relation } => x.rel !== null);
  const directIds = new Set(direct.map((d) => d.n.id));
  const extended = others.filter((n) => !directIds.has(n.id));
  const order: Relation[] = ["PARENT", "SPOUSE", "SIBLING", "CHILD"];
  direct.sort((x, y) => order.indexOf(x.rel) - order.indexOf(y.rel));

  const canEdit = !!user && person.visibility === "FULL";

  return (
    <>
      <Link to={user ? "/me" : "/"} className="back">← {user ? "My family" : "Search"}</Link>

      <div className="profile-head">
        <div className="avatar" aria-hidden="true">{initials(person.displayName)}</div>
        <div>
          <h1>{person.displayName}</h1>
          <p className="sub" style={{ marginBottom: 0 }}>
            {lifespan(person)}
            {mine && <span className="tag tag-accent">you</span>}
            {person.visibility === "LIMITED" && <span className="tag">limited view</span>}
          </p>
        </div>
      </div>

      {person.photoUrl && <img src={person.photoUrl} alt="" className="photo" />}
      {person.bio && <p className="bio">{person.bio}</p>}

      {mine && profile.privacyTier && (
        <PrivacyControl personId={person.id} tier={profile.privacyTier} onChange={load} />
      )}

      <h2 className="h2">Close family <span className="tag">{direct.length}</span></h2>
      {direct.length > 0 ? (
        <div className="list">
          {direct.map(({ n, rel }) => (
            <div key={n.id} className="rel-row">
              <span className="rel-label">{RELATION_LABEL[rel]}</span>
              <PersonCard person={n} />
            </div>
          ))}
        </div>
      ) : (
        <p className="empty">No close family visible to you yet.</p>
      )}

      {canEdit && <AddRelative anchor={person} onAdded={load} />}
      {!user && (
        <p className="note">
          <Link to="/signin">Sign in</Link> to add relatives and see family-only profiles you're connected to.
        </p>
      )}

      {extended.length > 0 && (
        <>
          <h2 className="h2">Wider web <span className="tag">{extended.length}</span></h2>
          <p className="meta">Two steps away: grandparents, in-laws, nieces and nephews.</p>
          <div className="list">
            {extended.map((p) => <PersonCard key={p.id} person={p} />)}
          </div>
        </>
      )}
    </>
  );
}

function AddRelative({ anchor, onAdded }: { anchor: PersonView; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [relation, setRelation] = useState<Relation>("PARENT");
  const [displayName, setDisplayName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [deceased, setDeceased] = useState(false);
  const [deathYear, setDeathYear] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    // PARENT edges are directional (a is parent of b). "Parent" means the new
    // person is the parent, so the edge runs TO the anchor; "Child" runs FROM it.
    const type = relation === "CHILD" ? "PARENT" : relation;
    const direction = relation === "PARENT" ? "TO" : "FROM";
    try {
      const d = await api<{ person: PersonView; mergeSuggestions: number }>(
        `/api/people/${anchor.id}/relatives`,
        {
          method: "POST",
          body: JSON.stringify({
            type,
            direction,
            displayName: displayName.trim(),
            birthYear: birthYear ? Number(birthYear) : null,
            deathYear: deceased && deathYear ? Number(deathYear) : null,
            bio: bio.trim() || null,
          }),
        }
      );
      setNotice(
        `${d.person.displayName} added.` +
          (d.mergeSuggestions > 0
            ? " Someone with the same name is already in Kinweb, so we've flagged a possible duplicate for review."
            : "")
      );
      setDisplayName(""); setBirthYear(""); setDeceased(false); setDeathYear(""); setBio("");
      onAdded();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="add-cta">
        <button onClick={() => setOpen(true)}>+ Add a relative of {firstName(anchor.displayName)}</button>
        {notice && <p className="ok">{notice}</p>}
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h2 className="h2" style={{ margin: 0 }}>Add a relative</h2>
        <button className="btn-ghost" onClick={() => setOpen(false)}>Close</button>
      </div>
      <form className="form" onSubmit={onSubmit}>
        <label>
          They are {firstName(anchor.displayName)}'s…
          <div className="seg" role="radiogroup">
            {(Object.keys(RELATION_LABEL) as Relation[]).map((r) => (
              <button type="button" key={r} role="radio" aria-checked={relation === r}
                className={relation === r ? "seg-btn active" : "seg-btn"} onClick={() => setRelation(r)}>
                {RELATION_LABEL[r]}
              </button>
            ))}
          </div>
        </label>
        <label>
          Full name
          <input type="text" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </label>
        <div className="form-row">
          <label>
            Birth year <span className="hint">(approximate is fine)</span>
            <input type="number" min={1000} max={2200} value={birthYear} onChange={(e) => setBirthYear(e.target.value)} />
          </label>
          <label className="check">
            <input type="checkbox" checked={deceased} onChange={(e) => setDeceased(e.target.checked)} />
            Has passed away
          </label>
          {deceased && (
            <label>
              Year of death
              <input type="number" min={1000} max={2200} value={deathYear} onChange={(e) => setDeathYear(e.target.value)} />
            </label>
          )}
        </div>
        <label>
          Notes <span className="hint">(optional)</span>
          <textarea rows={2} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={2000} />
        </label>
        {error && <p className="err">{error}</p>}
        {notice && <p className="ok">{notice}</p>}
        <p className="meta">
          New profiles are family-only. Only the person themselves can make their profile public
          after claiming it.
        </p>
        <button type="submit" disabled={busy || !displayName.trim()}>
          {busy ? "Adding…" : "Add to the web"}
        </button>
      </form>
    </div>
  );
}

function PrivacyControl({ personId, tier, onChange }: { personId: string; tier: string; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isPublic = tier === "PUBLIC";

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/people/${personId}/privacy`, {
        method: "PATCH",
        body: JSON.stringify({ privacyTier: isPublic ? "FAMILY_ONLY" : "PUBLIC" }),
      });
      onChange();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="privacy">
      <div>
        <div className="name">Visibility: {isPublic ? "Public" : "Family only"}</div>
        <div className="meta">
          {isPublic
            ? "Anyone can find you in search. (Profiles without a birth year, or of under-18s, stay family-only regardless.)"
            : "Only relatives connected to you can see your details."}
        </div>
        {error && <p className="err">{error}</p>}
      </div>
      <button className="btn-ghost" onClick={toggle} disabled={busy}>
        {isPublic ? "Make family-only" : "Make public"}
      </button>
    </div>
  );
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
}
function firstName(name: string): string {
  return name.split(/\s+/)[0] ?? name;
}
function lifespan(p: PersonView): string {
  if (p.visibility !== "FULL") return "Details visible to family only";
  if (!p.birthYear && !p.deathYear) return "No dates recorded";
  return `${p.birthYear ?? "?"} – ${p.deathYear ?? "present"}`;
}
