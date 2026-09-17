import { Router } from "express";
import {
  createTask,
  deleteTask,
  getTask,
  getTasks,
  moveTask,
  updateTask,
} from "../controllers/taskController";
import { authenticate } from "../middleware/authMiddleware";

const taskRouter = Router();

taskRouter.use(authenticate);
taskRouter.post("/columns/:columnId/tasks", createTask);
taskRouter.get("/columns/:columnId/tasks", getTasks);
taskRouter.get("/tasks/:taskId", getTask);
taskRouter.patch("/tasks/:taskId", updateTask);
taskRouter.delete("/tasks/:taskId", deleteTask);
taskRouter.patch("/tasks/:taskId/move", moveTask);

export default taskRouter;
