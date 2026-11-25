/**
 * Rules for asking to claim a profile.
 *
 * A claim request is how an unclaimed Person becomes "owned" by the real
 * person (or a close relative of someone deceased). Creating a request grants
 * nothing — it is queued for review — but we still refuse requests that could
 * never be honoured, so the review queue only holds real decisions.
 *
 * Kept free of Prisma so the decision can be unit-tested like visibility.ts.
 */

export const EVIDENCE_MIN_LENGTH = 20;
export const EVIDENCE_MAX_LENGTH = 2000;

export interface ClaimTarget {
  claimedByUserId: string | null;
  lockedAt: Date | null;
}

export interface ClaimRefusal {
  status: 409;
  error: string;
}

/**
 * Why `userId` may not request a claim on `person`, or null if they may.
 *
 * Locked profiles are refused first: an honoured (or pending) erasure must not
 * be reversible by someone asking to "claim" the node back into visibility.
 */
export function claimRefusal(person: ClaimTarget, userId: string): ClaimRefusal | null {
  if (person.lockedAt) {
    return { status: 409, error: "This profile is locked and can't be claimed." };
  }
  if (person.claimedByUserId === userId) {
    return { status: 409, error: "You've already claimed this profile." };
  }
  if (person.claimedByUserId) {
    return {
      status: 409,
      error: "Someone has already claimed this profile. If that's wrong, ask for it to be locked instead.",
    };
  }
  return null;
}
