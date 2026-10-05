import { Response } from "express";
import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import User from "../models/User";
import Team from "../models/Team";
import Task from "../models/Task";
import Comment from "../models/Comment";
import Activity from "../models/Activity";
import { AuthRequest } from "../middleware/authMiddleware";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../errors/AppError";
import { inTransaction } from "../utils/transaction";
import { logActivity } from "../utils/activity";
export async function getProfile(request: AuthRequest, response: Response) {
  response.json(await User.findOne({ _id: request.userId, deletedAt: null }));
}
export async function updateProfile(request: AuthRequest, response: Response) {
  const user = await User.findOne({ _id: request.userId, deletedAt: null });
  if (!user) throw new NotFoundError("User not found.");
  if (request.body.name !== undefined) user.name = request.body.name;
  if (request.body.email !== undefined) user.email = request.body.email;
  if (request.body.password !== undefined)
    user.password = await bcrypt.hash(request.body.password, 10);
  await user.save();
  response.json(user);
}
export async function getUsers(request: AuthRequest, response: Response) {
  if (!request.isAdmin)
    throw new ForbiddenError("System administrator access is required.");
  response.json(await User.find({ deletedAt: null }));
}
export async function deleteProfile(request: AuthRequest, response: Response) {
  if (
    await Team.exists({
      deletedAt: null,
      $or: [
        { ownerId: request.userId },
        {
          members: {
            $elemMatch: {
              user: request.userId,
              role: { $in: ["owner", "admin"] },
            },
          },
        },
      ],
    })
  )
    throw new ConflictError(
      "Delete your active teams before deleting your account.",
    );
  const unusablePassword = await bcrypt.hash(
    randomBytes(32).toString("hex"),
    10,
  );
  await inTransaction(async (session) => {
    const user = await User.findOne({
      _id: request.userId,
      deletedAt: null,
    }).session(session);
    if (!user) throw new NotFoundError("User not found.");
    user.name = "Deleted user";
    user.email =
      "deleted-" + randomBytes(24).toString("hex") + "@example.invalid";
    user.password = unusablePassword;
    user.isAdmin = false;
    user.deletedAt = new Date();
    await user.save({ session });
    await Team.updateMany(
      { "members.user": user._id },
      { $pull: { members: { user: user._id } } },
      { session },
    );
    for (const task of await Task.find({ assignedUserId: user._id }).session(
      session,
    )) {
      task.assignedUserId = null;
      await task.save({ session });
      await logActivity(task._id.toString(), null, "unassigned", {}, session);
    }
    await Comment.updateMany(
      { authorId: user._id },
      { $set: { authorId: null, text: "[deleted]" } },
      { session },
    );
    await Activity.updateMany(
      { actorId: user._id },
      { $set: { actorId: null } },
      { session },
    );
  });
  response.json({ message: "Account anonymized successfully." });
}
