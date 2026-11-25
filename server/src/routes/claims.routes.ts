import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { buildViewer } from "../lib/graph";
import { requireAuth } from "../middleware/auth.middleware";
import { projectPerson } from "../lib/visibility";
import { EVIDENCE_MAX_LENGTH, EVIDENCE_MIN_LENGTH, claimRefusal } from "../lib/claims";

export const claimsRouter = Router();

claimsRouter.use(requireAuth);

const claimInput = z.object({
  personId: z.string().min(1),
  evidence: z
    .string()
    .trim()
    .min(EVIDENCE_MIN_LENGTH, "Tell us a little more about how you're connected to this person.")
    .max(EVIDENCE_MAX_LENGTH),
});

/**
 * Ask to claim a profile. Queues a PENDING request for review; it never sets
 * claimedByUserId itself — claiming someone grants control of their privacy
 * tier, so it has to be adjudicated, not self-served.
 */
claimsRouter.post("/", async (req, res, next) => {
  try {
    const { personId, evidence } = claimInput.parse(req.body);

    const person = await prisma.person.findUnique({ where: { id: personId } });
    if (!person) return res.status(404).json({ error: "No such profile." });

    const refusal = claimRefusal(person, req.userId!);
    if (refusal) return res.status(refusal.status).json({ error: refusal.error });

    try {
      const request = await prisma.claimRequest.create({
        data: { personId: person.id, requestingUserId: req.userId!, evidence },
      });
      res.status(201).json({
        request: { id: request.id, personId: request.personId, status: request.status, createdAt: request.createdAt },
      });
    } catch (err) {
      // One request per (person, user) — enforced by the unique index so two
      // quick submits can't race past a read-then-write check.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return res.status(409).json({ error: "You've already asked to claim this profile." });
      }
      throw err;
    }
  } catch (err) { next(err); }
});

/**
 * The signed-in user's own claim requests, newest first. The person on each
 * request still goes through projectPerson: asking to claim a profile does not
 * entitle you to see more of it.
 */
claimsRouter.get("/mine", async (req, res, next) => {
  try {
    const requests = await prisma.claimRequest.findMany({
      where: { requestingUserId: req.userId! },
      include: { person: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const viewer = await buildViewer(req.userId!);
    res.json({
      requests: requests.map((r) => ({
        id: r.id,
        status: r.status,
        createdAt: r.createdAt,
        resolvedAt: r.resolvedAt,
        person: projectPerson(r.person, viewer),
      })),
    });
  } catch (err) { next(err); }
});
