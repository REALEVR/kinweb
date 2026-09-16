import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ANONYMOUS,
  effectiveTier,
  isKnownAdult,
  isKnownMinor,
  isSearchable,
  mayBePublic,
  mayShowPhoto,
  projectPerson,
  type PersonRecord,
  type Viewer,
} from "./visibility";

const NOW = new Date("2026-01-01T00:00:00Z");

function person(over: Partial<PersonRecord> = {}): PersonRecord {
  return {
    id: "p1",
    displayName: "Aminah N.",
    birthYear: 1980,
    birthYearIsExact: false,
    deathYear: null,
    deathYearIsExact: false,
    photoUrl: "https://example.test/a.jpg",
    bio: "Born in Kampala.",
    deceasedNotes: null,
    privacyTier: "FAMILY_ONLY",
    claimedByUserId: null,
    guardianUserId: null,
    verified: false,
    lockedAt: null,
    ...over,
  };
}

const family = (ids: string[]): Viewer => ({ userId: "u1", relatedPersonIds: new Set(ids) });
const stranger: Viewer = { userId: "u9", relatedPersonIds: new Set() };

describe("age determination", () => {
  it("treats a deceased person as an adult regardless of birth year", () => {
    assert.equal(isKnownAdult(person({ birthYear: null, deathYear: 1931 }), NOW), true);
    assert.equal(isKnownMinor(person({ birthYear: 2020, deathYear: 2021 }), NOW), false);
  });

  it("does NOT treat an unknown birth year as adult", () => {
    assert.equal(isKnownAdult(person({ birthYear: null }), NOW), false);
  });

  it("identifies a living minor", () => {
    assert.equal(isKnownMinor(person({ birthYear: 2015 }), NOW), true);
    assert.equal(isKnownMinor(person({ birthYear: 2007 }), NOW), false); // turns 19 in 2026
  });
});

describe("PUBLIC is never granted to a minor", () => {
  it("refuses public for a living minor even when the row says PUBLIC", () => {
    const p = person({ birthYear: 2015, privacyTier: "PUBLIC" });
    assert.equal(mayBePublic(p, NOW), false);
    assert.equal(effectiveTier(p, NOW), "FAMILY_ONLY");
  });

  it("refuses public when adulthood cannot be established", () => {
    const p = person({ birthYear: null, privacyTier: "PUBLIC" });
    assert.equal(effectiveTier(p, NOW), "FAMILY_ONLY");
  });

  it("allows public for a consenting adult who opted in", () => {
    assert.equal(effectiveTier(person({ privacyTier: "PUBLIC" }), NOW), "PUBLIC");
  });

  it("allows public for a deceased person with no birth year", () => {
    const p = person({ birthYear: null, deathYear: 1931, privacyTier: "PUBLIC" });
    assert.equal(effectiveTier(p, NOW), "PUBLIC");
  });
});

describe("default tier", () => {
  it("is FAMILY_ONLY, never PUBLIC", () => {
    assert.equal(effectiveTier(person(), NOW), "FAMILY_ONLY");
  });
});

describe("minor photos require a guardian", () => {
  it("hides a minor's photo with no guardian attached", () => {
    assert.equal(mayShowPhoto(person({ birthYear: 2015 }), NOW), false);
  });

  it("allows it once a guardian account is attached", () => {
    assert.equal(mayShowPhoto(person({ birthYear: 2015, guardianUserId: "u2" }), NOW), true);
  });

  it("strips the photo from the projection, not just the flag", () => {
    const p = person({ birthYear: 2015 });
    const view = projectPerson(p, family(["p1"]), NOW);
    assert.equal(view.visibility, "FULL");
    assert.equal(view.visibility === "FULL" ? view.photoUrl : "unset", null);
  });
});

describe("searchability", () => {
  it("never surfaces a minor, even to family", () => {
    assert.equal(isSearchable(person({ birthYear: 2015 }), family(["p1"]), NOW), false);
  });

  it("surfaces a public adult to anyone", () => {
    assert.equal(isSearchable(person({ privacyTier: "PUBLIC" }), ANONYMOUS, NOW), true);
  });

  it("surfaces a family-only profile to family but not strangers", () => {
    assert.equal(isSearchable(person(), family(["p1"]), NOW), true);
    assert.equal(isSearchable(person(), stranger, NOW), false);
  });
});

describe("locked (erasure honoured) nodes", () => {
  const locked = person({ lockedAt: new Date("2025-12-01T00:00:00Z"), privacyTier: "PUBLIC" });

  it("discloses nothing but the id, even to family", () => {
    const view = projectPerson(locked, family(["p1"]), NOW);
    assert.equal(view.visibility, "LOCKED");
    assert.equal(view.displayName, "[removed]");
    assert.equal("bio" in view, false);
  });

  it("keeps the id so existing edges still resolve", () => {
    assert.equal(projectPerson(locked, ANONYMOUS, NOW).id, "p1");
  });

  it("is never public and never searchable", () => {
    assert.equal(effectiveTier(locked, NOW), "LOCKED");
    assert.equal(isSearchable(locked, family(["p1"]), NOW), false);
  });
});

describe("projection for strangers", () => {
  it("withholds personal fields from a family-only profile", () => {
    const view = projectPerson(person({ bio: "secret" }), stranger, NOW);
    assert.equal(view.visibility, "LIMITED");
    assert.equal(view.visibility === "LIMITED" ? view.bio : "unset", null);
    assert.equal(view.visibility === "LIMITED" ? view.birthYear : -1, null);
  });

  it("shows a claimant their own profile in full", () => {
    const p = person({ claimedByUserId: "u1", bio: "mine" });
    const view = projectPerson(p, { userId: "u1", relatedPersonIds: new Set() }, NOW);
    assert.equal(view.visibility, "FULL");
    assert.equal(view.visibility === "FULL" ? view.bio : null, "mine");
  });
});
