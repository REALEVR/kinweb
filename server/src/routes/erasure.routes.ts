import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

export const erasureRouter = Router();

/**
 * Request lockdown or erasure of a profile representing you.
 *
 * Deliberately open to unauthenticated requesters. A non-consenting subject —
 * the exact person this flow exists for — will usually not have an account, and
 * requiring signup in order to be forgotten is backwards. `contactEmail` stands
 * in for identity; a human reviews before it is honoured.
 */
erasureRouter.post("/", async (req, res, next) => {
  try {
    const body = z
      .object({
        personId: z.string().min(1),
        kind: z.enum(["LOCKDOWN", "ERASE"]).default("LOCKDOWN"),
        reason: z.string().max(2000).optional(),
        contactEmail: z.string().email().optional(),
      })
      .parse(req.body);

    if (!req.userId && !body.contactEmail) {
      return res.status(400).json({ error: "Give us an email address so we can reach you about this request." });
    }

    const person = await prisma.person.findUnique({ where: { id: body.personId } });
    if (!person) return res.status(404).json({ error: "No such profile." });

    const request = await prisma.erasureRequest.create({
      data: {
        personId: person.id,
        requestingUserId: req.userId ?? null,
        contactEmail: body.contactEmail ?? null,
        kind: body.kind,
        reason: body.reason ?? null,
      },
    });

    // Lock immediately, review afterwards. The brief treats erasure as a product
    // requirement rather than a support queue: the cost of a wrongly-locked node
    // is a reversible inconvenience, the cost of a slowly-locked one is exposure
    // of someone who asked not to be listed. So the default is to stop
    // disclosing first and adjudicate second.
    await prisma.person.update({
      where: { id: person.id },
      data: { lockedAt: new Date(), privacyTier: "LOCKED" },
    });

    res.status(201).json({
      request: { id: request.id, status: request.status, kind: request.kind },
      lockedImmediately: true,
    });
  } catch (err) { next(err); }
});
