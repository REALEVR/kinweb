import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRateLimiter } from "./rateLimit";

describe("createRateLimiter", () => {
  it("allows up to max hits per window, then blocks", () => {
    const limiter = createRateLimiter({ max: 2, windowMs: 1000 });
    assert.equal(limiter.hit("a", 0).allowed, true);
    assert.equal(limiter.hit("a", 10).allowed, true);
    const blocked = limiter.hit("a", 20);
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.retryAfterMs, 980);
  });

  it("tracks keys independently", () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 1000 });
    assert.equal(limiter.hit("a", 0).allowed, true);
    assert.equal(limiter.hit("b", 0).allowed, true);
    assert.equal(limiter.hit("a", 1).allowed, false);
  });

  it("resets once the window has passed", () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 1000 });
    limiter.hit("a", 0);
    assert.equal(limiter.hit("a", 999).allowed, false);
    assert.equal(limiter.hit("a", 1000).allowed, true);
  });

  it("evicts expired entries so memory stays bounded", () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 1000 });
    limiter.hit("a", 0);
    limiter.hit("b", 0);
    limiter.sweep(2000);
    assert.equal(limiter.size(), 0);
  });
});
