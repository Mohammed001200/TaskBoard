import "dotenv/config";
import mongoose from "mongoose";
import { z } from "zod";
import { connectDatabase } from "../config/database";
import User from "../models/User";
import { logger } from "../config/logger";
async function run() {
  try {
    const email = z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.email())
      .parse(process.argv[2]);
    await connectDatabase();
    const result = await User.updateOne(
      { email, deletedAt: null },
      { $set: { isAdmin: true } },
      { runValidators: true },
    );
    if (!result.matchedCount) throw new Error("No active account.");
    logger.info(
      { event: "administrator_granted" },
      "Administrator permission granted",
    );
  } catch {
    logger.error(
      { event: "administrator_grant_failed" },
      "Provide the email of an existing active account",
    );
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
void run();
