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
    verifyEmail: ReturnType<typeof vi.fn>;
    resendVerification: ReturnType<typeof vi.fn>;
    forgotPassword: ReturnType<typeof vi.fn>;
    resetPassword: ReturnType<typeof vi.fn>;
    updatePassword: ReturnType<typeof vi.fn>;
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
      register: vi.fn(() =>
        Promise.resolve({
          message: "Registration successful. Please check your email to verify your account.",
          email: "ada@example.com",
        }),
      ),
      login: vi.fn(() => Promise.resolve({ accessToken: "a", refreshToken: "r", user: {} })),
      refresh: vi.fn(() => Promise.resolve({ accessToken: "a2", refreshToken: "r2", user: {} })),
      logout: vi.fn(() => Promise.resolve({ loggedOut: true })),
      logoutAll: vi.fn(() => Promise.resolve({ loggedOut: true })),
      listSessions: vi.fn(() => Promise.resolve([])),
      revokeSession: vi.fn(() => Promise.resolve({ revoked: true })),
      verifyEmail: vi.fn(() => Promise.resolve({ message: "verified" })),
      resendVerification: vi.fn(() => Promise.resolve({ message: "resent" })),
      forgotPassword: vi.fn(() => Promise.resolve({ message: "dispatched" })),
      resetPassword: vi.fn(() => Promise.resolve({ message: "reset" })),
      updatePassword: vi.fn(() => Promise.resolve({ message: "changed" })),
    };
    controller = new AuthController(authService as unknown as AuthService);
    vi.clearAllMocks();
  });

  it("should delegate register to the service without setting cookies", async () => {
    const dto = { email: "ada@example.com", password: "correct-horse-1" };
    const res = await controller.register(dto);
    expect(authService.register).toHaveBeenCalledWith(dto);
    expect(res).toEqual({
      message: "Registration successful. Please check your email to verify your account.",
      email: "ada@example.com",
    });
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

  it("should delegate refresh via cookie and set new cookie", async () => {
    const cookieReq = {
      ...mockReq,
      cookies: { refreshToken: "cookie-token" },
    } as unknown as Request;
    const res = await controller.refresh(cookieReq, mockRes as unknown as Response);
    expect(authService.refresh).toHaveBeenCalledWith(
      { refreshToken: "cookie-token" },
      { ipAddress: "127.0.0.1", userAgent: "test-agent" },
    );
    expect(mockRes.cookie).toHaveBeenCalledWith("refreshToken", "r2", expect.any(Object));
    expect(res).toMatchObject({ accessToken: "a2", refreshToken: "r2" });
  });

  it("should throw UnauthorizedException if refresh token is missing in cookie and body", async () => {
    await expect(
      controller.refresh(mockReq as unknown as Request, mockRes as unknown as Response),
    ).rejects.toThrow("A refresh token must be provided via cookie or request body");
  });

  it("should delegate refresh via request body when cookie is missing and set new cookie", async () => {
    const bodyReq = {
      ...mockReq,
      cookies: {},
      body: { refreshToken: "body-token" },
    } as unknown as Request;
    const res = await controller.refresh(bodyReq, mockRes as unknown as Response);
    expect(authService.refresh).toHaveBeenCalledWith(
      { refreshToken: "body-token" },
      { ipAddress: "127.0.0.1", userAgent: "test-agent" },
    );
    expect(mockRes.cookie).toHaveBeenCalledWith("refreshToken", "r2", expect.any(Object));
    expect(res).toMatchObject({ accessToken: "a2", refreshToken: "r2" });
  });

  it("should delegate logout with cookie token and clear cookie", async () => {
    const cookieReq = {
      ...mockReq,
      cookies: { refreshToken: "cookie-token" },
    } as unknown as Request;
    await controller.logout(cookieReq, mockRes as unknown as Response);
    expect(mockRes.clearCookie).toHaveBeenCalledWith("refreshToken", expect.any(Object));
    expect(authService.logout).toHaveBeenCalledWith({ refreshToken: "cookie-token" });
  });

  it("should delegate logout with body token when cookie is absent and clear cookie", async () => {
    const bodyReq = {
      ...mockReq,
      cookies: {},
      body: { refreshToken: "body-token" },
    } as unknown as Request;
    await controller.logout(bodyReq, mockRes as unknown as Response);
    expect(mockRes.clearCookie).toHaveBeenCalledWith("refreshToken", expect.any(Object));
    expect(authService.logout).toHaveBeenCalledWith({ refreshToken: "body-token" });
  });

  it("should succeed logout without cookie or body token and clear cookie", async () => {
    const result = await controller.logout(
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

  it("should delegate verifyEmail to authService.verifyEmail", async () => {
    const dto = { token: "verify-token-123" };
    const res = await controller.verifyEmail(dto);
    expect(authService.verifyEmail).toHaveBeenCalledWith(dto);
    expect(res).toEqual({ message: "verified" });
  });

  it("should delegate resendVerification to authService.resendVerification", async () => {
    const dto = { email: "ada@example.com" };
    const res = await controller.resendVerification(dto);
    expect(authService.resendVerification).toHaveBeenCalledWith(dto);
    expect(res).toEqual({ message: "resent" });
  });

  it("should delegate forgotPassword to authService.forgotPassword", async () => {
    const dto = { email: "ada@example.com" };
    const res = await controller.forgotPassword(dto);
    expect(authService.forgotPassword).toHaveBeenCalledWith(dto);
    expect(res).toEqual({ message: "dispatched" });
  });

  it("should delegate resetPassword to authService.resetPassword", async () => {
    const dto = { token: "token-123", newPassword: "fresh-new-password-1" };
    const res = await controller.resetPassword(dto);
    expect(authService.resetPassword).toHaveBeenCalledWith(dto);
    expect(res).toEqual({ message: "reset" });
  });

  it("should delegate updatePassword to authService.updatePassword with extracted refresh token", async () => {
    const dto = { currentPassword: "old-1", newPassword: "new-2" };
    const reqWithCookie = {
      ...mockReq,
      cookies: { refreshToken: "cookie-refresh-token" },
    };
    const res = await controller.updatePassword(
      dto,
      reqWithCookie as unknown as AuthenticatedRequest,
    );
    expect(authService.updatePassword).toHaveBeenCalledWith("user-1", dto, "cookie-refresh-token");
    expect(res).toEqual({ message: "changed" });
  });
});
