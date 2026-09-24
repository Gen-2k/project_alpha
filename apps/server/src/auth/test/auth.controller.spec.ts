import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthController } from "../auth.controller.js";
import type { AuthService } from "../auth.service.js";

describe("AuthController", () => {
  let controller: AuthController;
  let authService: {
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
  } as never;

  beforeEach(() => {
    authService = {
      register: vi.fn(() => Promise.resolve({ ok: true })),
      login: vi.fn(() => Promise.resolve({ ok: true })),
      refresh: vi.fn(() => Promise.resolve({ ok: true })),
      logout: vi.fn(() => Promise.resolve({ loggedOut: true })),
      logoutAll: vi.fn(() => Promise.resolve({ loggedOut: true })),
      listSessions: vi.fn(() => Promise.resolve([])),
      revokeSession: vi.fn(() => Promise.resolve({ revoked: true })),
      me: vi.fn(() => Promise.resolve({ ok: true })),
    };
    controller = new AuthController(authService as unknown as AuthService);
  });

  it("should delegate register to the service with the DTO and metadata", async () => {
    const dto = { email: "ada@example.com", password: "correct-horse-1" };
    await controller.register(dto, mockReq);
    expect(authService.register).toHaveBeenCalledWith(dto, {
      ipAddress: "127.0.0.1",
      userAgent: "test-agent",
    });
  });

  it("should delegate login to the service with the DTO and metadata", async () => {
    const dto = { email: "ada@example.com", password: "correct-horse-1" };
    await controller.login(dto, mockReq);
    expect(authService.login).toHaveBeenCalledWith(dto, {
      ipAddress: "127.0.0.1",
      userAgent: "test-agent",
    });
  });

  it("should delegate refresh to the service with the DTO and metadata", async () => {
    await controller.refresh({ refreshToken: "token" }, mockReq);
    expect(authService.refresh).toHaveBeenCalledWith(
      { refreshToken: "token" },
      { ipAddress: "127.0.0.1", userAgent: "test-agent" },
    );
  });

  it("should delegate logout to the service with the DTO", async () => {
    await controller.logout({ refreshToken: "token" });
    expect(authService.logout).toHaveBeenCalledWith({ refreshToken: "token" });
  });

  it("should delegate logoutAll to the service with the user ID", async () => {
    await controller.logoutAll(mockReq);
    expect(authService.logoutAll).toHaveBeenCalledWith("user-1");
  });

  it("should delegate sessions to listSessions with the user ID", async () => {
    await controller.sessions(mockReq);
    expect(authService.listSessions).toHaveBeenCalledWith("user-1");
  });

  it("should delegate revokeSession to the service with userId and sessionId", async () => {
    await controller.revokeSession("session-123", mockReq);
    expect(authService.revokeSession).toHaveBeenCalledWith("user-1", "session-123");
  });

  it("should pass the token subject to me()", async () => {
    await controller.me(mockReq);
    expect(authService.me).toHaveBeenCalledWith("user-1");
  });
});
