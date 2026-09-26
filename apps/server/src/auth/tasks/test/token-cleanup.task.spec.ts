import { Logger } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthService } from "../../auth.service.js";
import { TokenCleanupTask } from "../token-cleanup.task.js";

describe("TokenCleanupTask", () => {
  let task: TokenCleanupTask;
  let authService: {
    cleanupExpiredTokens: ReturnType<typeof vi.fn>;
    cleanupUnverifiedUsers: ReturnType<typeof vi.fn>;
    cleanupExpiredVerificationTokens: ReturnType<typeof vi.fn>;
  };
  let loggerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    authService = {
      cleanupExpiredTokens: vi.fn(),
      cleanupUnverifiedUsers: vi.fn(),
      cleanupExpiredVerificationTokens: vi.fn(),
    };
    task = new TokenCleanupTask(authService as unknown as AuthService);
    loggerSpy = vi.spyOn(Logger.prototype, "log").mockReturnValue();
  });

  it("should trigger cleanup and log when items are deleted", async () => {
    authService.cleanupExpiredTokens.mockResolvedValueOnce({ deleted: 5 });
    authService.cleanupUnverifiedUsers.mockResolvedValueOnce({ deleted: 3 });
    authService.cleanupExpiredVerificationTokens.mockResolvedValueOnce({ deleted: 2 });

    const result = await task.handleCleanup();

    expect(authService.cleanupExpiredTokens).toHaveBeenCalledOnce();
    expect(authService.cleanupUnverifiedUsers).toHaveBeenCalledOnce();
    expect(authService.cleanupExpiredVerificationTokens).toHaveBeenCalledOnce();
    expect(result).toEqual({
      tokensDeleted: 5,
      unverifiedUsersDeleted: 3,
      verificationTokensDeleted: 2,
    });
    expect(loggerSpy).toHaveBeenCalledWith("Cleaned up 5 expired or revoked refresh tokens.");
    expect(loggerSpy).toHaveBeenCalledWith("Cleaned up 3 abandoned unverified user accounts.");
    expect(loggerSpy).toHaveBeenCalledWith("Cleaned up 2 expired email verification tokens.");
  });

  it("should trigger cleanup without logging when zero items are deleted", async () => {
    authService.cleanupExpiredTokens.mockResolvedValueOnce({ deleted: 0 });
    authService.cleanupUnverifiedUsers.mockResolvedValueOnce({ deleted: 0 });
    authService.cleanupExpiredVerificationTokens.mockResolvedValueOnce({ deleted: 0 });

    const result = await task.handleCleanup();

    expect(authService.cleanupExpiredTokens).toHaveBeenCalledOnce();
    expect(authService.cleanupUnverifiedUsers).toHaveBeenCalledOnce();
    expect(authService.cleanupExpiredVerificationTokens).toHaveBeenCalledOnce();
    expect(result).toEqual({
      tokensDeleted: 0,
      unverifiedUsersDeleted: 0,
      verificationTokensDeleted: 0,
    });
    expect(loggerSpy).not.toHaveBeenCalled();
  });

  it("should propagate error when authService.cleanupExpiredTokens fails", async () => {
    authService.cleanupExpiredTokens.mockRejectedValueOnce(new Error("Cleanup database error"));

    await expect(task.handleCleanup()).rejects.toThrow("Cleanup database error");
    expect(loggerSpy).not.toHaveBeenCalled();
  });
});
