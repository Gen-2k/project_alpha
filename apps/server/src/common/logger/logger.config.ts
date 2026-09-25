import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

import type { ConfigService } from "@nestjs/config";
import type { Params } from "nestjs-pino";
import type { LevelWithSilent } from "pino";

import { REQUEST_ID_HEADER } from "../middleware/request-id.middleware.js";

export function createLoggerConfig(config: ConfigService): Params {
  const nodeEnv = config.get<string>("NODE_ENV") ?? "development";
  const isProduction = nodeEnv === "production";
  const isTest = nodeEnv === "test";
  const logLevel = isTest ? "silent" : (config.get<LevelWithSilent>("LOG_LEVEL") ?? "info");

  return {
    pinoHttp: {
      level: logLevel,
      transport:
        isProduction || isTest
          ? undefined
          : {
              target: "pino-pretty",
              options: {
                colorize: true,
                singleLine: true,
                translateTime: "SYS:yyyy-mm-dd HH:MM:ss.l",
                ignore: "pid,hostname,req,res",
              },
            },
      autoLogging: {
        ignore: (req) => {
          const rawPath = (req.url ?? "").split("?")[0]?.replace(/\/+$/, "");
          const pathname = rawPath && rawPath.length > 0 ? rawPath : "/";
          return (
            pathname === "/health" || pathname === "/health/live" || pathname === "/health/ready"
          );
        },
      },
      genReqId: (req, res) => {
        const rawHeader = req.headers[REQUEST_ID_HEADER];
        const incomingId =
          typeof rawHeader === "string" && rawHeader.trim() !== "" ? rawHeader.trim() : undefined;
        const id = incomingId ?? randomUUID();
        req.headers[REQUEST_ID_HEADER] = id;
        res.setHeader(REQUEST_ID_HEADER, id);
        return id;
      },
      serializers: {
        req: (req: IncomingMessage & { id?: unknown; query?: unknown }) => ({
          id: req.id,
          method: req.method,
          url: req.url,
          query: req.query,
        }),
        res: (res: ServerResponse) => ({
          statusCode: res.statusCode,
        }),
      },
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "req.body.password",
          "req.body.refreshToken",
          'res.headers["set-cookie"]',
        ],
        censor: "[REDACTED]",
      },
      customLogLevel: (_req, res, err) => {
        if (res.statusCode >= 500 || err) return "error";
        if (res.statusCode >= 400) return "warn";
        return "info";
      },
      customSuccessMessage: (req, res, responseTime) => {
        const id = typeof req.id === "string" ? ` [reqId=${req.id}]` : "";
        return `${req.method ?? "UNKNOWN"} ${req.url ?? "/"} ${String(res.statusCode)} - ${String(Math.round(responseTime))}ms${id}`;
      },
      customErrorMessage: (req, res, err) => {
        const id = typeof req.id === "string" ? ` [reqId=${req.id}]` : "";
        return `${req.method ?? "UNKNOWN"} ${req.url ?? "/"} ${String(res.statusCode)} - ${err.message}${id}`;
      },
    },
  };
}
