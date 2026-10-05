import Team from "../models/Team";
import User from "../models/User";
import Board from "../models/Board";
import Column from "../models/Column";
import Task from "../models/Task";
import { ForbiddenError, NotFoundError } from "../errors/AppError";
export async function getTeamAccess(teamId: string, userId: string) {
  const team = await Team.findOne({ _id: teamId, deletedAt: null });
  if (!team) return { team: null, role: null };
  const user = await User.findOne({ _id: userId, deletedAt: null });
  const membership = team.members.find(
    (member) => member.user.toString() === userId,
  );
  const role = user?.isAdmin
    ? "admin"
    : team.ownerId?.toString() === userId ||
        membership?.role === "admin" ||
        membership?.role === "owner"
      ? "owner"
      : (membership?.role ?? null);
  return { team, role };
}
export async function requireTeamAccess(
  teamId: string,
  userId: string,
  ownerOnly = false,
) {
  const { team, role } = await getTeamAccess(teamId, userId);
  if (!team) throw new NotFoundError("Team not found.");
  if (!role || (ownerOnly && role === "member"))
    throw new ForbiddenError(
      ownerOnly
        ? "Project owner access is required."
        : "Team access is required.",
    );
  return { team, role };
}
export async function requireBoardAccess(
  boardId: string,
  userId: string,
  ownerOnly = false,
) {
  const board = await Board.findOne({ _id: boardId, deletedAt: null });
  if (!board) throw new NotFoundError("Board not found.");
  return {
    board,
    ...(await requireTeamAccess(board.teamId.toString(), userId, ownerOnly)),
  };
}
export async function requireColumnAccess(
  columnId: string,
  userId: string,
  ownerOnly = false,
) {
  const column = await Column.findOne({ _id: columnId, deletedAt: null });
  if (!column) throw new NotFoundError("Column not found.");
  return {
    column,
    ...(await requireBoardAccess(column.boardId.toString(), userId, ownerOnly)),
  };
}
export async function requireTaskAccess(
  taskId: string,
  userId: string,
  ownerOnly = false,
) {
  const task = await Task.findOne({ _id: taskId, deletedAt: null });
  if (!task) throw new NotFoundError("Task not found.");
  return {
    task,
    ...(await requireColumnAccess(task.columnId.toString(), userId, ownerOnly)),
  };
}
