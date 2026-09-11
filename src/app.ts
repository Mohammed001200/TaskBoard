import express from "express";
import authRouter from "./routes/authRoutes";
import healthRouter from "./routes/healthRoutes";

const app = express();

app.use(express.json());
app.use("/health", healthRouter);
app.use("/auth", authRouter);

export default app;
