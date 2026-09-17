import { Response } from "express";
import { isValidObjectId } from "mongoose";
import { AuthRequest } from "../middleware/authMiddleware";
import Board from "../models/Board";
import Column from "../models/Column";
import Task from "../models/Task";
import User from "../models/User";
import { getTeamAccess } from "../utils/teamAccess";

export async function createTask(request: AuthRequest, response: Response) {
  try {
    const { columnId } = request.params;
    const { title, description, assignedUserId } = request.body ?? {};

    if (typeof title !== "string" || !title.trim()) {
      return response.status(400).json({ message: "Task title is required." });
    }

    if (description !== undefined && typeof description !== "string") {
      return response.status(400).json({ message: "Description must be text." });
    }

    if (typeof columnId !== "string" || !isValidObjectId(columnId)) {
      return response.status(404).json({ message: "Column not found." });
    }

    const column = await Column.findById(columnId);

    if (!column) {
      return response.status(404).json({ message: "Column not found." });
    }

    const board = await Board.findById(column.boardId);

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

    let assignedUserIdForTask: string | null = null;

    if (assignedUserId !== undefined && assignedUserId !== null) {
      if (typeof assignedUserId !== "string" || !isValidObjectId(assignedUserId)) {
        return response.status(400).json({ message: "Invalid assigned user." });
      }

      const assignedUser = await User.findById(assignedUserId);

      if (!assignedUser) {
        return response.status(404).json({ message: "Assigned user not found." });
      }

      const userBelongsToTeam = team.members.some(
        (member) => member.user.toString() === assignedUser._id.toString(),
      );

      if (!userBelongsToTeam) {
        return response
          .status(400)
          .json({ message: "Assigned user must belong to the team." });
      }

      assignedUserIdForTask = assignedUser._id.toString();
    }

    const task = await Task.create({
      title: title.trim(),
      description: description ?? "",
      columnId,
      assignedUserId: assignedUserIdForTask,
    });

    return response.status(201).json(task);
  } catch (error) {
    console.error("Could not create task:", error);
    return response.status(500).json({ message: "Could not create task." });
  }
}

export async function getTasks(request: AuthRequest, response: Response) {
  try {
    const { columnId } = request.params;

    if (typeof columnId !== "string" || !isValidObjectId(columnId)) {
      return response.status(404).json({ message: "Column not found." });
    }

    const column = await Column.findById(columnId);

    if (!column) {
      return response.status(404).json({ message: "Column not found." });
    }

    const board = await Board.findById(column.boardId);

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

    const tasks = await Task.find({ columnId });
    return response.json(tasks);
  } catch (error) {
    console.error("Could not get tasks:", error);
    return response.status(500).json({ message: "Could not get tasks." });
  }
}

export async function getTask(request: AuthRequest, response: Response) {
  try {
    const { taskId } = request.params;

    if (typeof taskId !== "string" || !isValidObjectId(taskId)) {
      return response.status(404).json({ message: "Task not found." });
    }

    const task = await Task.findById(taskId);

    if (!task) {
      return response.status(404).json({ message: "Task not found." });
    }

    const column = await Column.findById(task.columnId);

    if (!column) {
      return response.status(404).json({ message: "Column not found." });
    }

    const board = await Board.findById(column.boardId);

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

    return response.json(task);
  } catch (error) {
    console.error("Could not get task:", error);
    return response.status(500).json({ message: "Could not get task." });
  }
}

