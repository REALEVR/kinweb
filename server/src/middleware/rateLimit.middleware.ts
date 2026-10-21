import type { NextFunction, Request, Response } from "express";
import { createRateLimiter } from "../lib/rateLimit";

const SWEEP_INTERVAL_MS = 60_000;

/** Limits requests per client IP; responds 429 with Retry-After once `max` is exceeded in the window. */
export function rateLimit(opts: { max: number; windowMs: number }) {
  const limiter = createRateLimiter(opts);
  setInterval(() => limiter.sweep(), SWEEP_INTERVAL_MS).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const result = limiter.hit(req.ip ?? "unknown");
    if (result.allowed) return next();
    res.set("Retry-After", String(Math.ceil(result.retryAfterMs / 1000)));
    res.status(429).json({ error: "Too many attempts. Please wait a moment and try again." });
  };
}
