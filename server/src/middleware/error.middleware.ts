import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

/**
 * Client-caused failures raised by express.json() (body-parser) before any
 * route runs. Without this map they fell through to the generic 500 branch,
 * so a typo in a request body looked like a server outage and was logged as one.
 */
const BODY_PARSER_ERRORS: Record<string, { status: number; message: string }> = {
  "entity.parse.failed": { status: 400, message: "That request body isn't valid JSON." },
  "entity.too.large": { status: 413, message: "That request body is too large." },
  "encoding.unsupported": { status: 415, message: "That request body's encoding isn't supported." },
  "charset.unsupported": { status: 415, message: "That request body's charset isn't supported." },
};

function bodyParserFailure(err: unknown) {
  if (typeof err !== "object" || err === null || !("type" in err)) return undefined;
  const type = (err as { type: unknown }).type;
  // Own-key check so a stray `type: "constructor"` can't resolve via the prototype.
  return typeof type === "string" && Object.hasOwn(BODY_PARSER_ERRORS, type) ? BODY_PARSER_ERRORS[type] : undefined;
}

/** Mounted after every router, so anything reaching it matched no route. */
export function notFoundHandler(req: Request, res: Response) {
  // originalUrl, not path: path is relative to the mount point ("/api").
  const path = req.originalUrl.split("?")[0];
  res.status(404).json({ error: `No such endpoint: ${req.method} ${path}` });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: err.issues[0]?.message ?? "That input isn't valid." });
  }
  const parseFailure = bodyParserFailure(err);
  if (parseFailure) {
    return res.status(parseFailure.status).json({ error: parseFailure.message });
  }
  // Unexpected: log the detail server-side, never echo it to the client.
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ error: "Something went wrong on our side." });
}
