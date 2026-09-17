import { Response } from "express";
import { isValidObjectId } from "mongoose";
import { AuthRequest } from "../middleware/authMiddleware";
import Team from "../models/Team";
import User from "../models/User";
import { getTeamAccess } from "../utils/teamAccess";

export async function createTeam(request: AuthRequest, response: Response) {
  try {
    const { name } = request.body ?? {};

    if (typeof name !== "string" || !name.trim()) {
      return response.status(400).json({ message: "Team name is required." });
    }

    const team = await Team.create({
      name: name.trim(),
      members: [{ user: request.userId, role: "admin" }],
    });

    return response.status(201).json(team);
  } catch (error) {
    console.error("Could not create team:", error);
    return response.status(500).json({ message: "Could not create team." });
  }
}

export async function getTeams(request: AuthRequest, response: Response) {
  try {
    const teams = await Team.find({ "members.user": request.userId });
    return response.json(teams);
  } catch (error) {
    console.error("Could not get teams:", error);
    return response.status(500).json({ message: "Could not get teams." });
  }
}

export async function addTeamMember(request: AuthRequest, response: Response) {
  try {
    const { teamId } = request.params;
    const { email } = request.body ?? {};

    if (
      typeof email !== "string" ||
      !email.trim() ||
      !email.trim().includes("@")
    ) {
      return response.status(400).json({ message: "A valid email is required." });
    }

    if (typeof teamId !== "string" || !isValidObjectId(teamId)) {
      return response.status(404).json({ message: "Team not found." });
    }

    const { team, role } = await getTeamAccess(teamId, request.userId!);

    if (!team) {
      return response.status(404).json({ message: "Team not found." });
    }

    if (role !== "admin") {
      return response.status(403).json({ message: "Admin access is required." });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return response.status(404).json({ message: "User not found." });
    }

    const isAlreadyMember = team.members.some(
      (member) => member.user.toString() === user._id.toString(),
    );

    if (isAlreadyMember) {
      return response.status(400).json({ message: "User is already a team member." });
    }

    team.members.push({ user: user._id, role: "member" });
    await team.save();

    return response.status(201).json(team);
  } catch (error) {
    console.error("Could not add team member:", error);
    return response.status(500).json({ message: "Could not add team member." });
  }
}
