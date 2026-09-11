import bcrypt from "bcrypt";
import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";

export async function register(request: Request, response: Response) {
  try {
    const { name, email, password } = request.body;

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      !name.trim() ||
      !email.trim() ||
      !password
    ) {
      return response
        .status(400)
        .json({ message: "Name, email and password are required." });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return response.status(400).json({ message: "Email already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await User.create({
      name,
      email: normalizedEmail,
      password: hashedPassword,
    });

    return response.status(201).json({ message: "User registered successfully." });
  } catch (error) {
    console.error("Registration failed:", error);
    return response.status(500).json({ message: "Could not register user." });
  }
}

export async function login(request: Request, response: Response) {
  try {
    const { email, password } = request.body;

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return response
        .status(400)
        .json({ message: "Email and password are required." });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return response.status(401).json({ message: "Invalid email or password." });
    }

    const passwordIsCorrect = await bcrypt.compare(password, user.password);

    if (!passwordIsCorrect) {
      return response.status(401).json({ message: "Invalid email or password." });
    }

    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      return response.status(500).json({ message: "JWT secret is not configured." });
    }

    const token = jwt.sign({ userId: user._id.toString() }, jwtSecret, {
      expiresIn: "1h",
    });

    return response.json({ token });
  } catch (error) {
    console.error("Login failed:", error);
    return response.status(500).json({ message: "Could not log in." });
  }
}
