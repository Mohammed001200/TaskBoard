import "dotenv/config";
import mongoose, { Types } from "mongoose";
import { connectDatabase } from "../config/database";
import { logger } from "../config/logger";
import User from "../models/User";
import Team from "../models/Team";
import Board from "../models/Board";
import Column from "../models/Column";
import Task from "../models/Task";
async function run() {
  try {
    await connectDatabase();
    let changed = 0;
    for (const name of ["users", "teams", "boards", "columns", "tasks"]) {
      const collection = mongoose.connection.collection(name);
      for (const row of await collection.find({}).toArray()) {
        const set: Record<string, unknown> = {};
        if (row.deletedAt === undefined) set.deletedAt = null;
        if (row.createdAt === undefined && row._id instanceof Types.ObjectId)
          set.createdAt = row._id.getTimestamp();
        if (row.updatedAt === undefined)
          set.updatedAt = set.createdAt ?? row.createdAt;
        if (name === "users" && row.isAdmin === undefined) set.isAdmin = false;
        if (name === "tasks") {
          if (row.deadline === undefined) set.deadline = null;
          if (row.priority === undefined) set.priority = "medium";
        }
        if (name === "columns" && row.allowedTransitions === undefined)
          set.allowedTransitions = null;
        if (name === "teams") {
          const members = (row.members ?? []) as {
            user: Types.ObjectId;
            role: string;
          }[];
          const legacyOwner = members.find(
            (member) => member.role === "admin" || member.role === "owner",
          );
          if (!row.ownerId && !legacyOwner)
            throw new Error("A legacy team needs an owner.");
          if (!row.ownerId) set.ownerId = legacyOwner!.user;
          if (members.some((member) => member.role === "admin"))
            set.members = members.map((member) => ({
              user: member.user,
              role: member.role === "admin" ? "owner" : member.role,
            }));
        }
        if (Object.keys(set).length) {
          await collection.updateOne({ _id: row._id }, { $set: set });
          changed++;
        }
      }
    }
    // Ensure new collections/indexes exist before using transactions.
    for (const model of [User, Team, Board, Column, Task]) await model.init();
    logger.info(
      { event: "migration_completed", changed },
      "Legacy data upgraded",
    );
  } catch {
    logger.error(
      { event: "migration_failed" },
      "Migration failed; inspect data locally before retrying",
    );
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
void run();
