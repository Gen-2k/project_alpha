import type { ArgumentsHost } from "@nestjs/common";
import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import type { Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RequestWithId } from "../../middleware/request-id.middleware.js";
import type { ApiErrorResponse } from "../all-exceptions.filter.js";
import { AllExceptionsFilter } from "../all-exceptions.filter.js";

describe("AllExceptionsFilter", () => {
  let filter: AllExceptionsFilter;
  let mockJson: ReturnType<typeof vi.fn>;
  let mockStatus: ReturnType<typeof vi.fn>;
  let mockResponse: Partial<Response>;
  let mockRequest: Partial<RequestWithId>;
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    mockJson = vi.fn();
    mockStatus = vi.fn().mockImplementation(() => ({ json: mockJson }));
    mockResponse = {
      headersSent: false,
      status: mockStatus as unknown as Response["status"],
    };
    mockRequest = {
      id: "test-req-id-123",
      url: "/api/v1/auth/login",
      method: "POST",
      headers: { "x-request-id": "test-req-id-123" },
    };
    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse as Response,
        getRequest: () => mockRequest as RequestWithId,
      }),
    } as unknown as ArgumentsHost;
  });

  it("should do nothing if response headers have already been sent", () => {
    mockResponse.headersSent = true;

    filter.catch(new BadRequestException(), mockHost);

    expect(mockStatus).not.toHaveBeenCalled();
    expect(mockJson).not.toHaveBeenCalled();
  });

  it("should format string response HttpException into standard envelope", () => {
    const exception = new HttpException("Access denied", HttpStatus.FORBIDDEN);

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(403);
    const body = mockJson.mock.calls[0]?.[0] as ApiErrorResponse;
    expect(body).toMatchObject({
      statusCode: 403,
      error: "Forbidden",
      code: "FORBIDDEN",
      message: "Access denied",
      path: "/api/v1/auth/login",
      requestId: "test-req-id-123",
    });
    expect(body.timestamp).toBeDefined();
  });

  it("should format validation errors with issues array and VALIDATION_FAILED code", () => {
    const issues = [{ path: "email", message: "Invalid email address" }];
    const exception = new BadRequestException({
      message: "Validation failed",
      issues,
    });

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(400);
    const body = mockJson.mock.calls[0]?.[0] as ApiErrorResponse;
    expect(body).toMatchObject({
      statusCode: 400,
      error: "Bad Request",
      code: "VALIDATION_FAILED",
      message: "Validation failed",
      issues,
      path: "/api/v1/auth/login",
      requestId: "test-req-id-123",
    });
  });

  it("should map specific auth messages to corresponding codes", () => {
    // 401 Invalid credentials
    filter.catch(new UnauthorizedException("Invalid credentials"), mockHost);
    let body = mockJson.mock.calls[0]?.[0] as ApiErrorResponse;
    expect(body.code).toBe("INVALID_CREDENTIALS");

    // 401 Token rotated
    mockJson.mockClear();
    filter.catch(new UnauthorizedException("Token already rotated"), mockHost);
    body = mockJson.mock.calls[0]?.[0] as ApiErrorResponse;
    expect(body.code).toBe("TOKEN_REVOKED");

    // 401 Generic unauthorized
    mockJson.mockClear();
    filter.catch(new UnauthorizedException("Missing bearer token"), mockHost);
    body = mockJson.mock.calls[0]?.[0] as ApiErrorResponse;
    expect(body.code).toBe("UNAUTHORIZED");

    // 409 Email conflict
    mockJson.mockClear();
    filter.catch(new ConflictException("Email already registered"), mockHost);
    body = mockJson.mock.calls[0]?.[0] as ApiErrorResponse;
    expect(body.code).toBe("EMAIL_ALREADY_REGISTERED");

    // 409 Generic conflict
    mockJson.mockClear();
    filter.catch(new ConflictException("Resource conflict"), mockHost);
    body = mockJson.mock.calls[0]?.[0] as ApiErrorResponse;
    expect(body.code).toBe("CONFLICT");

    // 404 Not found
    mockJson.mockClear();
    filter.catch(new NotFoundException("User not found"), mockHost);
    body = mockJson.mock.calls[0]?.[0] as ApiErrorResponse;
    expect(body.code).toBe("NOT_FOUND");

    // 429 Too many requests
    mockJson.mockClear();
    filter.catch(new HttpException("Too many requests", HttpStatus.TOO_MANY_REQUESTS), mockHost);
    body = mockJson.mock.calls[0]?.[0] as ApiErrorResponse;
    expect(body.code).toBe("RATE_LIMIT_EXCEEDED");

    // 503 Service unavailable
    mockJson.mockClear();
    filter.catch(new ServiceUnavailableException("Database down"), mockHost);
    body = mockJson.mock.calls[0]?.[0] as ApiErrorResponse;
    expect(body.code).toBe("SERVICE_UNAVAILABLE");
  });

  it("should format bad request without validation issues as BAD_REQUEST", () => {
    filter.catch(new BadRequestException("Malformed JSON syntax"), mockHost);
    const body = mockJson.mock.calls[0]?.[0] as ApiErrorResponse;
    expect(body.code).toBe("BAD_REQUEST");
    expect(body.issues).toBeUndefined();
  });

  it("should handle array messages and custom error code in exception object", () => {
    const exception = new BadRequestException({
      message: ["first error", "second error"],
      code: "CUSTOM_ERROR",
      error: "Custom Failure",
    });

    filter.catch(exception, mockHost);

    const body = mockJson.mock.calls[0]?.[0] as ApiErrorResponse;
    expect(body.code).toBe("CUSTOM_ERROR");
    expect(body.error).toBe("Custom Failure");
    expect(body.message).toBe("first error; second error");
  });

  it("should fallback to exception.message if object response has no message", () => {
    const exception = new HttpException({ foo: "bar" }, HttpStatus.BAD_REQUEST);

    filter.catch(exception, mockHost);

    const body = mockJson.mock.calls[0]?.[0] as ApiErrorResponse;
    expect(body.message).toBe(exception.message);
  });

  it("should sanitize unexpected non-HttpException 500 errors and log stack trace", () => {
    const loggerSpy = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    const error = new Error("Fatal database crash with connection string postgres://secret");

    filter.catch(error, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(500);
    const body = mockJson.mock.calls[0]?.[0] as ApiErrorResponse;
    expect(body).toMatchObject({
      statusCode: 500,
      error: "Internal Server Error",
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred",
      path: "/api/v1/auth/login",
      requestId: "test-req-id-123",
    });
    // Ensure internal secrets were NOT leaked to response
    expect(body.message).not.toContain("postgres://secret");

    expect(loggerSpy).toHaveBeenCalledWith(
      expect.stringContaining("Unhandled exception on POST /api/v1/auth/login"),
      error.stack,
    );
    loggerSpy.mockRestore();
  });

  it("should handle non-Error non-HttpException thrown values", () => {
    const loggerSpy = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);

    filter.catch("A raw string rejection", mockHost);

    expect(mockStatus).toHaveBeenCalledWith(500);
    const body = mockJson.mock.calls[0]?.[0] as ApiErrorResponse;
    expect(body.code).toBe("INTERNAL_SERVER_ERROR");
    loggerSpy.mockRestore();
  });

  it("should handle HttpException with status 500 and derive INTERNAL_SERVER_ERROR", () => {
    const exception = new HttpException("Upstream gateway failed", HttpStatus.BAD_GATEWAY);

    filter.catch(exception, mockHost);

    const body = mockJson.mock.calls[0]?.[0] as ApiErrorResponse;
    expect(body.statusCode).toBe(502);
    expect(body.code).toBe("INTERNAL_SERVER_ERROR");
  });

  it("should handle unrecognized HTTP status code and derive ERROR code", () => {
    const exception = new HttpException("I am a teapot", HttpStatus.I_AM_A_TEAPOT);

    filter.catch(exception, mockHost);

    const body = mockJson.mock.calls[0]?.[0] as ApiErrorResponse;
    expect(body.statusCode).toBe(418);
    expect(body.code).toBe("ERROR");
    expect(body.error).toBe("I_AM_A_TEAPOT");
  });

  it("should log unknown reqId when unhandled error occurs and req.id is undefined", () => {
    const loggerSpy = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    mockRequest.id = undefined;

    filter.catch(new Error("Unexpected crash"), mockHost);

    expect(loggerSpy).toHaveBeenCalledWith(
      expect.stringContaining("[unknown] Unhandled exception"),
      expect.any(String),
    );
    loggerSpy.mockRestore();
  });

  it("should extract requestId from headers when req.id is not set", () => {
    mockRequest.id = undefined;
    mockRequest.headers = { "x-request-id": "header-trace-456" };

    filter.catch(new NotFoundException(), mockHost);

    const body = mockJson.mock.calls[0]?.[0] as ApiErrorResponse;
    expect(body.requestId).toBe("header-trace-456");
  });

  it("should omit requestId when neither req.id nor header is present", () => {
    mockRequest.id = undefined;
    mockRequest.headers = {};
    mockRequest.url = "/api/v1/unknown";

    filter.catch(new NotFoundException(), mockHost);

    const body = mockJson.mock.calls[0]?.[0] as ApiErrorResponse;
    expect(body.requestId).toBeUndefined();
    expect(body.path).toBe("/api/v1/unknown");
  });
});
