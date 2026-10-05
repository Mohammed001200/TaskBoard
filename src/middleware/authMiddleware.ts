import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import User from "../models/User";
import { UnauthorizedError } from "../errors/AppError";
export interface AuthRequest extends Request {
  userId?: string;
  isAdmin?: boolean;
}
const authorizationSchema = z
  .string()
  .regex(/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
const identitySchema = z.object({ userId: z.string().regex(/^[a-f\d]{24}$/i) });
export async function authenticate(
  request: AuthRequest,
  _response: Response,
  next: NextFunction,
) {
  const header = authorizationSchema.safeParse(request.headers.authorization);
  if (!header.success) throw new UnauthorizedError();
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error("JWT configuration is missing.");
  let identity: z.infer<typeof identitySchema>;
  try {
    identity = identitySchema.parse(
      jwt.verify(header.data.slice(7), jwtSecret, { algorithms: ["HS256"] }),
    );
  } catch {
    throw new UnauthorizedError();
  }
  // Current DB state prevents stale tokens restoring deleted accounts or admin permission.
  const user = await User.findOne({ _id: identity.userId, deletedAt: null });
  if (!user) throw new UnauthorizedError();
  request.userId = user._id.toString();
  request.isAdmin = user.isAdmin;
  next();
}
