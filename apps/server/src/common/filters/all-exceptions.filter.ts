import type { ArgumentsHost, ExceptionFilter } from "@nestjs/common";
import { Catch, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { Response } from "express";

import type { RequestWithId } from "../middleware/request-id.middleware.js";
import { REQUEST_ID_HEADER } from "../middleware/request-id.middleware.js";
import { requestPathname } from "../utils/shared.util.js";

export interface ApiErrorIssue {
  path: string;
  message: string;
}

export interface ApiErrorResponse {
  statusCode: number;
  error: string;
  code: string;
  message: string;
  issues?: ApiErrorIssue[];
  timestamp: string;
  path: string;
  requestId?: string;
}

const HTTP_ERROR_PHRASES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: "Bad Request",
  [HttpStatus.UNAUTHORIZED]: "Unauthorized",
  [HttpStatus.FORBIDDEN]: "Forbidden",
  [HttpStatus.NOT_FOUND]: "Not Found",
  [HttpStatus.CONFLICT]: "Conflict",
  [HttpStatus.TOO_MANY_REQUESTS]: "Too Many Requests",
  [HttpStatus.INTERNAL_SERVER_ERROR]: "Internal Server Error",
  [HttpStatus.SERVICE_UNAVAILABLE]: "Service Unavailable",
};

function getHttpErrorName(status: number): string {
  return (
    HTTP_ERROR_PHRASES[status] ??
    (typeof HttpStatus[status] === "string" ? HttpStatus[status] : "Error")
  );
}

// Legacy backstop only: new code must throw explicit `{ code }` (as
// ZodValidationPipe does) instead of relying on English message sniffing.
// Kept so older throw sites without a code still map to a stable contract.
function deriveErrorCode(status: number, message: string, hasIssues: boolean): string {
  switch (status) {
    case 400:
      return hasIssues || /validation/i.test(message) ? "VALIDATION_FAILED" : "BAD_REQUEST";
    case 401:
      if (/verify your email/i.test(message)) return "EMAIL_NOT_VERIFIED";
      if (/invalid (credentials|email or password)/i.test(message)) return "INVALID_CREDENTIALS";
      if (/token (already )?rotated|token reuse|revoked/i.test(message)) return "TOKEN_REVOKED";
      return "UNAUTHORIZED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      if (/email/i.test(message)) return "EMAIL_ALREADY_REGISTERED";
      return "CONFLICT";
    case 429:
      return "RATE_LIMIT_EXCEEDED";
    case 503:
      return "SERVICE_UNAVAILABLE";
    default:
      return status >= 500 ? "INTERNAL_SERVER_ERROR" : "ERROR";
  }
}

interface HttpErrorDetails {
  status: number;
  error: string;
  message: string;
  code: string;
  issues?: ApiErrorIssue[];
}

function normalizeIssues(value: unknown): ApiErrorIssue[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const parsed = (value as unknown[]).filter(
    (item): item is ApiErrorIssue =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as Record<string, unknown>).path === "string" &&
      typeof (item as Record<string, unknown>).message === "string",
  );
  return parsed.map((item) => ({ path: item.path, message: item.message }));
}

function extractHttpDetails(exception: HttpException): HttpErrorDetails {
  const status = exception.getStatus();
  const res = exception.getResponse();

  if (typeof res === "string") {
    return {
      status,
      error: getHttpErrorName(status),
      message: res,
      code: deriveErrorCode(status, res, false),
    };
  }

  const record = res as Record<string, unknown>;
  let message: string;
  if (typeof record.message === "string") {
    message = record.message;
  } else if (Array.isArray(record.message)) {
    message = record.message.join("; ");
  } else {
    message = exception.message;
  }

  const error = typeof record.error === "string" ? record.error : getHttpErrorName(status);
  const code = typeof record.code === "string" ? record.code : "INTERNAL_SERVER_ERROR";
  const issues = normalizeIssues(record.issues);
  const resolvedCode =
    code === "INTERNAL_SERVER_ERROR"
      ? deriveErrorCode(status, message, Boolean(issues && issues.length > 0))
      : code;
  return { status, error, message, code: resolvedCode, ...(issues ? { issues } : {}) };
}

function resolveRequestId(request: RequestWithId): string | undefined {
  if (typeof request.id === "string") return request.id;
  const rawHeader = request.headers[REQUEST_ID_HEADER];
  return typeof rawHeader === "string" ? rawHeader : undefined;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithId>();

    if (response.headersSent) {
      this.logger.error(
        `Response already sent for ${request.method} ${requestPathname(request.url)}; cannot render error body`,
      );
      return;
    }

    const details: HttpErrorDetails =
      exception instanceof HttpException
        ? extractHttpDetails(exception)
        : {
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            error: "Internal Server Error",
            message: "An unexpected error occurred",
            code: "INTERNAL_SERVER_ERROR",
          };
    const { status, error, message, code, issues } = details;

    const err = exception instanceof Error ? exception : new Error(String(exception));
    const reqId = typeof request.id === "string" ? request.id : "unknown";
    // Typed as number so the enum comparison stays numeric (getStatus()
    // returns number, not the enum type the unsafe-enum rule wants).
    const serverErrorThreshold: number = HttpStatus.INTERNAL_SERVER_ERROR;
    if (status >= serverErrorThreshold) {
      // Non-HTTP failures keep the legacy "Unhandled exception" wording with
      // the raw message; HTTP 5xx keep "HTTP <status>" with the safe message.
      const logMessage =
        exception instanceof HttpException
          ? `[${reqId}] HTTP ${String(status)} on ${request.method} ${requestPathname(request.url)}: ${message}`
          : `[${reqId}] Unhandled exception on ${request.method} ${requestPathname(request.url)}: ${err.message}`;
      this.logger.error(logMessage, err.stack);
    }

    const requestId = resolveRequestId(request);
    const body: ApiErrorResponse = {
      statusCode: status,
      error,
      code,
      message,
      ...(issues ? { issues } : {}),
      timestamp: new Date().toISOString(),
      // Never echo query strings: tokens travel as `?token=`.
      path: requestPathname(request.url),
      ...(requestId ? { requestId } : {}),
    };

    response.status(status).json(body);
  }
}
