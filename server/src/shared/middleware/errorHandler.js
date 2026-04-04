import { AppError, ValidationError, NotFoundError, NotImplementedError } from "../errors.js";
import { logger } from "../../infrastructure/logger.js";
import { sendValidationError } from "./sendValidationError.js";

export function errorHandler(err, req, res, _next) {
  const logDetails = {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    errorCode: err.code ?? "UNKNOWN",
    errorMessage: err.message,
    details: err.details,
    stack: err.stack,
  };

  // Only log at error level for unexpected errors (not AppError)
  if (!(err instanceof AppError)) {
    logger.error("Unhandled error in request", logDetails);
  } else if (!(err instanceof ValidationError) && !(err instanceof NotFoundError)) {
    // Log other application errors (NotImplemented, ExternalService, etc.) as warnings
    logger.warn("Application error in request", logDetails);
  }
  // Note: Validation and 404 errors are considered "normal" noise and are not logged here
  // to prevent log pollution.

  if (err instanceof ValidationError) {
    return sendValidationError(res, err.details, err.message);
  }
  if (err instanceof NotFoundError) {
    return res
      .status(404)
      .json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err instanceof NotImplementedError) {
    return res
      .status(501)
      .json({ error: { code: err.code, message: err.message, details: err.details } });
  }

  // Handle other AppError types (ExternalServiceError, HardwareError, etc.)
  if (err instanceof AppError) {
    const statusMap = {
      EXTERNAL_SERVICE_ERROR: 502,
      HARDWARE_ERROR: 500,
      INTERNAL_ERROR: 500,
    };
    const status = statusMap[err.code] ?? 500;
    return res.status(status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
  }

  // Unhandled — return generic JSON error to client
  return res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
    },
  });
}
