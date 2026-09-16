import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "./env";

export interface TokenPayload { userId: string }

export const hashPassword = (pw: string) => bcrypt.hash(pw, 10);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

export const signToken = (p: TokenPayload) =>
  jwt.sign(p, env.jwtSecret, { expiresIn: "30d" });

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, env.jwtSecret) as TokenPayload;
  } catch {
    return null;
  }
}
