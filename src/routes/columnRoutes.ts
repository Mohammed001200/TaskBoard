import { Router } from "express";
import { createColumn, getColumns } from "../controllers/columnController";
import { authenticate } from "../middleware/authMiddleware";

const columnRouter = Router();

columnRouter.use(authenticate);
columnRouter.post("/boards/:boardId/columns", createColumn);
columnRouter.get("/boards/:boardId/columns", getColumns);

export default columnRouter;
