import mongoose, { ClientSession } from "mongoose";
export async function inTransaction<T>(
  operation: (session: ClientSession) => Promise<T>,
): Promise<T> {
  return mongoose.connection.transaction(operation);
}
