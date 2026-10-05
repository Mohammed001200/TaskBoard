import "dotenv/config";
import mongoose from "mongoose";
import app from "./app";
import { connectDatabase } from "./config/database";
import { validateEnvironment } from "./config/environment";
import { logger } from "./config/logger";
async function startServer(): Promise<void> {
  try {
    const environment = validateEnvironment();
    await connectDatabase();
    const server = app.listen(environment.PORT, "0.0.0.0", () => {
      logger.info(
        { event: "server_started", port: environment.PORT },
        "Server started",
      );
    });
    server.on("error", () => {
      logger.error({ event: "server_start_failed" }, "Could not start server");
      process.exit(1);
    });
    const shutdown = () =>
      server.close(() => {
        void mongoose.disconnect().then(() => process.exit(0));
      });
    process.once("SIGTERM", shutdown);
    process.once("SIGINT", shutdown);
  } catch {
    // Driver errors may include credentials or connection URLs; never log them.
    logger.error(
      { event: "startup_failed" },
      "Server configuration or database connection failed",
    );
    process.exit(1);
  }
}
void startServer();
