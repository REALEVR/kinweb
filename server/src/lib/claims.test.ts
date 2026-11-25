import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { claimRefusal, type ClaimTarget } from "./claims";

const unclaimed = (over: Partial<ClaimTarget> = {}): ClaimTarget => ({
  claimedByUserId: null,
  lockedAt: null,
  ...over,
});

describe("claimRefusal", () => {
  it("allows a request on an unclaimed, unlocked profile", () => {
    assert.equal(claimRefusal(unclaimed(), "u1"), null);
  });

  it("refuses a locked profile, even if it is unclaimed", () => {
    const refusal = claimRefusal(unclaimed({ lockedAt: new Date() }), "u1");
    assert.equal(refusal?.status, 409);
    assert.match(refusal!.error, /locked/);
  });

  it("refuses a locked profile before reporting who claimed it", () => {
    const refusal = claimRefusal(unclaimed({ lockedAt: new Date(), claimedByUserId: "u2" }), "u1");
    assert.match(refusal!.error, /locked/);
  });

  it("tells the claimant the profile is already theirs", () => {
    const refusal = claimRefusal(unclaimed({ claimedByUserId: "u1" }), "u1");
    assert.match(refusal!.error, /already claimed this profile/);
  });

  it("refuses a profile claimed by someone else", () => {
    const refusal = claimRefusal(unclaimed({ claimedByUserId: "u2" }), "u1");
    assert.equal(refusal?.status, 409);
    assert.match(refusal!.error, /Someone has already claimed/);
  });
});
