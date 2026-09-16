import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { buildViewer } from "../lib/graph";
import { requireAuth } from "../middleware/auth.middleware";
import { isSearchable, projectPerson } from "../lib/visibility";

export const peopleRouter = Router();

const RELATIONSHIP_TYPES = ["PARENT", "SPOUSE", "SIBLING"] as const;

const personInput = z.object({
  displayName: z.string().min(1).max(120),
  birthYear: z.number().int().min(1000).max(2200).nullable().optional(),
  birthYearIsExact: z.boolean().optional(),
  deathYear: z.number().int().min(1000).max(2200).nullable().optional(),
  deathYearIsExact: z.boolean().optional(),
  bio: z.string().max(2000).nullable().optional(),
  deceasedNotes: z.string().max(2000).nullable().optional(),
});

/**
 * Open search. Every candidate is filtered through isSearchable, which excludes
 * minors and locked nodes unconditionally and family-only profiles for anyone
 * not already connected. The DB query is a prefilter, not the access decision.
 */
peopleRouter.get("/search", async (req, res, next) => {
  try {
    const q = String(req.query.q ?? "").trim();
    if (q.length < 2) return res.json({ results: [] });

    const viewer = await buildViewer(req.userId ?? null);
    const candidates = await prisma.person.findMany({
      where: { displayName: { contains: q, mode: "insensitive" }, lockedAt: null },
      take: 100,
    });

    const results = candidates
      .filter((p) => isSearchable(p, viewer))
      .slice(0, 25)
      .map((p) => projectPerson(p, viewer));

    res.json({ results });
  } catch (err) { next(err); }
});

peopleRouter.get("/:id", async (req, res, next) => {
  try {
    const person = await prisma.person.findUnique({ where: { id: req.params.id } });
    if (!person) return res.status(404).json({ error: "No such profile." });
    const viewer = await buildViewer(req.userId ?? null);
    res.json({ person: projectPerson(person, viewer) });
  } catch (err) { next(err); }
});

/**
 * The family web around a person, for the force-directed view.
 * Nodes are projected individually — a locked or family-only node inside the
 * web still discloses only what the viewer is entitled to.
 */
peopleRouter.get("/:id/web", async (req, res, next) => {
  try {
    const root = await prisma.person.findUnique({ where: { id: req.params.id } });
    if (!root) return res.status(404).json({ error: "No such profile." });

    const viewer = await buildViewer(req.userId ?? null);
    const seen = new Set([root.id]);
    let frontier = [root.id];
    const edges: { a: string; b: string; type: string; confirmed: boolean }[] = [];

    for (let d = 0; d < 2 && frontier.length; d++) {
      const rels = await prisma.relationship.findMany({
        where: { OR: [{ personAId: { in: frontier } }, { personBId: { in: frontier } }] },
      });
      const next: string[] = [];
      for (const r of rels) {
        edges.push({ a: r.personAId, b: r.personBId, type: r.type, confirmed: r.confirmed });
        for (const id of [r.personAId, r.personBId]) {
          if (!seen.has(id)) { seen.add(id); next.push(id); }
        }
      }
      frontier = next;
    }

    const people = await prisma.person.findMany({ where: { id: { in: [...seen] } } });
    res.json({
      nodes: people.map((p) => projectPerson(p, viewer)),
      edges: [...new Map(edges.map((e) => [`${e.a}:${e.b}:${e.type}`, e])).values()],
    });
  } catch (err) { next(err); }
});

/** Create your own profile, or a relative you know about. */
peopleRouter.post("/", requireAuth, async (req, res, next) => {
  try {
    const body = personInput.extend({ claimAsSelf: z.boolean().optional() }).parse(req.body);
    const { claimAsSelf, ...fields } = body;

    const person = await prisma.person.create({
      data: {
        ...fields,
        addedByUserId: req.userId!,
        // privacyTier is deliberately NOT settable here. Everything starts
        // FAMILY_ONLY (the schema default); going public is a separate,
        // explicit act by the claimant via PATCH /:id/privacy.
        ...(claimAsSelf ? { claimedByUserId: req.userId!, claimedAt: new Date() } : {}),
      },
    });

    const viewer = await buildViewer(req.userId!);
    res.status(201).json({ person: projectPerson(person, viewer) });
  } catch (err) { next(err); }
});

/**
 * Add a relative and link them. Returns merge suggestions rather than merging —
 * a wrong merge is worse than a missed one, so this never auto-applies.
 */
peopleRouter.post("/:id/relatives", requireAuth, async (req, res, next) => {
  try {
    const body = personInput
      .extend({ type: z.enum(RELATIONSHIP_TYPES), direction: z.enum(["FROM", "TO"]).default("FROM") })
      .parse(req.body);
    const { type, direction, ...fields } = body;

    const anchor = await prisma.person.findUnique({ where: { id: req.params.id } });
    if (!anchor) return res.status(404).json({ error: "No such profile." });

    const relative = await prisma.person.create({
      data: { ...fields, addedByUserId: req.userId! },
    });

    // PARENT is directional: personA is the parent of personB.
    const [personAId, personBId] =
      direction === "FROM" ? [anchor.id, relative.id] : [relative.id, anchor.id];

    await prisma.relationship.create({
      data: { personAId, personBId, type, addedByUserId: req.userId! },
    });

    // Likely duplicates already in the graph, surfaced for a human to judge.
    const possibleDuplicates = await prisma.person.findMany({
      where: {
        displayName: { equals: relative.displayName, mode: "insensitive" },
        id: { not: relative.id },
        lockedAt: null,
      },
      take: 5,
    });

    for (const dup of possibleDuplicates) {
      const [a, b] = [relative.id, dup.id].sort();
      await prisma.mergeSuggestion.upsert({
        where: { personAId_personBId: { personAId: a, personBId: b } },
        update: {},
        create: { personAId: a, personBId: b, matchScore: 0.5 },
      });
    }

    const viewer = await buildViewer(req.userId!);
    res.status(201).json({
      person: projectPerson(relative, viewer),
      mergeSuggestions: possibleDuplicates.length,
    });
  } catch (err) { next(err); }
});

/** Going public is an explicit act, and only the claimant may take it. */
peopleRouter.patch("/:id/privacy", requireAuth, async (req, res, next) => {
  try {
    const { privacyTier } = z
      .object({ privacyTier: z.enum(["FAMILY_ONLY", "PUBLIC"]) })
      .parse(req.body);

    const person = await prisma.person.findUnique({ where: { id: req.params.id } });
    if (!person) return res.status(404).json({ error: "No such profile." });
    if (person.claimedByUserId !== req.userId) {
      return res.status(403).json({ error: "Only the person who claimed this profile can change its visibility." });
    }
    if (person.lockedAt) {
      return res.status(409).json({ error: "This profile is locked and cannot be reopened here." });
    }

    const updated = await prisma.person.update({
      where: { id: person.id },
      data: { privacyTier },
    });
    const viewer = await buildViewer(req.userId!);
    // Note: effectiveTier may still narrow this to FAMILY_ONLY (e.g. a minor, or
    // an unverifiable birth year). The stored value is a request, not a grant.
    res.json({ person: projectPerson(updated, viewer) });
  } catch (err) { next(err); }
});
