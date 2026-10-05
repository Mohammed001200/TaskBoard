import { ErrorRequestHandler } from "express";
import { AppError, BadRequestError, ConflictError } from "../errors/AppError";
import { logger } from "../config/logger";
export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  _next,
) => {
  let safeError: AppError;
  if (error instanceof AppError) safeError = error;
  else if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  )
    safeError = new ConflictError("This record already exists.");
  else if (
    error instanceof Error &&
    ["ValidationError", "CastError"].includes(error.name)
  )
    safeError = new BadRequestError();
  else if (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    error.type === "entity.parse.failed"
  )
    safeError = new BadRequestError("Invalid JSON.");
  else if (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    error.type === "entity.too.large"
  )
    safeError = new AppError(
      413,
      "PAYLOAD_TOO_LARGE",
      "Request body is too large.",
    );
  else
    safeError = new AppError(
      500,
      "INTERNAL_ERROR",
      "An unexpected error occurred.",
    );
  if (safeError.statusCode >= 500)
    logger.error(
      { event: "request_failed", code: safeError.code },
      "Request failed",
    );
  response
    .status(safeError.statusCode)
    .json({ message: safeError.message, code: safeError.code });
};
