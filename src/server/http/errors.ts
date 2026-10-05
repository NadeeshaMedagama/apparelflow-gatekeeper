/**
 * Typed application errors. Services throw these; the API layer maps them to
 * HTTP responses with a stable `code` so clients and tests never have to parse
 * human-readable messages.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class BadRequestError extends AppError {
  constructor(message = "The request could not be understood.") {
    super(400, "BAD_REQUEST", message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required. Sign in to continue.") {
    super(401, "UNAUTHENTICATED", message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You are not authorized to perform this action.", details?: unknown) {
    super(403, "FORBIDDEN", message, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "The requested resource was not found.") {
    super(404, "NOT_FOUND", message);
  }
}

/** The request is valid, but the resource is not in a state that allows it. */
export class ConflictError extends AppError {
  constructor(code: string, message: string, details?: unknown) {
    super(409, code, message, details);
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message = "The request body is too large.") {
    super(413, "PAYLOAD_TOO_LARGE", message);
  }
}

/** Malformed or out-of-range input (422). */
export class ValidationError extends AppError {
  constructor(message = "The request contains invalid data.", details?: unknown) {
    super(422, "VALIDATION_FAILED", message, details);
  }
}

/** Well-formed input that violates a business rule, e.g. the gatekeeper hard stop (422). */
export class BusinessRuleError extends AppError {
  constructor(code: string, message: string, details?: unknown) {
    super(422, code, message, details);
  }
}
