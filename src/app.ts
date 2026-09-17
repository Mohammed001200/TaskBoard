import express from "express";
import authRouter from "./routes/authRoutes";
import boardRouter from "./routes/boardRoutes";
import columnRouter from "./routes/columnRoutes";
import healthRouter from "./routes/healthRoutes";
import taskRouter from "./routes/taskRoutes";
import teamRouter from "./routes/teamRoutes";

const app = express();

app.use(express.json());
app.use("/health", healthRouter);
app.use("/auth", authRouter);
app.use("/", teamRouter);
app.use("/", boardRouter);
app.use("/", columnRouter);
app.use("/", taskRouter);

export default app;
