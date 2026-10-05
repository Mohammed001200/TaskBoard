import { Router } from "express";
import {
  createBoard,
  deleteBoard,
  getBoard,
  getBoards,
  updateBoard,
} from "../controllers/boardController";
import { authenticate } from "../middleware/authMiddleware";

const boardRouter = Router();

boardRouter.use(authenticate);
boardRouter.post("/teams/:teamId/boards", createBoard);
boardRouter.get("/teams/:teamId/boards", getBoards);
boardRouter.get("/boards/:boardId", getBoard);
boardRouter.patch("/boards/:boardId", updateBoard);
boardRouter.delete("/boards/:boardId", deleteBoard);

export default boardRouter;
