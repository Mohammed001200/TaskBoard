import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User";
import { UnauthorizedError } from "../errors/AppError";
export async function register(request: Request, response: Response) {
  const { name, email, password } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  await User.create({ name, email, password: hashedPassword, isAdmin: false });
  response.status(201).json({ message: "User registered successfully." });
}
export async function login(request: Request, response: Response) {
  const { email, password } = request.body;
  const user = await User.findOne({ email, deletedAt: null }).select(
    "+password",
  );
  if (!user || !(await bcrypt.compare(password, user.password)))
    throw new UnauthorizedError("Invalid email or password.");
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT configuration is missing.");
  const token = jwt.sign({ userId: user._id.toString() }, secret, {
    algorithm: "HS256",
    expiresIn: "1h",
  });
  response.json({ token });
}
