import mongoose from "mongoose";

export async function connectDatabase(): Promise<void> {
  const databaseUri = process.env.MONGODB_URI;

  if (!databaseUri) {
    throw new Error("MONGODB_URI is missing from the environment variables.");
  }

  await mongoose.connect(databaseUri);
  console.log("Connected to MongoDB");
}
