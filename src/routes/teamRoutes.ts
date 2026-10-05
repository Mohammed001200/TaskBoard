import { Router } from "express";
import {
  addTeamMember,
  createTeam,
  deleteTeam,
  getTeam,
  getTeams,
  removeTeamMember,
  updateTeam,
} from "../controllers/teamController";
import { authenticate } from "../middleware/authMiddleware";

const teamRouter = Router();

teamRouter.use(authenticate);
teamRouter.post("/teams", createTeam);
teamRouter.get("/teams", getTeams);
teamRouter.get("/teams/:teamId", getTeam);
teamRouter.patch("/teams/:teamId", updateTeam);
teamRouter.delete("/teams/:teamId", deleteTeam);
teamRouter.post("/teams/:teamId/members", addTeamMember);
teamRouter.delete("/teams/:teamId/members/:userId", removeTeamMember);

export default teamRouter;
