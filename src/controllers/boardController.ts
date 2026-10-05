import { Response } from "express";
import { AuthRequest } from "../middleware/authMiddleware";
import Board from "../models/Board";
import { requireBoardAccess, requireTeamAccess } from "../utils/teamAccess";

export async function createBoard(request: AuthRequest, response: Response) {
  const { team } = await requireTeamAccess(
    request.params.teamId as string,
    request.userId!,
    true,
  );
  const board = await Board.create({
    title: request.body.title,
    teamId: team._id,
  });
  return response.status(201).json(board);
}

export async function getBoards(request: AuthRequest, response: Response) {
  const { team } = await requireTeamAccess(
    request.params.teamId as string,
    request.userId!,
  );
  return response.json(await Board.find({ teamId: team._id, deletedAt: null }));
}

export async function getBoard(request: AuthRequest, response: Response) {
  const { board } = await requireBoardAccess(
    request.params.boardId as string,
    request.userId!,
  );
  return response.json(board);
}

export async function updateBoard(request: AuthRequest, response: Response) {
  const { board } = await requireBoardAccess(
    request.params.boardId as string,
    request.userId!,
    true,
  );
  board.title = request.body.title;
  await board.save();
  return response.json(board);
}

export async function deleteBoard(request: AuthRequest, response: Response) {
  const { board } = await requireBoardAccess(
    request.params.boardId as string,
    request.userId!,
    true,
  );
  board.deletedAt = new Date();
  await board.save();
  return response.json({ message: "Board deleted successfully." });
}
