import mongoose from "mongoose";
import { logger } from "./logger";
export async function connectDatabase(): Promise<void> {
  const databaseUri = process.env.MONGODB_URI;
  if (!databaseUri) throw new Error("Database configuration is missing.");
  await mongoose.connect(databaseUri, { serverSelectionTimeoutMS: 10000 });
  await Promise.all(
    Object.values(mongoose.models).map((model) => model.init()),
  );
  logger.info({ event: "database_connected" }, "Connected to MongoDB");
}
