import express from "express";
import authRouter from "./routes/authRoutes";
import boardRouter from "./routes/boardRoutes";
import columnRouter from "./routes/columnRoutes";
import healthRouter from "./routes/healthRoutes";
import taskRouter from "./routes/taskRoutes";
import teamRouter from "./routes/teamRoutes";
import userRouter from "./routes/userRoutes";
import { validateApiInput } from "./validation/apiSchemas";
import { errorHandler } from "./middleware/errorHandler";
import { NotFoundError } from "./errors/AppError";
import { logger } from "./config/logger";
const app = express();
app.disable("x-powered-by");
app.use((_request, response, next) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Cache-Control", "no-store");
  next();
});
app.use((request, response, next) => {
  const started = Date.now();
  response.on("finish", () => {
    // Log matched route patterns, never URLs, headers, IDs, body or raw error messages.
    logger.info(
      {
        event: "http_request",
        method: request.method,
        route: request.route?.path ?? "unmatched",
        status: response.statusCode,
        durationMs: Date.now() - started,
      },
      "Request completed",
    );
  });
  next();
});
app.use(express.json({ limit: "100kb" }));
app.use(validateApiInput);
app.use("/health", healthRouter);
app.use("/auth", authRouter);
app.use("/", teamRouter);
app.use("/", boardRouter);
app.use("/", columnRouter);
app.use("/", taskRouter);
app.use("/", userRouter);
app.use(() => {
  throw new NotFoundError("Endpoint not found.");
});
app.use(errorHandler);
export default app;
