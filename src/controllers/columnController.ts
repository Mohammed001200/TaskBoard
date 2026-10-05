import { Response } from "express";
import { Types } from "mongoose";
import { AuthRequest } from "../middleware/authMiddleware";
import { BadRequestError, ConflictError } from "../errors/AppError";
import Column from "../models/Column";
import Task from "../models/Task";
import { requireBoardAccess, requireColumnAccess } from "../utils/teamAccess";

async function validateAllowedTransitions(
  boardId: string,
  transitions: string[] | null,
) {
  if (transitions === null) return null;
  const ids = [...new Set(transitions.map((id) => id.toLowerCase()))];
  if (!ids.length) return [];
  const destinations = await Column.find({
    _id: { $in: ids },
    boardId,
    deletedAt: null,
  });
  if (destinations.length !== ids.length) {
    throw new BadRequestError(
      "Allowed transitions must target active columns in the same board.",
    );
  }
  return ids.map((id) => new Types.ObjectId(id));
}

export async function createColumn(request: AuthRequest, response: Response) {
  const { board } = await requireBoardAccess(
    request.params.boardId as string,
    request.userId!,
    true,
  );
  const { title, position, allowedTransitions = null } = request.body;
  const transitions = await validateAllowedTransitions(
    board._id.toString(),
    allowedTransitions,
  );
  const column = await Column.create({
    title,
    boardId: board._id,
    position,
    allowedTransitions: transitions,
  });
  return response.status(201).json(column);
}

export async function getColumns(request: AuthRequest, response: Response) {
  const { board } = await requireBoardAccess(
    request.params.boardId as string,
    request.userId!,
  );
  return response.json(
    await Column.find({ boardId: board._id, deletedAt: null }).sort({
      position: 1,
      _id: 1,
    }),
  );
}

export async function getColumn(request: AuthRequest, response: Response) {
  const { column } = await requireColumnAccess(
    request.params.columnId as string,
    request.userId!,
  );
  return response.json(column);
}

export async function updateColumn(request: AuthRequest, response: Response) {
  const { column, board } = await requireColumnAccess(
    request.params.columnId as string,
    request.userId!,
    true,
  );
  const { title, position, allowedTransitions } = request.body;
  if (title !== undefined) column.title = title;
  if (position !== undefined) column.position = position;
  if (allowedTransitions !== undefined) {
    column.allowedTransitions = await validateAllowedTransitions(
      board._id.toString(),
      allowedTransitions,
    );
  }
  await column.save();
  return response.json(column);
}

export async function deleteColumn(request: AuthRequest, response: Response) {
  const { column } = await requireColumnAccess(
    request.params.columnId as string,
    request.userId!,
    true,
  );
  if (await Task.exists({ columnId: column._id, deletedAt: null })) {
    throw new ConflictError(
      "A column containing active tasks cannot be deleted.",
    );
  }
  column.deletedAt = new Date();
  await column.save();
  return response.json({ message: "Column deleted successfully." });
}
