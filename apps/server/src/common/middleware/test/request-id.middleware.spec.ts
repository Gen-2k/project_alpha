import type { Response } from "express";
import { describe, expect, it, vi } from "vitest";

import type { RequestWithId } from "../request-id.middleware.js";
import { REQUEST_ID_HEADER, RequestIdMiddleware } from "../request-id.middleware.js";

describe("RequestIdMiddleware", () => {
  const middleware = new RequestIdMiddleware();

  it("should generate a UUID and set both req.id and response header when header is absent", () => {
    const req = { headers: {} } as unknown as RequestWithId;
    const setHeaderMock = vi.fn();
    const res = { setHeader: setHeaderMock } as unknown as Response;
    const nextMock = vi.fn();

    middleware.use(req, res, nextMock);

    expect(req.id).toBeDefined();
    expect(typeof req.id).toBe("string");
    // Standard UUID v4 format: 8-4-4-4-12 hex chars
    expect(req.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(setHeaderMock).toHaveBeenCalledWith(REQUEST_ID_HEADER, req.id);
    expect(nextMock).toHaveBeenCalledOnce();
  });

  it("should preserve and propagate an existing x-request-id header", () => {
    const existingId = "upstream-trace-id-12345";
    const req = {
      headers: { [REQUEST_ID_HEADER]: `  ${existingId}  ` },
    } as unknown as RequestWithId;
    const setHeaderMock = vi.fn();
    const res = { setHeader: setHeaderMock } as unknown as Response;
    const nextMock = vi.fn();

    middleware.use(req, res, nextMock);

    expect(req.id).toBe(existingId);
    expect(setHeaderMock).toHaveBeenCalledWith(REQUEST_ID_HEADER, existingId);
    expect(nextMock).toHaveBeenCalledOnce();
  });

  it("should generate a new UUID when the incoming header is an empty string or whitespace", () => {
    const req = {
      headers: { [REQUEST_ID_HEADER]: "   " },
    } as unknown as RequestWithId;
    const setHeaderMock = vi.fn();
    const res = { setHeader: setHeaderMock } as unknown as Response;
    const nextMock = vi.fn();

    middleware.use(req, res, nextMock);

    expect(req.id).toBeDefined();
    expect(req.id).not.toBe("   ");
    expect(setHeaderMock).toHaveBeenCalledWith(REQUEST_ID_HEADER, req.id);
    expect(nextMock).toHaveBeenCalledOnce();
  });

  it("should replace ids containing illegal characters to block log injection", () => {
    const req = {
      headers: { [REQUEST_ID_HEADER]: "evil-id\ninjected: true" },
    } as unknown as RequestWithId;
    const setHeaderMock = vi.fn();
    const res = { setHeader: setHeaderMock } as unknown as Response;
    const nextMock = vi.fn();

    middleware.use(req, res, nextMock);

    expect(req.id).not.toBe("evil-id\ninjected: true");
    expect(req.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(nextMock).toHaveBeenCalledOnce();
  });

  it("should replace overlong ids to prevent header bloat", () => {
    const req = {
      headers: { [REQUEST_ID_HEADER]: "a".repeat(200) },
    } as unknown as RequestWithId;
    const setHeaderMock = vi.fn();
    const res = { setHeader: setHeaderMock } as unknown as Response;
    const nextMock = vi.fn();

    middleware.use(req, res, nextMock);

    expect(typeof req.id).toBe("string");
    if (typeof req.id === "string") {
      expect(req.id.length).toBeLessThan(200);
    }
    expect(nextMock).toHaveBeenCalledOnce();
  });
});
