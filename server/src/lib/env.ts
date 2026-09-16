import "dotenv/config";

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  isProduction: process.env.NODE_ENV === "production",
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: required("JWT_SECRET", "dev-only-change-me"),
  clientOrigin: required("CLIENT_ORIGIN", "http://localhost:5173"),
  /** How many graph hops count as "family" for FAMILY_ONLY visibility. */
  familyDegrees: Number(process.env.FAMILY_DEGREES ?? 3),
};
