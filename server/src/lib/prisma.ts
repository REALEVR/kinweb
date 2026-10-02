import { PrismaClient } from "@prisma/client";

// Single client per process. Re-instantiating per request exhausts a Neon free
// project's connection allowance quickly.
export const prisma = new PrismaClient();
