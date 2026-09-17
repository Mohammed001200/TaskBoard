import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { isValidObjectId } from "mongoose";

export interface AuthRequest extends Request {
  userId?: string;
}

export function authenticate(
  request: AuthRequest,
  response: Response,
  next: NextFunction,
) {
  const authorizationHeader = request.headers.authorization;

  if (!authorizationHeader?.startsWith("Bearer ")) {
    return response.status(401).json({ message: "Missing or invalid token." });
  }

  const token = authorizationHeader.split(" ")[1];
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    return response.status(500).json({ message: "JWT secret is not configured." });
  }

  try {
    const decodedToken = jwt.verify(token, jwtSecret) as JwtPayload;

    if (
      typeof decodedToken.userId !== "string" ||
      !isValidObjectId(decodedToken.userId)
    ) {
      return response.status(401).json({ message: "Missing or invalid token." });
    }

    request.userId = decodedToken.userId;
    next();
  } catch {
    return response.status(401).json({ message: "Missing or invalid token." });
  }
}
