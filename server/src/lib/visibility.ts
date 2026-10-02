/**
 * The privacy gate. Every read path that returns Person data must go through
 * `projectPerson` — the schema defaults mean nothing if a route can bypass this.
 *
 * The rules come straight from the "Privacy & legal" section of
 * docs/PROJECT_BRIEF.md, which calls them the load-bearing wall of the product.
 * They are implemented as code rather than documented as policy because this
 * product stores data about real people who never signed up.
 */

export type PrivacyTier = "FAMILY_ONLY" | "PUBLIC" | "LOCKED";

export interface PersonRecord {
  id: string;
  displayName: string;
  birthYear: number | null;
  birthYearIsExact: boolean;
  deathYear: number | null;
  deathYearIsExact: boolean;
  photoUrl: string | null;
  bio: string | null;
  deceasedNotes: string | null;
  privacyTier: string;
  claimedByUserId: string | null;
  guardianUserId: string | null;
  verified: boolean;
  lockedAt: Date | null;
}

/** Who is asking. `relatedPersonIds` is the viewer's own connected component. */
export interface Viewer {
  userId: string | null;
  /** Person ids the viewer is connected to in the graph (incl. their own node). */
  relatedPersonIds: ReadonlySet<string>;
}

export const ANONYMOUS: Viewer = { userId: null, relatedPersonIds: new Set() };

export const MINOR_AGE = 18;

export function isDeceased(p: Pick<PersonRecord, "deathYear">): boolean {
  return p.deathYear !== null;
}

/**
 * A person we can positively establish is an adult.
 *
 * Unknown birth year is deliberately NOT treated as adult. We cannot prove a
 * living person with no recorded birth year is over 18, and the brief's default
 * is the restrictive one. This only gates PUBLIC visibility and photos, so the
 * cost is "a claimant must supply a birth year before going public" — which a
 * person claiming their own profile can always do. Historical (deceased)
 * profiles, the main source of genealogical value, are unaffected.
 */
export function isKnownAdult(
  p: Pick<PersonRecord, "birthYear" | "deathYear">,
  now: Date = new Date()
): boolean {
  if (isDeceased(p)) return true;
  if (p.birthYear === null) return false;
  return now.getUTCFullYear() - p.birthYear >= MINOR_AGE;
}

/** A living person we can positively establish is under 18. */
export function isKnownMinor(
  p: Pick<PersonRecord, "birthYear" | "deathYear">,
  now: Date = new Date()
): boolean {
  if (isDeceased(p)) return false;
  if (p.birthYear === null) return false;
  return now.getUTCFullYear() - p.birthYear < MINOR_AGE;
}

export function isLocked(p: Pick<PersonRecord, "privacyTier" | "lockedAt">): boolean {
  return p.privacyTier === "LOCKED" || p.lockedAt !== null;
}

/**
 * Whether this profile is allowed to be PUBLIC at all, regardless of what the
 * stored tier says. Enforced on read as well as on write, so a row that somehow
 * reaches PUBLIC — a bad migration, a direct DB edit, a future bug — still does
 * not leak.
 */
export function mayBePublic(p: PersonRecord, now: Date = new Date()): boolean {
  if (isLocked(p)) return false;
  if (isKnownMinor(p, now)) return false;
  // Cannot establish adulthood → not public. See isKnownAdult.
  if (!isKnownAdult(p, now)) return false;
  return true;
}

/** A minor may only show a photo when a guardian account is attached. */
export function mayShowPhoto(p: PersonRecord, now: Date = new Date()): boolean {
  if (isLocked(p)) return false;
  if (isKnownMinor(p, now)) return p.guardianUserId !== null;
  return true;
}

/**
 * The effective tier: the stored tier narrowed by the rules above. Never widens.
 */
export function effectiveTier(p: PersonRecord, now: Date = new Date()): PrivacyTier {
  if (isLocked(p)) return "LOCKED";
  if (p.privacyTier === "PUBLIC" && mayBePublic(p, now)) return "PUBLIC";
  return "FAMILY_ONLY";
}

/** Whether a profile may appear in open search results. */
export function isSearchable(p: PersonRecord, viewer: Viewer, now: Date = new Date()): boolean {
  if (isLocked(p)) return false;
  // Minors are never searchable, by anyone, including relatives.
  if (isKnownMinor(p, now)) return false;
  if (effectiveTier(p, now) === "PUBLIC") return true;
  // Family-only profiles surface only to people already connected to them.
  return viewer.relatedPersonIds.has(p.id);
}

export type PersonView =
  | { id: string; visibility: "LOCKED"; displayName: "[removed]" }
  | {
      id: string;
      visibility: "FULL" | "LIMITED";
      displayName: string;
      birthYear: number | null;
      birthYearIsExact: boolean;
      deathYear: number | null;
      deathYearIsExact: boolean;
      photoUrl: string | null;
      bio: string | null;
      deceasedNotes: string | null;
      verified: boolean;
      claimed: boolean;
    };

/**
 * The only sanctioned way to turn a Person row into something a client sees.
 *
 * A LOCKED node still returns its id so existing relationship edges keep
 * resolving — the graph does not silently break — but discloses nothing else.
 */
export function projectPerson(
  p: PersonRecord,
  viewer: Viewer,
  now: Date = new Date()
): PersonView {
  if (isLocked(p)) {
    return { id: p.id, visibility: "LOCKED", displayName: "[removed]" };
  }

  const tier = effectiveTier(p, now);
  const isSelf = viewer.userId !== null && p.claimedByUserId === viewer.userId;
  const isFamily = viewer.relatedPersonIds.has(p.id);
  const full = isSelf || isFamily || tier === "PUBLIC";

  if (!full) {
    // Known to exist (an edge points at it) but nothing personal disclosed.
    return {
      id: p.id,
      visibility: "LIMITED",
      displayName: p.displayName,
      birthYear: null,
      birthYearIsExact: false,
      deathYear: null,
      deathYearIsExact: false,
      photoUrl: null,
      bio: null,
      deceasedNotes: null,
      verified: p.verified,
      claimed: p.claimedByUserId !== null,
    };
  }

  return {
    id: p.id,
    visibility: "FULL",
    displayName: p.displayName,
    birthYear: p.birthYear,
    birthYearIsExact: p.birthYearIsExact,
    deathYear: p.deathYear,
    deathYearIsExact: p.deathYearIsExact,
    photoUrl: mayShowPhoto(p, now) ? p.photoUrl : null,
    bio: p.bio,
    deceasedNotes: p.deceasedNotes,
    verified: p.verified,
    claimed: p.claimedByUserId !== null,
  };
}
