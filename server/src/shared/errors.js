/**
 * shared/errors.js
 *
 * Application-level error classes.
 *
 * These are the ONLY error types that cross layer boundaries.
 * - Service layer throws them.
 * - Route handlers catch them and map to HTTP status codes.
 * - The global Express error handler formats them into the standard error envelope.
 *
 * Do NOT throw plain `new Error()` for expected failure conditions —
 * always use one of these typed classes so the error handler can
 * distinguish them and respond correctly.
 */

// ---------------------------------------------------------------------------
// Base class
// ---------------------------------------------------------------------------

/**
 * Base class for all application errors.
 * Never thrown directly — throw a subclass instead.
 */
export class AppError extends Error {
  /**
   * @param {string} message  - Human-readable description
   * @param {string} code     - Machine-readable enum string (e.g. 'VALIDATION_ERROR')
   * @param {object} [details] - Optional structured details (e.g. field-level validation info)
   */
  constructor(message, code = "INTERNAL_ERROR", details = Object.freeze({})) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    // Preserve a clean stack in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// ---------------------------------------------------------------------------
// Subtypes
// ---------------------------------------------------------------------------

/**
 * Input fails business rules or schema validation.
 * Maps to HTTP 400.
 */
export class ValidationError extends AppError {
  constructor(message, details = {}) {
    super(message, "VALIDATION_ERROR", details);
  }
}

/**
 * Requested resource does not exist in the database.
 * Maps to HTTP 404.
 */
export class NotFoundError extends AppError {
  constructor(message, details = {}) {
    super(message, "NOT_FOUND", details);
  }
}

/**
 * A hardware device (printer, HID) failed.
 * May be fatal or non-fatal depending on context — the service layer decides.
 * Maps to HTTP 500 if it reaches the route handler uncaught.
 */
export class HardwareError extends AppError {
  constructor(message, details = {}) {
    super(message, "HARDWARE_ERROR", details);
  }
}

/**
 * An upstream external service (getaddress.io) returned an error or timed out.
 * Maps to HTTP 502.
 */
export class ExternalServiceError extends AppError {
  constructor(message, details = {}) {
    super(message, "EXTERNAL_SERVICE_ERROR", details);
  }
}

/**
 * A feature that is not yet implemented (Phase 2/3 stub).
 * Any route that calls a stub function will receive a 501.
 */
export class NotImplementedError extends AppError {
  constructor(message = "This feature is not yet implemented (Phase 2)") {
    super(message, "NOT_IMPLEMENTED");
  }
}
