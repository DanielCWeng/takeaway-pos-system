/**
 * shared/middleware/sendValidationError.js
 *
 * Unified helper for sending validation error responses.
 */

/**
 * Send a 400 Bad Request response with a standardised validation error envelope.
 *
 * @param {import('express').Response} res
 * @param {Object} details - Field-level error details
 * @param {string} [message='Invalid request body']
 * @returns {import('express').Response}
 */
export function sendValidationError(res, details, message = 'Invalid request body') {
  return res.status(400).json({
    error: {
      code: 'VALIDATION_ERROR',
      message,
      details,
    },
  });
}
