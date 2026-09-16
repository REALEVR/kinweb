import { prisma } from "./prisma";
import { env } from "./env";
import type { Viewer } from "./visibility";
import { ANONYMOUS } from "./visibility";

/**
 * The set of Person ids a viewer counts as "family" for FAMILY_ONLY visibility.
 *
 * Breadth-first over the relationship edges from the viewer's own claimed
 * nodes, bounded by FAMILY_DEGREES. The bound matters: without it, one shared
 * ancestor anywhere in a connected clan would make the entire component
 * "family" to everyone in it, which would quietly defeat the whole tier.
 *
 * Application-level traversal, per the brief — a relational store with a bounded
 * BFS handles the first hundreds of thousands of profiles. Revisit only if this
 * becomes a measured bottleneck, not preemptively.
 */
export async function buildViewer(userId: string | null): Promise<Viewer> {
  if (!userId) return ANONYMOUS;

  const owned = await prisma.person.findMany({
    where: { claimedByUserId: userId },
    select: { id: true },
  });

  const seen = new Set<string>(owned.map((p) => p.id));
  let frontier = [...seen];

  for (let depth = 0; depth < env.familyDegrees && frontier.length > 0; depth++) {
    const edges = await prisma.relationship.findMany({
      where: {
        OR: [{ personAId: { in: frontier } }, { personBId: { in: frontier } }],
      },
      select: { personAId: true, personBId: true },
    });

    const next: string[] = [];
    for (const e of edges) {
      for (const id of [e.personAId, e.personBId]) {
        if (!seen.has(id)) {
          seen.add(id);
          next.push(id);
        }
      }
    }
    frontier = next;
  }

  return { userId, relatedPersonIds: seen };
}
