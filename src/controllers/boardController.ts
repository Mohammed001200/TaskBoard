import { Response } from "express";
import { isValidObjectId } from "mongoose";
import { AuthRequest } from "../middleware/authMiddleware";
import Board from "../models/Board";
import { getTeamAccess } from "../utils/teamAccess";

export async function createBoard(request: AuthRequest, response: Response) {
  try {
    const { teamId } = request.params;
    const { title } = request.body ?? {};

    if (typeof title !== "string" || !title.trim()) {
      return response.status(400).json({ message: "Board title is required." });
    }

    if (typeof teamId !== "string" || !isValidObjectId(teamId)) {
      return response.status(404).json({ message: "Team not found." });
    }

    const { team, role } = await getTeamAccess(teamId, request.userId!);

    if (!team) {
      return response.status(404).json({ message: "Team not found." });
    }

    if (role !== "admin") {
      return response.status(403).json({ message: "Admin access is required." });
    }

    const board = await Board.create({ title: title.trim(), teamId });
    return response.status(201).json(board);
  } catch (error) {
    console.error("Could not create board:", error);
    return response.status(500).json({ message: "Could not create board." });
  }
}

export async function getBoards(request: AuthRequest, response: Response) {
  try {
    const { teamId } = request.params;

    if (typeof teamId !== "string" || !isValidObjectId(teamId)) {
      return response.status(404).json({ message: "Team not found." });
    }

    const { team, role } = await getTeamAccess(teamId, request.userId!);

    if (!team) {
      return response.status(404).json({ message: "Team not found." });
    }

    if (!role) {
      return response.status(403).json({ message: "Team access is required." });
    }

    const boards = await Board.find({ teamId });
    return response.json(boards);
  } catch (error) {
    console.error("Could not get boards:", error);
    return response.status(500).json({ message: "Could not get boards." });
  }
}
