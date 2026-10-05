import pino from "pino";
const levels = ["fatal", "error", "warn", "info", "debug", "trace", "silent"];
export const logger = pino({
  level: levels.includes(process.env.LOG_LEVEL ?? "")
    ? process.env.LOG_LEVEL
    : "info",
  base: undefined,
  // Defense in depth; callers whitelist fields and never pass raw requests or errors.
  redact: {
    paths: [
      "password",
      "email",
      "token",
      "authorization",
      "MONGODB_URI",
      "JWT_SECRET",
      "req",
      "res",
      "err",
      "body",
      "headers",
    ],
    remove: true,
  },
});
