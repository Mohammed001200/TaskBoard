import { z } from "zod";
const schema = z.object({
  MONGODB_URI: z.string().regex(/^mongodb(?:\+srv)?:\/\//),
  JWT_SECRET: z.string().min(32),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
});
export function validateEnvironment() {
  const result = schema.safeParse(process.env);
  if (!result.success)
    throw new Error(
      "Required environment configuration is missing or invalid.",
    );
  return result.data;
}
