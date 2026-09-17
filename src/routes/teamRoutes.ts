import { Router } from "express";
import {
  addTeamMember,
  createTeam,
  getTeams,
} from "../controllers/teamController";
import { authenticate } from "../middleware/authMiddleware";

const teamRouter = Router();

teamRouter.use(authenticate);
teamRouter.post("/teams", createTeam);
teamRouter.get("/teams", getTeams);
teamRouter.post("/teams/:teamId/members", addTeamMember);

export default teamRouter;
