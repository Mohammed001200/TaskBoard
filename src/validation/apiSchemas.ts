import { z } from "zod";
import { RequestHandler } from "express";
import { BadRequestError } from "../errors/AppError";
const id = z
  .string()
  .regex(/^[a-f\d]{24}$/i)
  .toLowerCase();
const name = z.string().trim().min(1).max(100);
const title = z.string().trim().min(1).max(200);
const email = z.string().trim().toLowerCase().max(254).pipe(z.email());
const password = z
  .string()
  .min(8)
  .refine((value) => Buffer.byteLength(value, "utf8") <= 72);
const loginPassword = z
  .string()
  .min(1)
  .refine((value) => Buffer.byteLength(value, "utf8") <= 72);
const empty = z.strictObject({});
const deadline = z.iso
  .datetime({ offset: true })
  .transform((value) => new Date(value))
  .nullable();
const taskFields = {
  title,
  description: z.string().max(5000).optional(),
  deadline: deadline.optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  assignedUserId: id.nullable().optional(),
};
const columnFields = {
  title,
  position: z.number().int().min(0),
  allowedTransitions: z
    .array(id)
    .max(100)
    .refine((values) => new Set(values).size === values.length)
    .nullable()
    .optional(),
};
const changes = (schema: z.ZodType) =>
  schema.refine(
    (value) =>
      typeof value === "object" &&
      value !== null &&
      Object.keys(value).length > 0,
  );
type Rule = {
  method: string;
  pattern: RegExp;
  keys: string[];
  body: z.ZodType;
};
const rules: Rule[] = [];
function rule(method: string, path: string, body: z.ZodType = empty) {
  const keys: string[] = [];
  const pattern = new RegExp(
    "^" +
      path.replace(/:([A-Za-z]+Id)/g, (_all, key) => {
        keys.push(key);
        return "([^/]+)";
      }) +
      "/?$",
    "i",
  );
  rules.push({ method, pattern, keys, body });
}
rule("GET", "/health");
rule("POST", "/auth/register", z.strictObject({ name, email, password }));
rule("POST", "/auth/login", z.strictObject({ email, password: loginPassword }));
rule("GET", "/users");
rule("GET", "/users/me");
rule(
  "PATCH",
  "/users/me",
  changes(
    z.strictObject({
      name: name.optional(),
      email: email.optional(),
      password: password.optional(),
    }),
  ),
);
rule("DELETE", "/users/me");
rule("POST", "/teams", z.strictObject({ name }));
rule("GET", "/teams");
rule("GET", "/teams/:teamId");
rule("PATCH", "/teams/:teamId", z.strictObject({ name }));
rule("DELETE", "/teams/:teamId");
rule("POST", "/teams/:teamId/members", z.strictObject({ email }));
rule("DELETE", "/teams/:teamId/members/:userId");
rule("POST", "/teams/:teamId/boards", z.strictObject({ title }));
rule("GET", "/teams/:teamId/boards");
rule("GET", "/boards/:boardId");
rule("PATCH", "/boards/:boardId", z.strictObject({ title }));
rule("DELETE", "/boards/:boardId");
rule("POST", "/boards/:boardId/columns", z.strictObject(columnFields));
rule("GET", "/boards/:boardId/columns");
rule("GET", "/columns/:columnId");
rule(
  "PATCH",
  "/columns/:columnId",
  changes(z.strictObject(columnFields).partial()),
);
rule("DELETE", "/columns/:columnId");
rule("POST", "/columns/:columnId/tasks", z.strictObject(taskFields));
rule("GET", "/columns/:columnId/tasks");
rule("GET", "/tasks/:taskId");
rule("PATCH", "/tasks/:taskId", changes(z.strictObject(taskFields).partial()));
rule("DELETE", "/tasks/:taskId");
rule("PATCH", "/tasks/:taskId/move", z.strictObject({ columnId: id }));
rule(
  "POST",
  "/tasks/:taskId/comments",
  z.strictObject({ text: z.string().trim().min(1).max(5000) }),
);
rule("GET", "/tasks/:taskId/comments");
rule("GET", "/tasks/:taskId/activities");
rule("GET", "/comments/:commentId");
rule(
  "PATCH",
  "/comments/:commentId",
  z.strictObject({ text: z.string().trim().min(1).max(5000) }),
);
rule("DELETE", "/comments/:commentId");

export const validateApiInput: RequestHandler = (request, _response, next) => {
  const method = request.method === "HEAD" ? "GET" : request.method;
  const candidate = rules.find(
    (item) => item.method === method && item.pattern.test(request.path),
  );
  if (!candidate) return next();
  const match = request.path.match(candidate.pattern)!;
  try {
    const params = Object.fromEntries(
      candidate.keys.map((key, index) => [
        key,
        decodeURIComponent(match[index + 1]),
      ]),
    );
    z.strictObject(
      Object.fromEntries(candidate.keys.map((key) => [key, id])),
    ).parse(params);
    empty.parse(request.query);
    request.body = candidate.body.parse(request.body ?? {});
  } catch {
    throw new BadRequestError("Invalid request body, parameters or query.");
  }
  next();
};
