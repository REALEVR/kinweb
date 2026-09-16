const BASE = import.meta.env.VITE_API_BASE_URL ?? "";

let token: string | null = null;
try { token = localStorage.getItem("kinweb.token"); } catch { /* private mode */ }

export function setToken(t: string | null) {
  token = t;
  try { t ? localStorage.setItem("kinweb.token", t) : localStorage.removeItem("kinweb.token"); }
  catch { /* ignore */ }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? "Something went wrong.");
  return body as T;
}

export interface PersonView {
  id: string;
  visibility: "FULL" | "LIMITED" | "LOCKED";
  displayName: string;
  birthYear?: number | null;
  deathYear?: number | null;
  bio?: string | null;
  photoUrl?: string | null;
  verified?: boolean;
  claimed?: boolean;
}

export interface WebEdge { a: string; b: string; type: string; confirmed: boolean }
