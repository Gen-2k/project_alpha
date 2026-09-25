import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthController } from "../auth.controller.js";
import type { AuthService } from "../auth.service.js";
import type { AuthenticatedRequest } from "../auth.types.js";

describe("AuthController", () => {
  let controller: AuthController;
  let authService: {
    refreshExpiresInMs: number;
    register: ReturnType<typeof vi.fn>;
    login: ReturnType<typeof vi.fn>;
    refresh: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
    logoutAll: ReturnType<typeof vi.fn>;
    listSessions: ReturnType<typeof vi.fn>;
    revokeSession: ReturnType<typeof vi.fn>;
    me: ReturnType<typeof vi.fn>;
  };
  const mockReq = {
    ip: "127.0.0.1",
    headers: { "user-agent": "test-agent" },
    user: { sub: "user-1", email: "ada@example.com" },
    cookies: {} as Record<string, string>,
  };
  const mockRes = {
    cookie: vi.fn(),
    clearCookie: vi.fn(),
  };

  beforeEach(() => {
    authService = {
      refreshExpiresInMs: 604800000,
      register: vi.fn(() => Promise.resolve({ accessToken: "a", refreshToken: "r", user: {} })),
      login: vi.fn(() => Promise.resolve({ accessToken: "a", refreshToken: "r", user: {} })),
      refresh: vi.fn(() => Promise.resolve({ accessToken: "a2", refreshToken: "r2", user: {} })),
      logout: vi.fn(() => Promise.resolve({ loggedOut: true })),
      logoutAll: vi.fn(() => Promise.resolve({ loggedOut: true })),
      listSessions: vi.fn(() => Promise.resolve([])),
      revokeSession: vi.fn(() => Promise.resolve({ revoked: true })),
      me: vi.fn(() => Promise.resolve({ ok: true })),
    };
    controller = new AuthController(authService as unknown as AuthService);
    vi.clearAllMocks();
  });

  it("should delegate register to the service and set refresh cookie", async () => {
    const dto = { email: "ada@example.com", password: "correct-horse-1" };
    const res = await controller.register(
      dto,
      mockReq as unknown as Request,
      mockRes as unknown as Response,
    );
    expect(authService.register).toHaveBeenCalledWith(dto, {
      ipAddress: "127.0.0.1",
      userAgent: "test-agent",
    });
    expect(mockRes.cookie).toHaveBeenCalledWith("refreshToken", "r", expect.any(Object));
    expect(res).toMatchObject({ accessToken: "a", refreshToken: "r" });
  });

  it("should delegate login to the service and set refresh cookie", async () => {
    const dto = { email: "ada@example.com", password: "correct-horse-1" };
    const res = await controller.login(
      dto,
      mockReq as unknown as Request,
      mockRes as unknown as Response,
    );
    expect(authService.login).toHaveBeenCalledWith(dto, {
      ipAddress: "127.0.0.1",
      userAgent: "test-agent",
    });
    expect(mockRes.cookie).toHaveBeenCalledWith("refreshToken", "r", expect.any(Object));
    expect(res).toMatchObject({ accessToken: "a", refreshToken: "r" });
  });

  it("should delegate refresh via body and set new cookie", async () => {
    const res = await controller.refresh(
      { refreshToken: "token" },
      mockReq as unknown as Request,
      mockRes as unknown as Response,
    );
    expect(authService.refresh).toHaveBeenCalledWith(
      { refreshToken: "token" },
      { ipAddress: "127.0.0.1", userAgent: "test-agent" },
    );
    expect(mockRes.cookie).toHaveBeenCalledWith("refreshToken", "r2", expect.any(Object));
    expect(res).toMatchObject({ accessToken: "a2", refreshToken: "r2" });
  });

  it("should delegate refresh via cookie when body is empty", async () => {
    const cookieReq = {
      ...mockReq,
      cookies: { refreshToken: "cookie-token" },
    } as unknown as Request;
    const res = await controller.refresh({}, cookieReq, mockRes as unknown as Response);
    expect(authService.refresh).toHaveBeenCalledWith(
      { refreshToken: "cookie-token" },
      { ipAddress: "127.0.0.1", userAgent: "test-agent" },
    );
    expect(mockRes.cookie).toHaveBeenCalledWith("refreshToken", "r2", expect.any(Object));
    expect(res).toMatchObject({ accessToken: "a2", refreshToken: "r2" });
  });

  it("should throw UnauthorizedException if refresh token is missing from both cookie and body", async () => {
    await expect(
      controller.refresh({}, mockReq as unknown as Request, mockRes as unknown as Response),
    ).rejects.toThrow("Refresh token is required via cookie or body");
  });

  it("should throw UnauthorizedException if refreshToken in body is empty", async () => {
    await expect(
      controller.refresh(
        { refreshToken: "" },
        mockReq as unknown as Request,
        mockRes as unknown as Response,
      ),
    ).rejects.toThrow("Refresh token is required via cookie or body");
  });

  it("should delegate logout with body token and clear cookie", async () => {
    await controller.logout(
      { refreshToken: "token" },
      mockReq as unknown as Request,
      mockRes as unknown as Response,
    );
    expect(mockRes.clearCookie).toHaveBeenCalledWith("refreshToken", expect.any(Object));
    expect(authService.logout).toHaveBeenCalledWith({ refreshToken: "token" });
  });

  it("should succeed logout without token and clear cookie", async () => {
    const result = await controller.logout(
      {},
      mockReq as unknown as Request,
      mockRes as unknown as Response,
    );
    expect(mockRes.clearCookie).toHaveBeenCalledWith("refreshToken", expect.any(Object));
    expect(authService.logout).not.toHaveBeenCalled();
    expect(result).toEqual({ loggedOut: true });
  });

  it("should delegate logoutAll to the service and clear cookie", async () => {
    await controller.logoutAll(
      mockReq as unknown as AuthenticatedRequest,
      mockRes as unknown as Response,
    );
    expect(mockRes.clearCookie).toHaveBeenCalledWith("refreshToken", expect.any(Object));
    expect(authService.logoutAll).toHaveBeenCalledWith("user-1");
  });

  it("should delegate sessions to listSessions with the user ID", async () => {
    await controller.sessions(mockReq as unknown as AuthenticatedRequest);
    expect(authService.listSessions).toHaveBeenCalledWith("user-1");
  });

  it("should delegate revokeSession to the service with userId and sessionId", async () => {
    await controller.revokeSession("session-123", mockReq as unknown as AuthenticatedRequest);
    expect(authService.revokeSession).toHaveBeenCalledWith("user-1", "session-123");
  });

  it("should pass the token subject to me()", async () => {
    await controller.me(mockReq as unknown as AuthenticatedRequest);
    expect(authService.me).toHaveBeenCalledWith("user-1");
  });
});
