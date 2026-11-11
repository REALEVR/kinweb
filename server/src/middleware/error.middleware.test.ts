import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { errorHandler, notFoundHandler } from "./error.middleware";

type Captured = { status?: number; body?: unknown };

function fakeRes(captured: Captured): Response {
  const res = {
    status(code: number) { captured.status = code; return res; },
    json(body: unknown) { captured.body = body; return res; },
  };
  return res as unknown as Response;
}

const req = { method: "GET", originalUrl: "/api/nope?x=1" } as Request;
const next = (() => undefined) as NextFunction;

/** Mirrors the error shape body-parser attaches to the errors it throws. */
function bodyParserError(type: string, status: number): Error {
  return Object.assign(new Error(type), { type, status, expose: true });
}

function run(err: unknown): Captured {
  const captured: Captured = {};
  errorHandler(err, req, fakeRes(captured), next);
  return captured;
}

describe("errorHandler", () => {
  it("answers malformed JSON with 400, not 500", () => {
    const out = run(bodyParserError("entity.parse.failed", 400));
    assert.equal(out.status, 400);
    assert.deepEqual(out.body, { error: "That request body isn't valid JSON." });
  });

  it("answers an oversized body with 413", () => {
    const out = run(bodyParserError("entity.too.large", 413));
    assert.equal(out.status, 413);
  });

  it("answers a validation failure with 400 and the first issue", () => {
    const parsed = z.object({ name: z.string({ required_error: "Name is required." }) }).safeParse({});
    assert.equal(parsed.success, false);
    const out = run(parsed.success ? null : parsed.error);
    assert.equal(out.status, 400);
    assert.deepEqual(out.body, { error: "Name is required." });
  });

  it("hides unexpected errors behind a generic 500", () => {
    const original = console.error;
    console.error = () => undefined;
    try {
      const out = run(new Error("database password is hunter2"));
      assert.equal(out.status, 500);
      assert.deepEqual(out.body, { error: "Something went wrong on our side." });
    } finally {
      console.error = original;
    }
  });
});

describe("notFoundHandler", () => {
  it("answers unknown API routes with JSON 404", () => {
    const captured: Captured = {};
    notFoundHandler(req, fakeRes(captured));
    assert.equal(captured.status, 404);
    assert.deepEqual(captured.body, { error: "No such endpoint: GET /api/nope" });
  });
});
