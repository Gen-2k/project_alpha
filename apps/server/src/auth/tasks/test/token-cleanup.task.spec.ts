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
    cleanupExpiredPasswordResetTokens: ReturnType<typeof vi.fn>;
  };
  let loggerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    authService = {
      cleanupExpiredTokens: vi.fn(),
      cleanupUnverifiedUsers: vi.fn(),
      cleanupExpiredVerificationTokens: vi.fn(),
      cleanupExpiredPasswordResetTokens: vi.fn(),
    };
    task = new TokenCleanupTask(authService as unknown as AuthService);
    loggerSpy = vi.spyOn(Logger.prototype, "log").mockReturnValue();
  });

  it("should trigger cleanup and log when items are deleted", async () => {
    authService.cleanupExpiredTokens.mockResolvedValueOnce({ deleted: 5 });
    authService.cleanupUnverifiedUsers.mockResolvedValueOnce({ deleted: 3 });
    authService.cleanupExpiredVerificationTokens.mockResolvedValueOnce({ deleted: 2 });
    authService.cleanupExpiredPasswordResetTokens.mockResolvedValueOnce({ deleted: 1 });

    const result = await task.handleCleanup();

    expect(authService.cleanupExpiredTokens).toHaveBeenCalledOnce();
    expect(authService.cleanupUnverifiedUsers).toHaveBeenCalledOnce();
    expect(authService.cleanupExpiredVerificationTokens).toHaveBeenCalledOnce();
    expect(authService.cleanupExpiredPasswordResetTokens).toHaveBeenCalledOnce();
    expect(result).toEqual({
      tokensDeleted: 5,
      unverifiedUsersDeleted: 3,
      verificationTokensDeleted: 2,
      passwordResetTokensDeleted: 1,
    });
    expect(loggerSpy).toHaveBeenCalledWith("Cleaned up 5 expired or revoked refresh tokens.");
    expect(loggerSpy).toHaveBeenCalledWith("Cleaned up 3 abandoned unverified user accounts.");
    expect(loggerSpy).toHaveBeenCalledWith("Cleaned up 2 expired email verification tokens.");
    expect(loggerSpy).toHaveBeenCalledWith("Cleaned up 1 expired password reset tokens.");
  });

  it("should trigger cleanup without logging when zero items are deleted", async () => {
    authService.cleanupExpiredTokens.mockResolvedValueOnce({ deleted: 0 });
    authService.cleanupUnverifiedUsers.mockResolvedValueOnce({ deleted: 0 });
    authService.cleanupExpiredVerificationTokens.mockResolvedValueOnce({ deleted: 0 });
    authService.cleanupExpiredPasswordResetTokens.mockResolvedValueOnce({ deleted: 0 });

    const result = await task.handleCleanup();

    expect(authService.cleanupExpiredTokens).toHaveBeenCalledOnce();
    expect(authService.cleanupUnverifiedUsers).toHaveBeenCalledOnce();
    expect(authService.cleanupExpiredVerificationTokens).toHaveBeenCalledOnce();
    expect(authService.cleanupExpiredPasswordResetTokens).toHaveBeenCalledOnce();
    expect(result).toEqual({
      tokensDeleted: 0,
      unverifiedUsersDeleted: 0,
      verificationTokensDeleted: 0,
      passwordResetTokensDeleted: 0,
    });
    expect(loggerSpy).not.toHaveBeenCalled();
  });

  it("should log only for categories with deletions in mixed runs", async () => {
    authService.cleanupExpiredTokens.mockResolvedValueOnce({ deleted: 0 });
    authService.cleanupUnverifiedUsers.mockResolvedValueOnce({ deleted: 4 });
    authService.cleanupExpiredVerificationTokens.mockResolvedValueOnce({ deleted: 0 });
    authService.cleanupExpiredPasswordResetTokens.mockResolvedValueOnce({ deleted: 2 });

    const result = await task.handleCleanup();

    expect(result).toEqual({
      tokensDeleted: 0,
      unverifiedUsersDeleted: 4,
      verificationTokensDeleted: 0,
      passwordResetTokensDeleted: 2,
    });
    expect(loggerSpy).toHaveBeenCalledTimes(2);
    expect(loggerSpy).toHaveBeenCalledWith("Cleaned up 4 abandoned unverified user accounts.");
    expect(loggerSpy).toHaveBeenCalledWith("Cleaned up 2 expired password reset tokens.");
  });

  it("should propagate error when authService.cleanupExpiredTokens fails", async () => {
    authService.cleanupExpiredTokens.mockRejectedValueOnce(new Error("Cleanup database error"));

    await expect(task.handleCleanup()).rejects.toThrow("Cleanup database error");
    expect(loggerSpy).not.toHaveBeenCalled();
  });
});
