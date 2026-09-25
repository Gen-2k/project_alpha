import type { ArgumentsHost, ExceptionFilter } from "@nestjs/common";
import { Catch, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { Response } from "express";

import type { RequestWithId } from "../middleware/request-id.middleware.js";

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

function deriveErrorCode(status: number, message: string, hasIssues: boolean): string {
  switch (status) {
    case 400:
      return hasIssues || /validation/i.test(message) ? "VALIDATION_FAILED" : "BAD_REQUEST";
    case 401:
      if (/invalid credentials/i.test(message)) return "INVALID_CREDENTIALS";
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

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithId>();

    if (response.headersSent) {
      return;
    }

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let error = "Internal Server Error";
    let message = "An unexpected error occurred";
    let code = "INTERNAL_SERVER_ERROR";
    let issues: ApiErrorIssue[] | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === "string") {
        message = res;
        error = getHttpErrorName(status);
      } else {
        const record = res as Record<string, unknown>;

        if (typeof record.message === "string") {
          message = record.message;
        } else if (Array.isArray(record.message)) {
          message = record.message.join("; ");
        } else {
          message = exception.message;
        }

        if (typeof record.error === "string") {
          error = record.error;
        } else {
          error = getHttpErrorName(status);
        }

        if (typeof record.code === "string") {
          code = record.code;
        }

        if (Array.isArray(record.issues)) {
          issues = record.issues as ApiErrorIssue[];
        }
      }

      if (code === "INTERNAL_SERVER_ERROR") {
        code = deriveErrorCode(status, message, Boolean(issues && issues.length > 0));
      }
    } else {
      const err = exception instanceof Error ? exception : new Error(String(exception));
      const reqId = typeof request.id === "string" ? request.id : "unknown";
      this.logger.error(
        `[${reqId}] Unhandled exception on ${request.method} ${request.url}: ${err.message}`,
        err.stack,
      );
    }

    const rawHeader = request.headers[REQUEST_ID_HEADER_NAME];
    const headerRequestId = typeof rawHeader === "string" ? rawHeader : undefined;
    const requestId = typeof request.id === "string" ? request.id : headerRequestId;

    const body: ApiErrorResponse = {
      statusCode: status,
      error,
      code,
      message,
      ...(issues ? { issues } : {}),
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(requestId ? { requestId } : {}),
    };

    response.status(status).json(body);
  }
}

const REQUEST_ID_HEADER_NAME = "x-request-id";
