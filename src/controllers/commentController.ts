import { Response } from "express";
import { AuthRequest } from "../middleware/authMiddleware";
import Comment from "../models/Comment";
import { requireTaskAccess } from "../utils/teamAccess";
import { ForbiddenError, NotFoundError } from "../errors/AppError";
import { inTransaction } from "../utils/transaction";
import { logActivity } from "../utils/activity";

async function commentAccess(commentId: string, userId: string, edit = false) {
  const comment = await Comment.findOne({ _id: commentId, deletedAt: null });
  if (!comment) throw new NotFoundError("Comment not found.");
  const access = await requireTaskAccess(comment.taskId.toString(), userId);
  if (
    edit &&
    access.role === "member" &&
    comment.authorId?.toString() !== userId
  )
    throw new ForbiddenError(
      "Only the author or project owner may edit this comment.",
    );
  return { comment, ...access };
}
export async function createComment(request: AuthRequest, response: Response) {
  const { task } = await requireTaskAccess(
    String(request.params.taskId),
    request.userId!,
  );
  const comment = await inTransaction(async (session) => {
    const [created] = await Comment.create(
      [
        {
          text: request.body.text,
          authorId: request.userId!,
          taskId: task._id,
        },
      ],
      { session },
    );
    await logActivity(
      task._id.toString(),
      request.userId!,
      "commented",
      { commentId: created._id.toString() },
      session,
    );
    return created;
  });
  response.status(201).json(comment);
}
export async function getComments(request: AuthRequest, response: Response) {
  const { task } = await requireTaskAccess(
    String(request.params.taskId),
    request.userId!,
  );
  response.json(
    await Comment.find({ taskId: task._id, deletedAt: null }).sort({
      createdAt: 1,
      _id: 1,
    }),
  );
}
export async function getComment(request: AuthRequest, response: Response) {
  const { comment } = await commentAccess(
    String(request.params.commentId),
    request.userId!,
  );
  response.json(comment);
}
export async function updateComment(request: AuthRequest, response: Response) {
  const { comment, task } = await commentAccess(
    String(request.params.commentId),
    request.userId!,
    true,
  );
  await inTransaction(async (session) => {
    comment.text = request.body.text;
    await comment.save({ session });
    await logActivity(
      task._id.toString(),
      request.userId!,
      "comment_updated",
      { commentId: comment._id.toString() },
      session,
    );
  });
  response.json(comment);
}
export async function deleteComment(request: AuthRequest, response: Response) {
  const { comment, task } = await commentAccess(
    String(request.params.commentId),
    request.userId!,
    true,
  );
  await inTransaction(async (session) => {
    comment.deletedAt = new Date();
    await comment.save({ session });
    await logActivity(
      task._id.toString(),
      request.userId!,
      "comment_deleted",
      { commentId: comment._id.toString() },
      session,
    );
  });
  response.json({ message: "Comment deleted successfully." });
}
