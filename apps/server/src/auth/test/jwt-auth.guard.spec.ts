import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthenticatedRequest } from "../auth.types.js";
import { JwtAuthGuard } from "../jwt-auth.guard.js";

const TEST_SECRET = "test-secret-that-is-long-enough-for-hs256!!";

interface MockRequest {
  headers: { authorization?: string };
  user?: unknown;
}

// Mock host class: intentionally memberless (the guard only reads metadata
// off it), which is exactly what no-extraneous-class forbids by default.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
class MockHost {}

// Minimal ExecutionContext: only the three methods the guard touches,
// cast once at the boundary (documented, not hidden).
function mockContext(request: MockRequest, isPublic: boolean) {
  const reflector = new Reflector();
  vi.spyOn(reflector, "getAllAndOverride").mockReturnValue(isPublic);
  const context = {
    getHandler: () => () => undefined,
    getClass: () => MockHost,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { guard: new JwtAuthGuard(new JwtService({ secret: TEST_SECRET }), reflector), context };
}

describe("JwtAuthGuard", () => {
  let validToken: string;

  beforeEach(async () => {
    validToken = await new JwtService({ secret: TEST_SECRET }).signAsync({
      sub: "user-1",
      email: "ada@example.com",
    });
  });

  it("should allow public routes without a token", async () => {
    const { guard, context } = mockContext({ headers: {} }, true);
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("should attach the payload and allow valid bearer tokens", async () => {
    const request: MockRequest = { headers: { authorization: `Bearer ${validToken}` } };
    const { guard, context } = mockContext(request, false);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect((request as unknown as AuthenticatedRequest).user).toMatchObject({
      sub: "user-1",
      email: "ada@example.com",
    });
  });

  it("should reject missing tokens", async () => {
    const { guard, context } = mockContext({ headers: {} }, false);
    await expect(guard.canActivate(context)).rejects.toThrow("Missing bearer token");
  });

  it("should reject malformed tokens", async () => {
    const { guard, context } = mockContext(
      { headers: { authorization: "Bearer not-a-token" } },
      false,
    );
    await expect(guard.canActivate(context)).rejects.toThrow("Invalid or expired token");
  });

  it("should reject non-bearer schemes", async () => {
    const { guard, context } = mockContext({ headers: { authorization: "Basic abc" } }, false);
    await expect(guard.canActivate(context)).rejects.toThrow("Missing bearer token");
  });

  it("should reject Bearer scheme with missing token", async () => {
    const { guard, context } = mockContext({ headers: { authorization: "Bearer" } }, false);
    await expect(guard.canActivate(context)).rejects.toThrow("Missing bearer token");
  });
});
