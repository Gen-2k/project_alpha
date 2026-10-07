import { randomUUID } from "node:crypto";

import type { NestMiddleware } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

export const REQUEST_ID_HEADER = "x-request-id";

export type RequestWithId = Request & { id?: string };

// Accept distributed-tracing ids verbatim only when safe: bounded length,
// no whitespace/control chars (prevents header bloat + log injection).
// Anything else is replaced with a fresh UUID. Shared with logger genReqId
// so both entry points agree on one owner for id generation.
export function sanitizeRequestId(candidate: unknown): string | undefined {
  if (typeof candidate !== "string") return undefined;
  const trimmed = candidate.trim();
  if (trimmed.length === 0 || trimmed.length > 128) return undefined;
  if (!/^[A-Za-z0-9\-_.]+$/.test(trimmed)) return undefined;
  return trimmed;
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: RequestWithId, res: Response, next: NextFunction): void {
    const incomingId =
      sanitizeRequestId(req.headers[REQUEST_ID_HEADER]) ?? sanitizeRequestId(req.id);

    const id = incomingId ?? randomUUID();
    req.id = id;
    res.setHeader(REQUEST_ID_HEADER, id);
    next();
  }
}
