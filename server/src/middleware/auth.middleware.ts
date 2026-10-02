import type { NextFunction, Request, Response } from "express";
import { verifyToken } from "../lib/auth";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request { userId?: string }
  }
}

/** Attaches req.userId when a valid token is present. Never rejects. */
export function withUser(req: Request, _res: Response, next: NextFunction) {
  const bearer = req.headers.authorization?.replace(/^Bearer /, "");
  const token = bearer ?? req.cookies?.token;
  if (token) {
    const payload = verifyToken(token);
    if (payload) req.userId = payload.userId;
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.userId) return res.status(401).json({ error: "Sign in required." });
  next();
}
