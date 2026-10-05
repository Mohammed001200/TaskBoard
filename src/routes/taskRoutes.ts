import { Router } from "express";
import {
  createTask,
  deleteTask,
  getTask,
  getTasks,
  moveTask,
  updateTask,
  getActivities,
} from "../controllers/taskController";
import {
  createComment,
  getComments,
  getComment,
  updateComment,
  deleteComment,
} from "../controllers/commentController";
import { authenticate } from "../middleware/authMiddleware";
const taskRouter = Router();
taskRouter.use(authenticate);
taskRouter.post("/columns/:columnId/tasks", createTask);
taskRouter.get("/columns/:columnId/tasks", getTasks);
taskRouter.get("/tasks/:taskId", getTask);
taskRouter.patch("/tasks/:taskId", updateTask);
taskRouter.delete("/tasks/:taskId", deleteTask);
taskRouter.patch("/tasks/:taskId/move", moveTask);
taskRouter.get("/tasks/:taskId/activities", getActivities);
taskRouter.post("/tasks/:taskId/comments", createComment);
taskRouter.get("/tasks/:taskId/comments", getComments);
taskRouter.get("/comments/:commentId", getComment);
taskRouter.patch("/comments/:commentId", updateComment);
taskRouter.delete("/comments/:commentId", deleteComment);
export default taskRouter;
