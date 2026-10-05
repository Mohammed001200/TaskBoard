// Never load the developer's .env or connect to their real MongoDB in tests.
const { randomBytes } = require("node:crypto");
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.JWT_SECRET = randomBytes(32).toString("hex");
delete process.env.MONGODB_URI;
process.env.SUPPRESS_JEST_WARNINGS = "true";
