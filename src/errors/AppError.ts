export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export class BadRequestError extends AppError {
  constructor(message = "Invalid input.") {
    super(400, "BAD_REQUEST", message);
  }
}
export class UnauthorizedError extends AppError {
  constructor(message = "Missing or invalid token.") {
    super(401, "UNAUTHORIZED", message);
  }
}
export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission.") {
    super(403, "FORBIDDEN", message);
  }
}
export class NotFoundError extends AppError {
  constructor(message = "Resource not found.") {
    super(404, "NOT_FOUND", message);
  }
}
export class ConflictError extends AppError {
  constructor(message = "The request conflicts with existing data.") {
    super(409, "CONFLICT", message);
  }
}
