import type { IncomingMessage, ServerResponse } from "node:http";

import type { ConfigService } from "@nestjs/config";
import { describe, expect, it, vi } from "vitest";

import { REQUEST_ID_HEADER } from "../../middleware/request-id.middleware.js";
import { createLoggerConfig } from "../logger.config.js";

function mockConfig(values: Record<string, unknown>): ConfigService {
  return {
    get: vi.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe("createLoggerConfig", () => {
  it("configures pino-pretty in development mode", () => {
    const config = mockConfig({ NODE_ENV: "development", LOG_LEVEL: "debug" });
    const params = createLoggerConfig(config);

    expect(params.pinoHttp).toBeDefined();
    const opts = params.pinoHttp as Record<string, unknown>;
    expect(opts.level).toBe("debug");
    expect(opts.transport).toMatchObject({
      target: "pino-pretty",
    });
  });

  it("omits pino-pretty transport in production mode for structured ndjson", () => {
    const config = mockConfig({ NODE_ENV: "production", LOG_LEVEL: "info" });
    const params = createLoggerConfig(config);

    const opts = params.pinoHttp as Record<string, unknown>;
    expect(opts.level).toBe("info");
    expect(opts.transport).toBeUndefined();
  });

  it("silences logs in test mode", () => {
    const config = mockConfig({ NODE_ENV: "test" });
    const params = createLoggerConfig(config);

    const opts = params.pinoHttp as Record<string, unknown>;
    expect(opts.level).toBe("silent");
    expect(opts.transport).toBeUndefined();
  });

  it("ignores health check endpoints in autoLogging", () => {
    const config = mockConfig({ NODE_ENV: "production" });
    const params = createLoggerConfig(config);
    const opts = params.pinoHttp as Record<string, unknown>;
    const autoLogging = opts.autoLogging as { ignore: (req: IncomingMessage) => boolean };

    expect(autoLogging.ignore({ url: "/health" } as IncomingMessage)).toBe(true);
    expect(autoLogging.ignore({ url: "/health/" } as IncomingMessage)).toBe(true);
    expect(autoLogging.ignore({ url: "/health/live" } as IncomingMessage)).toBe(true);
    expect(autoLogging.ignore({ url: "/health/ready?probe=1" } as IncomingMessage)).toBe(true);
    expect(autoLogging.ignore({ url: "/health/ready/" } as IncomingMessage)).toBe(true);
    expect(autoLogging.ignore({ url: undefined } as unknown as IncomingMessage)).toBe(false);
    expect(autoLogging.ignore({ url: "/api/v1/auth/login" } as IncomingMessage)).toBe(false);
  });

  it("extracts incoming x-request-id or generates one in genReqId", () => {
    const config = mockConfig({ NODE_ENV: "production" });
    const params = createLoggerConfig(config);
    const opts = params.pinoHttp as Record<string, unknown>;
    const genReqId = opts.genReqId as (req: IncomingMessage, res: ServerResponse) => string;

    const setHeaderSpy = vi.fn();
    const mockRes = { setHeader: setHeaderSpy } as unknown as ServerResponse;

    // Incoming header preserved
    const reqWithHeader = {
      headers: { [REQUEST_ID_HEADER]: "client-trace-123" },
    } as unknown as IncomingMessage;
    const id1 = genReqId(reqWithHeader, mockRes);
    expect(id1).toBe("client-trace-123");
    expect(setHeaderSpy).toHaveBeenCalledWith(REQUEST_ID_HEADER, "client-trace-123");

    // Absent header generates a UUID
    const reqWithoutHeader = { headers: {} } as unknown as IncomingMessage;
    const id2 = genReqId(reqWithoutHeader, mockRes);
    expect(id2).toMatch(/^[0-9a-f-]{36}$/);
    expect(setHeaderSpy).toHaveBeenCalledWith(REQUEST_ID_HEADER, id2);
  });

  it("configures redaction for sensitive keys and tokens", () => {
    const config = mockConfig({ NODE_ENV: "production" });
    const params = createLoggerConfig(config);
    const opts = params.pinoHttp as Record<string, unknown>;
    const redact = opts.redact as { paths: string[]; censor: string };

    expect(redact.censor).toBe("[REDACTED]");
    expect(redact.paths).toContain("req.headers.authorization");
    expect(redact.paths).toContain("req.headers.cookie");
    expect(redact.paths).toContain("req.body.password");
    expect(redact.paths).toContain("req.body.refreshToken");
    expect(redact.paths).toContain('res.headers["set-cookie"]');
  });

  it("maps status codes to appropriate log levels in customLogLevel", () => {
    const config = mockConfig({ NODE_ENV: "production" });
    const params = createLoggerConfig(config);
    const opts = params.pinoHttp as Record<string, unknown>;
    const customLogLevel = opts.customLogLevel as (
      req: IncomingMessage,
      res: ServerResponse,
      err?: Error,
    ) => string;

    const req = {} as IncomingMessage;
    expect(customLogLevel(req, { statusCode: 200 } as ServerResponse)).toBe("info");
    expect(customLogLevel(req, { statusCode: 201 } as ServerResponse)).toBe("info");
    expect(customLogLevel(req, { statusCode: 400 } as ServerResponse)).toBe("warn");
    expect(customLogLevel(req, { statusCode: 401 } as ServerResponse)).toBe("warn");
    expect(customLogLevel(req, { statusCode: 409 } as ServerResponse)).toBe("warn");
    expect(customLogLevel(req, { statusCode: 500 } as ServerResponse)).toBe("error");
    expect(customLogLevel(req, { statusCode: 200 } as ServerResponse, new Error("Crash"))).toBe(
      "error",
    );
  });

  it("provides concise serializers for req and res to prevent header bloat", () => {
    const config = mockConfig({ NODE_ENV: "production" });
    const params = createLoggerConfig(config);
    const opts = params.pinoHttp as Record<string, unknown>;
    const serializers = opts.serializers as {
      req: (req: unknown) => Record<string, unknown>;
      res: (res: unknown) => Record<string, unknown>;
    };

    const mockReq = {
      id: "test-id",
      method: "GET",
      url: "/api/v1/users/me",
      query: { filter: "active" },
      headers: { "x-secret-header": "value", host: "localhost" },
    };
    const serializedReq = serializers.req(mockReq);
    expect(serializedReq).toEqual({
      id: "test-id",
      method: "GET",
      url: "/api/v1/users/me",
      query: { filter: "active" },
    });
    // Headers should NOT be included in serialized output
    expect(serializedReq).not.toHaveProperty("headers");

    const mockRes = {
      statusCode: 200,
      headers: { "strict-transport-security": "max-age=31536000" },
    };
    const serializedRes = serializers.res(mockRes);
    expect(serializedRes).toEqual({ statusCode: 200 });
    expect(serializedRes).not.toHaveProperty("headers");
  });

  it("formats custom messages with request ID and response time", () => {
    const config = mockConfig({ NODE_ENV: "development" });
    const params = createLoggerConfig(config);
    const opts = params.pinoHttp as Record<string, unknown>;
    const customSuccessMessage = opts.customSuccessMessage as (
      req: IncomingMessage & { id?: string },
      res: ServerResponse,
      time: number,
    ) => string;

    const msg = customSuccessMessage(
      { method: "POST", url: "/api/v1/auth/login", id: "trace-xyz" } as IncomingMessage & {
        id?: string;
      },
      { statusCode: 200 } as ServerResponse,
      45.6,
    );
    expect(msg).toBe("POST /api/v1/auth/login 200 - 46ms [reqId=trace-xyz]");
  });
});
