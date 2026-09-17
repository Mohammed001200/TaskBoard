import Team from "../models/Team";

export async function getTeamAccess(teamId: string, userId: string) {
  const team = await Team.findById(teamId);

  if (!team) {
    return { team: null, role: null };
  }

  const membership = team.members.find(
    (member) => member.user.toString() === userId,
  );

  return {
    team,
    role: membership?.role ?? null,
  };
}
