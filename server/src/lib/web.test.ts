import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { dedupeEdges, MAX_WEB_NODES, type WebEdge } from "./web";

const edge = (a: string, b: string, type: string, confirmed = true): WebEdge => ({ a, b, type, confirmed });

describe("dedupeEdges", () => {
  it("collapses exact duplicates", () => {
    const out = dedupeEdges([edge("a", "b", "PARENT"), edge("a", "b", "PARENT")]);
    assert.equal(out.length, 1);
  });

  it("treats SPOUSE and SIBLING as symmetric", () => {
    const out = dedupeEdges([edge("a", "b", "SPOUSE"), edge("b", "a", "SPOUSE"), edge("a", "c", "SIBLING"), edge("c", "a", "SIBLING")]);
    assert.equal(out.length, 2);
  });

  it("keeps PARENT edges directional", () => {
    const out = dedupeEdges([edge("a", "b", "PARENT"), edge("b", "a", "PARENT")]);
    assert.equal(out.length, 2);
  });

  it("prefers the confirmed copy of a duplicate", () => {
    const out = dedupeEdges([edge("a", "b", "SPOUSE", false), edge("b", "a", "SPOUSE", true)]);
    assert.equal(out.length, 1);
    assert.equal(out[0].confirmed, true);
  });
});

describe("MAX_WEB_NODES", () => {
  it("is a positive bound", () => {
    assert.ok(MAX_WEB_NODES > 0);
  });
});
