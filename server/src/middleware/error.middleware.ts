import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: err.issues[0]?.message ?? "That input isn't valid." });
  }
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ error: "Something went wrong on our side." });
}
