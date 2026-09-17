import { Response } from "express";
import { isValidObjectId } from "mongoose";
import { AuthRequest } from "../middleware/authMiddleware";
import Board from "../models/Board";
import Column from "../models/Column";
import { getTeamAccess } from "../utils/teamAccess";

export async function createColumn(request: AuthRequest, response: Response) {
  try {
    const { boardId } = request.params;
    const { title, position } = request.body ?? {};

    if (
      typeof title !== "string" ||
      !title.trim() ||
      typeof position !== "number" ||
      !Number.isFinite(position)
    ) {
      return response
        .status(400)
        .json({ message: "Column title and numeric position are required." });
    }

    if (typeof boardId !== "string" || !isValidObjectId(boardId)) {
      return response.status(404).json({ message: "Board not found." });
    }

    const board = await Board.findById(boardId);

    if (!board) {
      return response.status(404).json({ message: "Board not found." });
    }

    const { team, role } = await getTeamAccess(
      board.teamId.toString(),
      request.userId!,
    );

    if (!team) {
      return response.status(404).json({ message: "Team not found." });
    }

    if (role !== "admin") {
      return response.status(403).json({ message: "Admin access is required." });
    }

    const column = await Column.create({
      title: title.trim(),
      boardId,
      position,
    });

    return response.status(201).json(column);
  } catch (error) {
    console.error("Could not create column:", error);
    return response.status(500).json({ message: "Could not create column." });
  }
}

export async function getColumns(request: AuthRequest, response: Response) {
  try {
    const { boardId } = request.params;

    if (typeof boardId !== "string" || !isValidObjectId(boardId)) {
      return response.status(404).json({ message: "Board not found." });
    }

    const board = await Board.findById(boardId);

    if (!board) {
      return response.status(404).json({ message: "Board not found." });
    }

    const { team, role } = await getTeamAccess(
      board.teamId.toString(),
      request.userId!,
    );

    if (!team) {
      return response.status(404).json({ message: "Team not found." });
    }

    if (!role) {
      return response.status(403).json({ message: "Team access is required." });
    }

    const columns = await Column.find({ boardId }).sort({ position: 1 });
    return response.json(columns);
  } catch (error) {
    console.error("Could not get columns:", error);
    return response.status(500).json({ message: "Could not get columns." });
  }
}
