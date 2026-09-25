import type { Request } from "express";
import { describe, expect, it } from "vitest";

import { extractRequestMetadata } from "../auth.types.js";

describe("extractRequestMetadata", () => {
  it("should extract IP from x-forwarded-for string with multiple comma-separated IPs", () => {
    const req = {
      headers: {
        "x-forwarded-for": "203.0.113.195, 70.41.3.18, 150.172.238.178",
        "user-agent": "Mozilla/5.0",
      },
      ip: "127.0.0.1",
    } as unknown as Request;

    const meta = extractRequestMetadata(req);
    expect(meta).toEqual({
      ipAddress: "203.0.113.195",
      userAgent: "Mozilla/5.0",
    });
  });

  it("should extract IP from x-forwarded-for array", () => {
    const req = {
      headers: {
        "x-forwarded-for": ["198.51.100.1", "198.51.100.2"],
      },
      ip: "127.0.0.1",
    } as unknown as Request;

    const meta = extractRequestMetadata(req);
    expect(meta).toEqual({
      ipAddress: "198.51.100.1",
      userAgent: undefined,
    });
  });

  it("should fall back to req.ip when x-forwarded-for is missing", () => {
    const req = {
      headers: {},
      ip: "192.168.1.100",
    } as unknown as Request;

    const meta = extractRequestMetadata(req);
    expect(meta).toEqual({
      ipAddress: "192.168.1.100",
      userAgent: undefined,
    });
  });

  it("should return undefined ipAddress when both x-forwarded-for and req.ip are absent", () => {
    const req = {
      headers: {},
      ip: undefined,
    } as unknown as Request;

    const meta = extractRequestMetadata(req);
    expect(meta).toEqual({
      ipAddress: undefined,
      userAgent: undefined,
    });
  });
});
