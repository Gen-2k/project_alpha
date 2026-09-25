import { randomUUID } from "node:crypto";

import type { NestMiddleware } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

export const REQUEST_ID_HEADER = "x-request-id";

export type RequestWithId = Request;

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: RequestWithId, res: Response, next: NextFunction): void {
    const rawHeader = req.headers[REQUEST_ID_HEADER];
    const existingReqId =
      typeof req.id === "string" && req.id.trim() !== "" ? req.id.trim() : undefined;
    const incomingId =
      typeof rawHeader === "string" && rawHeader.trim() !== "" ? rawHeader.trim() : existingReqId;

    const id = incomingId ?? randomUUID();
    req.id = id;
    res.setHeader(REQUEST_ID_HEADER, id);
    next();
  }
}
