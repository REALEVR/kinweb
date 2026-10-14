export interface WebEdge {
  a: string;
  b: string;
  type: string;
  confirmed: boolean;
}

/** Upper bound on nodes returned by the web endpoint, so one hub profile can't fan out unbounded. */
export const MAX_WEB_NODES = 200;

const SYMMETRIC_TYPES = new Set(["SPOUSE", "SIBLING"]);

function edgeKey(e: WebEdge): string {
  // SPOUSE/SIBLING have no direction, so A-B and B-A are the same edge.
  const [x, y] = SYMMETRIC_TYPES.has(e.type) && e.a > e.b ? [e.b, e.a] : [e.a, e.b];
  return `${x}:${y}:${e.type}`;
}

/** Collapse duplicate edges, preferring the confirmed copy. Does not mutate the input. */
export function dedupeEdges(edges: readonly WebEdge[]): WebEdge[] {
  const byKey = new Map<string, WebEdge>();
  for (const e of edges) {
    const key = edgeKey(e);
    const existing = byKey.get(key);
    if (!existing || (!existing.confirmed && e.confirmed)) byKey.set(key, e);
  }
  return [...byKey.values()];
}