export async function updateTask(request: AuthRequest, response: Response) {
  try {
    const { taskId } = request.params;
    const { title, description, assignedUserId } = request.body ?? {};

    if (title === undefined && description === undefined && assignedUserId === undefined) {
      return response.status(400).json({ message: "No task changes were provided." });
    }

    if (title !== undefined && (typeof title !== "string" || !title.trim())) {
      return response.status(400).json({ message: "Task title must not be empty." });
    }

    if (description !== undefined && typeof description !== "string") {
      return response.status(400).json({ message: "Description must be text." });
    }

    if (typeof taskId !== "string" || !isValidObjectId(taskId)) {
      return response.status(404).json({ message: "Task not found." });
    }

    const task = await Task.findById(taskId);

    if (!task) {
      return response.status(404).json({ message: "Task not found." });
    }

    const column = await Column.findById(task.columnId);

    if (!column) {
      return response.status(404).json({ message: "Column not found." });
    }

    const board = await Board.findById(column.boardId);

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

    if (title !== undefined) {
      task.title = title.trim();
    }

    if (description !== undefined) {
      task.description = description;
    }

    if (assignedUserId !== undefined) {
      if (assignedUserId === null) {
        task.assignedUserId = null;
      } else {
        if (typeof assignedUserId !== "string" || !isValidObjectId(assignedUserId)) {
          return response.status(400).json({ message: "Invalid assigned user." });
        }

        const assignedUser = await User.findById(assignedUserId);

        if (!assignedUser) {
          return response.status(404).json({ message: "Assigned user not found." });
        }

        const userBelongsToTeam = team.members.some(
          (member) => member.user.toString() === assignedUser._id.toString(),
        );

        if (!userBelongsToTeam) {
          return response
            .status(400)
            .json({ message: "Assigned user must belong to the team." });
        }

        task.assignedUserId = assignedUser._id;
      }
    }

    await task.save();
    return response.json(task);
  } catch (error) {
    console.error("Could not update task:", error);
    return response.status(500).json({ message: "Could not update task." });
  }
}

export async function deleteTask(request: AuthRequest, response: Response) {
  try {
    const { taskId } = request.params;

    if (typeof taskId !== "string" || !isValidObjectId(taskId)) {
      return response.status(404).json({ message: "Task not found." });
    }

    const task = await Task.findById(taskId);

    if (!task) {
      return response.status(404).json({ message: "Task not found." });
    }

    const column = await Column.findById(task.columnId);

    if (!column) {
      return response.status(404).json({ message: "Column not found." });
    }

    const board = await Board.findById(column.boardId);

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

    await task.deleteOne();
    return response.json({ message: "Task deleted successfully." });
  } catch (error) {
    console.error("Could not delete task:", error);
    return response.status(500).json({ message: "Could not delete task." });
  }
}

export async function moveTask(request: AuthRequest, response: Response) {
  try {
    const { taskId } = request.params;
    const { columnId } = request.body ?? {};

    if (typeof columnId !== "string" || !isValidObjectId(columnId)) {
      return response.status(400).json({ message: "A valid column ID is required." });
    }

    if (typeof taskId !== "string" || !isValidObjectId(taskId)) {
      return response.status(404).json({ message: "Task not found." });
    }

    const task = await Task.findById(taskId);

    if (!task) {
      return response.status(404).json({ message: "Task not found." });
    }

    const currentColumn = await Column.findById(task.columnId);

    if (!currentColumn) {
      return response.status(404).json({ message: "Current column not found." });
    }

    const currentBoard = await Board.findById(currentColumn.boardId);

    if (!currentBoard) {
      return response.status(404).json({ message: "Current board not found." });
    }

    const { team, role } = await getTeamAccess(
      currentBoard.teamId.toString(),
      request.userId!,
    );

    if (!team) {
      return response.status(404).json({ message: "Team not found." });
    }

    if (!role) {
      return response.status(403).json({ message: "Team access is required." });
    }

    const destinationColumn = await Column.findById(columnId);

    if (!destinationColumn) {
      return response.status(404).json({ message: "Destination column not found." });
    }

    const destinationBoard = await Board.findById(destinationColumn.boardId);

    if (!destinationBoard) {
      return response.status(404).json({ message: "Destination board not found." });
    }

    if (destinationBoard.teamId.toString() !== currentBoard.teamId.toString()) {
      return response
        .status(403)
        .json({ message: "Tasks cannot be moved to another team." });
    }

    task.columnId = destinationColumn._id;
    await task.save();

    return response.json(task);
  } catch (error) {
    console.error("Could not move task:", error);
    return response.status(500).json({ message: "Could not move task." });
  }
}
