import { Router } from "express";
import { createBoard, getBoards } from "../controllers/boardController";
import { authenticate } from "../middleware/authMiddleware";

const boardRouter = Router();

boardRouter.use(authenticate);
boardRouter.post("/teams/:teamId/boards", createBoard);
boardRouter.get("/teams/:teamId/boards", getBoards);

export default boardRouter;
