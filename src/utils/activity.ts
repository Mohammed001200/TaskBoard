import { ClientSession } from "mongoose";
import Activity from "../models/Activity";
import { ActivityAction } from "../interfaces/models";
export async function logActivity(
  taskId: string,
  actorId: string | null,
  action: ActivityAction,
  details: Record<string, unknown> = {},
  session?: ClientSession,
) {
  // Only IDs and field names belong here, never task/comment text or account data.
  await Activity.create([{ taskId, actorId, action, details }], { session });
}
