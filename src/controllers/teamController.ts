import { Response } from "express";
import { Types } from "mongoose";
import { AuthRequest } from "../middleware/authMiddleware";
import { ConflictError, NotFoundError } from "../errors/AppError";
import Board from "../models/Board";
import Column from "../models/Column";
import Task from "../models/Task";
import Team from "../models/Team";
import User from "../models/User";
import { logActivity } from "../utils/activity";
import { requireTeamAccess } from "../utils/teamAccess";
import { inTransaction } from "../utils/transaction";

export async function createTeam(request: AuthRequest, response: Response) {
  const { name } = request.body;
  const team = await Team.create({
    name,
    ownerId: request.userId,
    members: [{ user: request.userId, role: "owner" }],
  });
  return response.status(201).json(team);
}

export async function getTeams(request: AuthRequest, response: Response) {
  const user = await User.findOne({
    _id: request.userId,
    deletedAt: null,
  }).select("isAdmin");
  const filter = user?.isAdmin
    ? { deletedAt: null }
    : {
        deletedAt: null,
        $or: [{ ownerId: request.userId }, { "members.user": request.userId }],
      };
  return response.json(await Team.find(filter));
}

export async function getTeam(request: AuthRequest, response: Response) {
  const { team } = await requireTeamAccess(
    request.params.teamId as string,
    request.userId!,
  );
  return response.json(team);
}

export async function updateTeam(request: AuthRequest, response: Response) {
  const { team } = await requireTeamAccess(
    request.params.teamId as string,
    request.userId!,
    true,
  );
  team.name = request.body.name;
  await team.save();
  return response.json(team);
}

export async function deleteTeam(request: AuthRequest, response: Response) {
  const { team } = await requireTeamAccess(
    request.params.teamId as string,
    request.userId!,
    true,
  );
  team.deletedAt = new Date();
  await team.save();
  return response.json({ message: "Team deleted successfully." });
}

export async function addTeamMember(request: AuthRequest, response: Response) {
  const { team } = await requireTeamAccess(
    request.params.teamId as string,
    request.userId!,
    true,
  );
  const email = request.body.email.trim().toLowerCase();
  const user = await User.findOne({ email, deletedAt: null });
  if (!user) throw new NotFoundError("User not found.");
  if (
    team.members.some(
      (member) => member.user.toString() === user._id.toString(),
    )
  ) {
    throw new ConflictError("User is already a team member.");
  }
  team.members.push({ user: user._id, role: "member" });
  await team.save();
  return response.status(201).json(team);
}

export async function removeTeamMember(
  request: AuthRequest,
  response: Response,
) {
  const { team } = await requireTeamAccess(
    request.params.teamId as string,
    request.userId!,
    true,
  );
  const userId = new Types.ObjectId(request.params.userId as string).toString();

  const updatedTeam = await inTransaction(async (session) => {
    const currentTeam = await Team.findOne({
      _id: team._id,
      deletedAt: null,
    }).session(session);
    if (!currentTeam) throw new NotFoundError("Team not found.");
    const member = currentTeam.members.find(
      (entry) => entry.user.toString() === userId,
    );
    if (!member) throw new NotFoundError("Team member not found.");
    if (
      currentTeam.ownerId?.toString() === userId ||
      member.role === "owner" ||
      member.role === "admin"
    ) {
      throw new ConflictError("The team owner cannot be removed.");
    }

    const boards = await Board.find({ teamId: currentTeam._id }).session(
      session,
    );
    const columns = await Column.find({
      boardId: { $in: boards.map((board) => board._id) },
    }).session(session);
    const tasks = await Task.find({
      columnId: { $in: columns.map((column) => column._id) },
      assignedUserId: userId,
    }).session(session);

    for (const task of tasks) {
      task.assignedUserId = null;
      await task.save({ session });
      await logActivity(
        task._id.toString(),
        request.userId!,
        "unassigned",
        { previousAssignedUserId: userId, teamId: currentTeam._id.toString() },
        session,
      );
    }
    currentTeam.members = currentTeam.members.filter(
      (entry) => entry.user.toString() !== userId,
    );
    await currentTeam.save({ session });
    return currentTeam;
  });

  return response.json(updatedTeam);
}
