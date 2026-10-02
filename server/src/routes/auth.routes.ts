import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { hashPassword, signToken, verifyPassword } from "../lib/auth";

export const authRouter = Router();

const credentials = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Use at least 8 characters."),
  displayName: z.string().min(1).max(80).optional(),
});

authRouter.post("/register", async (req, res, next) => {
  try {
    const body = credentials.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) return res.status(409).json({ error: "That email is already registered." });

    const user = await prisma.user.create({
      data: {
        email: body.email,
        passwordHash: await hashPassword(body.password),
        displayName: body.displayName ?? body.email.split("@")[0],
      },
      select: { id: true, email: true, displayName: true },
    });
    res.status(201).json({ user, token: signToken({ userId: user.id }) });
  } catch (err) { next(err); }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const body = credentials.pick({ email: true, password: true }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    // Same response either way — never reveal whether an email is registered.
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      return res.status(401).json({ error: "Email or password is incorrect." });
    }
    res.json({
      user: { id: user.id, email: user.email, displayName: user.displayName },
      token: signToken({ userId: user.id }),
    });
  } catch (err) { next(err); }
});

authRouter.get("/me", async (req, res, next) => {
  try {
    if (!req.userId) return res.json({ user: null });
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true, displayName: true },
    });
    res.json({ user });
  } catch (err) { next(err); }
});
