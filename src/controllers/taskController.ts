import { Response } from "express";
import { Types } from "mongoose";
import { AuthRequest } from "../middleware/authMiddleware";
import Task from "../models/Task";
import User from "../models/User";
import Activity from "../models/Activity";
import { requireColumnAccess, requireTaskAccess } from "../utils/teamAccess";
import { logActivity } from "../utils/activity";
import { inTransaction } from "../utils/transaction";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../errors/AppError";
import { ITeam } from "../interfaces/models";

async function checkAssignment(userId: string | null | undefined, team: ITeam) {
  if (userId === undefined || userId === null) return;
  const user = await User.findOne({ _id: userId, deletedAt: null });
  if (!user) throw new NotFoundError("Assigned user not found.");
  if (!team.members.some((member) => member.user.toString() === userId))
    throw new BadRequestError("Assigned user must belong to the team.");
}
export async function createTask(request: AuthRequest, response: Response) {
  const { column, team } = await requireColumnAccess(
    String(request.params.columnId),
    request.userId!,
  );
  await checkAssignment(request.body.assignedUserId, team);
  const task = await inTransaction(async (session) => {
    const [created] = await Task.create(
      [{ ...request.body, columnId: column._id }],
      { session },
    );
    await logActivity(
      created._id.toString(),
      request.userId!,
      "created",
      {},
      session,
    );
    if (created.assignedUserId)
      await logActivity(
        created._id.toString(),
        request.userId!,
        "assigned",
        { assignedUserId: created.assignedUserId.toString() },
        session,
      );
    return created;
  });
  response.status(201).json(task);
}
export async function getTasks(request: AuthRequest, response: Response) {
  const { column } = await requireColumnAccess(
    String(request.params.columnId),
    request.userId!,
  );
  response.json(
    await Task.find({ columnId: column._id, deletedAt: null }).sort({
      createdAt: 1,
      _id: 1,
    }),
  );
}
export async function getTask(request: AuthRequest, response: Response) {
  const { task } = await requireTaskAccess(
    String(request.params.taskId),
    request.userId!,
  );
  response.json(task);
}
export async function updateTask(request: AuthRequest, response: Response) {
  const { task, team } = await requireTaskAccess(
    String(request.params.taskId),
    request.userId!,
  );
  await checkAssignment(request.body.assignedUserId, team);
  const updated = await inTransaction(async (session) => {
    const current = await Task.findOne({
      _id: task._id,
      deletedAt: null,
    }).session(session);
    if (!current) throw new NotFoundError("Task not found.");
    const beforeAssignment = current.assignedUserId?.toString() ?? null;
    Object.assign(current, request.body);
    await current.save({ session });
    await logActivity(
      current._id.toString(),
      request.userId!,
      "updated",
      {
        fields: Object.keys(request.body).filter(
          (field) => field !== "assignedUserId",
        ),
      },
      session,
    );
    if (
      request.body.assignedUserId !== undefined &&
      beforeAssignment !== (request.body.assignedUserId ?? null)
    ) {
      await logActivity(
        current._id.toString(),
        request.userId!,
        current.assignedUserId ? "assigned" : "unassigned",
        { assignedUserId: current.assignedUserId?.toString() ?? null },
        session,
      );
    }
    return current;
  });
  response.json(updated);
}
export async function deleteTask(request: AuthRequest, response: Response) {
  const { task } = await requireTaskAccess(
    String(request.params.taskId),
    request.userId!,
    true,
  );
  await inTransaction(async (session) => {
    const current = await Task.findOne({
      _id: task._id,
      deletedAt: null,
    }).session(session);
    if (!current) throw new NotFoundError("Task not found.");
    current.deletedAt = new Date();
    await current.save({ session });
    await logActivity(
      current._id.toString(),
      request.userId!,
      "deleted",
      {},
      session,
    );
  });
  response.json({ message: "Task deleted successfully." });
}
export async function moveTask(request: AuthRequest, response: Response) {
  const {
    task,
    column: source,
    board: sourceBoard,
  } = await requireTaskAccess(String(request.params.taskId), request.userId!);
  const { column: destination, board: destinationBoard } =
    await requireColumnAccess(request.body.columnId, request.userId!);
  if (!sourceBoard.teamId.equals(destinationBoard.teamId))
    throw new ForbiddenError("Tasks cannot be moved to another team.");
  if (
    source.allowedTransitions !== null &&
    source.allowedTransitions !== undefined &&
    !source.allowedTransitions.some((id) => id.equals(destination._id))
  )
    throw new ConflictError("This column transition is not allowed.");
  const moved = await inTransaction(async (session) => {
    const current = await Task.findOne({
      _id: task._id,
      columnId: source._id,
      deletedAt: null,
    }).session(session);
    if (!current) throw new ConflictError("Task changed. Read it and retry.");
    current.columnId = new Types.ObjectId(destination._id);
    await current.save({ session });
    await logActivity(
      current._id.toString(),
      request.userId!,
      "moved",
      {
        fromColumnId: source._id.toString(),
        toColumnId: destination._id.toString(),
      },
      session,
    );
    return current;
  });
  response.json(moved);
}
export async function getActivities(request: AuthRequest, response: Response) {
  const { task } = await requireTaskAccess(
    String(request.params.taskId),
    request.userId!,
  );
  response.json(
    await Activity.find({ taskId: task._id }).sort({ createdAt: 1, _id: 1 }),
  );
}
