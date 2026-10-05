import { spawnSync } from "node:child_process";
import path from "node:path";

test("Pino emits the safe event while removing credentials and request contents", () => {
  const sensitive = {
    password: "Synthetic-private-password",
    email: "synthetic-private@example.test",
    token: "Synthetic-private-token",
    authorization: "Bearer Synthetic-private-token",
    MONGODB_URI: "mongodb://synthetic-user:synthetic-password@localhost/test",
    JWT_SECRET: "Synthetic-private-secret",
    req: { body: { password: "Synthetic-private-password" } },
    res: { headers: { authorization: "Bearer Synthetic-private-token" } },
    err: { message: "Synthetic-private-password" },
    body: { email: "synthetic-private@example.test" },
    headers: { authorization: "Bearer Synthetic-private-token" },
  };
  const script = `const {logger}=require('./src/config/logger.ts');logger.info(${JSON.stringify({ event: "logging-safety-check", ...sensitive })},'Safe event message');`;
  const result = spawnSync(
    process.execPath,
    ["--require", "tsx/cjs", "-e", script],
    {
      cwd: path.join(__dirname, ".."),
      env: { ...process.env, LOG_LEVEL: "info" },
      encoding: "utf8",
      timeout: 10000,
    },
  );
  expect(result.status).toBe(0);
  const entry = JSON.parse(result.stdout.trim());
  expect(entry.event).toBe("logging-safety-check");
  for (const field of Object.keys(sensitive))
    expect(entry[field]).toBeUndefined();
  expect(result.stdout).not.toContain("Synthetic-private");
  expect(result.stdout).not.toContain("synthetic-private@");
  expect(result.stdout).not.toContain("synthetic-password");
});
