import { Router } from "express";
import {
  createColumn,
  deleteColumn,
  getColumn,
  getColumns,
  updateColumn,
} from "../controllers/columnController";
import { authenticate } from "../middleware/authMiddleware";

const columnRouter = Router();

columnRouter.use(authenticate);
columnRouter.post("/boards/:boardId/columns", createColumn);
columnRouter.get("/boards/:boardId/columns", getColumns);
columnRouter.get("/columns/:columnId", getColumn);
columnRouter.patch("/columns/:columnId", updateColumn);
columnRouter.delete("/columns/:columnId", deleteColumn);

export default columnRouter;
